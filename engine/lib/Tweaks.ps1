# Tweak engine: detect / apply / revert for declarative operations.
#
# Supported op types (see electron/catalog for definitions):
#   reg     - set or delete a registry value (original value is backed up)
#   service - change a service start type (original start type is backed up)
#   task    - enable/disable a scheduled task (original state is backed up)
#   bcd     - set or delete a boot configuration element (original value is backed up)
#   ps      - custom PowerShell with apply / revert / detect script blocks.
#             apply returns a backup object that revert receives as $Backup.

$script:ServiceStartMap = @{ 'Boot' = 0; 'System' = 1; 'Automatic' = 2; 'Manual' = 3; 'Disabled' = 4 }

function ConvertTo-TRHashtable {
    param($InputObject)
    if ($null -eq $InputObject) { return $null }
    if ($InputObject -is [System.Collections.IDictionary]) {
        $h = @{}
        foreach ($k in $InputObject.Keys) { $h[$k] = ConvertTo-TRHashtable $InputObject[$k] }
        return $h
    }
    if ($InputObject -is [pscustomobject]) {
        $h = @{}
        foreach ($p in $InputObject.PSObject.Properties) { $h[$p.Name] = ConvertTo-TRHashtable $p.Value }
        return $h
    }
    if (($InputObject -is [System.Collections.IEnumerable]) -and -not ($InputObject -is [string])) {
        $list = @()
        foreach ($item in $InputObject) { $list += ,(ConvertTo-TRHashtable $item) }
        return ,$list
    }
    return $InputObject
}

function Get-TRState {
    $file = Join-Path $script:DataRoot 'state.json'
    if (Test-Path $file) {
        try {
            $raw = [IO.File]::ReadAllText($file)
            $obj = ConvertTo-TRHashtable ($raw | ConvertFrom-Json)
            if ($null -eq $obj.tweaks) { $obj.tweaks = @{} }
            if ($null -eq $obj.apps) { $obj.apps = @() }
            return $obj
        } catch {
            Write-TRLog "state.json could not be read, keeping a copy and starting fresh: $($_.Exception.Message)"
            Copy-Item $file "$file.corrupt-$(Get-Date -Format yyyyMMddHHmmss)" -ErrorAction SilentlyContinue
        }
    }
    return @{ version = 1; tweaks = @{}; apps = @(); nvidia = $null }
}

function Save-TRState {
    param($State)
    $file = Join-Path $script:DataRoot 'state.json'
    $json = $State | ConvertTo-Json -Depth 20
    $tmp = "$file.tmp"
    [IO.File]::WriteAllText($tmp, $json, (New-Object Text.UTF8Encoding $false))
    Move-Item -Force $tmp $file
}

function New-TRScript {
    param([string]$Body)
    return [scriptblock]::Create("param(`$Ctx, `$Backup, `$Op)`n$Body")
}

function Get-TRBcdValues {
    $map = @{}
    $out = & bcdedit.exe /enum '{current}' 2>$null
    foreach ($line in $out) {
        if ($line -match '^\s*([A-Za-z][A-Za-z0-9]+)\s+(.+?)\s*$') { $map[$Matches[1].ToLowerInvariant()] = $Matches[2] }
    }
    return $map
}

function Test-TRBcdEquals {
    param($Current, $Desired)
    if ($null -eq $Current) { return $false }
    $c = ([string]$Current).ToLowerInvariant()
    $d = ([string]$Desired).ToLowerInvariant()
    $truthy = @('yes', 'true', 'on', '1')
    $falsy = @('no', 'false', 'off', '0')
    if (($truthy -contains $c) -and ($truthy -contains $d)) { return $true }
    if (($falsy -contains $c) -and ($falsy -contains $d)) { return $true }
    return $c -eq $d
}

# ---------- per-op detect ----------
# Returns 'match', 'nomatch' or 'na'
function Get-TROpStatus {
    param($Op, $Ctx, $Backup)
    switch ($Op.op) {
        'reg' {
            $cur = Read-TRRegValue $Op.path $Op.name
            if ($Op.delete) { if ($cur.exists) { return 'nomatch' } else { return 'match' } }
            if ($Op.onlyIfKeyExists -and -not $cur.keyExists) { return 'na' }
            if (Test-TRRegValueEquals $cur $Op.type $Op.value) { return 'match' }
            return 'nomatch'
        }
        'service' {
            $cur = Read-TRRegValue "HKLM\SYSTEM\CurrentControlSet\Services\$($Op.name)" 'Start'
            if (-not $cur.exists) { return 'na' }
            if ([int64]$cur.value -eq $script:ServiceStartMap[$Op.start]) { return 'match' }
            return 'nomatch'
        }
        'task' {
            $t = Get-ScheduledTask -TaskPath $Op.path -TaskName $Op.name -ErrorAction SilentlyContinue
            if ($null -eq $t) { return 'na' }
            $isDisabled = ($t.State -eq 'Disabled')
            if (($Op.state -eq 'Disabled') -eq $isDisabled) { return 'match' }
            return 'nomatch'
        }
        'bcd' {
            $vals = Get-TRBcdValues
            $cur = $vals[$Op.key.ToLowerInvariant()]
            if ($null -eq $Op.value) { if ($null -eq $cur) { return 'match' } else { return 'nomatch' } }
            if (Test-TRBcdEquals $cur $Op.value) { return 'match' }
            return 'nomatch'
        }
        'ps' {
            if (-not $Op.detect) { return 'na' }
            $r = & (New-TRScript $Op.detect) $Ctx $Backup $Op
            $r = @($r) | Select-Object -Last 1
            if ($r -eq 'na') { return 'na' }
            if ($r -eq $true) { return 'match' }
            return 'nomatch'
        }
        default { throw "Unknown op type '$($Op.op)'" }
    }
}

# ---------- per-op apply (returns backup) ----------
function Invoke-TROpApply {
    param($Op, $Ctx, $ExistingBackup)
    switch ($Op.op) {
        'reg' {
            $backup = $ExistingBackup
            if ($null -eq $backup) {
                $cur = Read-TRRegValue $Op.path $Op.name
                $backup = @{ exists = $cur.exists; kind = $cur.kind; value = $cur.value; createdKey = (Get-TRMissingAncestor $Op.path) }
            }
            if ($Op.delete) { Remove-TRRegValue $Op.path $Op.name }
            else {
                if ($Op.onlyIfKeyExists -and -not (Test-TRRegKey $Op.path)) { return $backup }
                Write-TRRegValue $Op.path $Op.name $Op.type $Op.value
            }
            return $backup
        }
        'service' {
            $keyPath = "HKLM\SYSTEM\CurrentControlSet\Services\$($Op.name)"
            $cur = Read-TRRegValue $keyPath 'Start'
            if (-not $cur.exists) { return $ExistingBackup }
            $backup = $ExistingBackup
            if ($null -eq $backup) { $backup = @{ start = $cur.value } }
            Write-TRRegValue $keyPath 'Start' 'DWord' $script:ServiceStartMap[$Op.start]
            if ($Op.start -eq 'Disabled') { Stop-Service -Name $Op.name -Force -ErrorAction SilentlyContinue }
            return $backup
        }
        'task' {
            $t = Get-ScheduledTask -TaskPath $Op.path -TaskName $Op.name -ErrorAction SilentlyContinue
            if ($null -eq $t) { return $ExistingBackup }
            $backup = $ExistingBackup
            if ($null -eq $backup) { $backup = @{ wasDisabled = ($t.State -eq 'Disabled') } }
            if ($Op.state -eq 'Disabled') { $null = Disable-ScheduledTask -TaskPath $Op.path -TaskName $Op.name -ErrorAction Stop }
            else { $null = Enable-ScheduledTask -TaskPath $Op.path -TaskName $Op.name -ErrorAction Stop }
            return $backup
        }
        'bcd' {
            $backup = $ExistingBackup
            if ($null -eq $backup) {
                $vals = Get-TRBcdValues
                $cur = $vals[$Op.key.ToLowerInvariant()]
                $backup = @{ exists = ($null -ne $cur); value = $cur }
            }
            if ($null -eq $Op.value) { $null = & bcdedit.exe /deletevalue '{current}' $Op.key 2>&1 }
            else {
                $out = & bcdedit.exe /set '{current}' $Op.key $Op.value 2>&1
                if ($LASTEXITCODE -ne 0) { throw "bcdedit failed: $out" }
            }
            return $backup
        }
        'ps' {
            $r = & (New-TRScript $Op.apply) $Ctx $ExistingBackup $Op
            if ($null -ne $ExistingBackup) { return $ExistingBackup }
            $r = @($r) | Where-Object { $_ -is [System.Collections.IDictionary] } | Select-Object -Last 1
            if ($null -eq $r) { return @{} }
            return $r
        }
        default { throw "Unknown op type '$($Op.op)'" }
    }
}

# ---------- per-op revert ----------
function Get-TRRegDefault {
    param($Op)
    # Explicit default in the catalog wins: 'default' = value, or 'defaultDelete' = $true.
    if ($Op.defaultDelete) { return @{ exists = $false } }
    if ($Op.ContainsKey('default') -and $null -ne $Op['default']) { return @{ exists = $true; kind = $Op.type; value = $Op['default'] } }
    # Group-policy values do not exist on a stock install.
    if ($Op.path -match '\\Policies\\') { return @{ exists = $false } }
    return $null
}

function Invoke-TROpRevert {
    param($Op, $Ctx, $Backup)
    switch ($Op.op) {
        'reg' {
            $b = $Backup
            if ($null -eq $b) { $b = Get-TRRegDefault $Op }
            if ($null -eq $b) { Write-TRLog "  no backup for $($Op.path)\$($Op.name); left unchanged"; return }
            if ($b.exists) {
                $kind = $b.kind; if (-not $kind) { $kind = $Op.type }
                Write-TRRegValue $Op.path $Op.name $kind $b.value
            } else {
                Remove-TRRegValue $Op.path $Op.name
                if ($b.createdKey -and (Test-TRRegTreeEmpty $b.createdKey)) { Remove-TRRegKeyTree $b.createdKey }
            }
        }
        'service' {
            $start = $null
            if ($Backup -and $null -ne $Backup.start) { $start = [int]$Backup.start }
            elseif ($Op['default']) { $start = $script:ServiceStartMap[$Op['default']] }
            if ($null -eq $start) { Write-TRLog "  no backup for service $($Op.name); left unchanged"; return }
            $keyPath = "HKLM\SYSTEM\CurrentControlSet\Services\$($Op.name)"
            if (-not (Test-TRRegKey $keyPath)) { return }
            Write-TRRegValue $keyPath 'Start' 'DWord' $start
            if ($start -eq 2) { Start-Service -Name $Op.name -ErrorAction SilentlyContinue }
        }
        'task' {
            $t = Get-ScheduledTask -TaskPath $Op.path -TaskName $Op.name -ErrorAction SilentlyContinue
            if ($null -eq $t) { return }
            $wasDisabled = $false
            if ($Backup) { $wasDisabled = [bool]$Backup.wasDisabled }
            if ($wasDisabled) { $null = Disable-ScheduledTask -TaskPath $Op.path -TaskName $Op.name -ErrorAction SilentlyContinue }
            else { $null = Enable-ScheduledTask -TaskPath $Op.path -TaskName $Op.name -ErrorAction SilentlyContinue }
        }
        'bcd' {
            $b = $Backup
            if ($null -eq $b) { $b = @{ exists = $false } }
            if ($b.exists) { $null = & bcdedit.exe /set '{current}' $Op.key $b.value 2>&1 }
            else { $null = & bcdedit.exe /deletevalue '{current}' $Op.key 2>&1 }
        }
        'ps' {
            if ($Op.revert) { $null = & (New-TRScript $Op.revert) $Ctx $Backup $Op }
        }
    }
}

# ---------- tweak level ----------
# A tweak may carry a 'guard' script; when it returns $false the tweak is not applicable here.
function Test-TRTweakGuard {
    param($Tweak, $Ctx)
    # CPU-specific tweaks (e.g. dual-CCD X3D only) are enforced here, not just in the UI.
    if ($Tweak.cpu -and $Ctx -and $Ctx.cpuClass -and (@($Tweak.cpu) -notcontains $Ctx.cpuClass)) { return $false }
    if (-not $Tweak.guard) { return $true }
    try {
        $r = & (New-TRScript $Tweak.guard) $Ctx $null $null
        return [bool](@($r) | Select-Object -Last 1)
    } catch { return $false }
}

function Get-TRTweakStatus {
    param($Tweak, $Ctx, $State)
    $entry = $State.tweaks[$Tweak.id]
    if (-not $entry -and -not (Test-TRTweakGuard $Tweak $Ctx)) {
        return @{ status = 'na'; tracked = $false; appliedAt = $null; errors = @() }
    }
    $match = 0; $total = 0; $errors = @()
    $ops = @($Tweak.ops)
    for ($i = 0; $i -lt $ops.Count; $i++) {
        $b = $null
        if ($entry -and $entry.backups) { $b = $entry.backups["$i"] }
        try { $s = Get-TROpStatus $ops[$i] $Ctx $b } catch { $s = 'error'; $errors += $_.Exception.Message }
        if ($s -eq 'na') { continue }
        $total++
        if ($s -eq 'match') { $match++ }
    }
    $status = 'default'
    if ($total -eq 0) { $status = 'na' }
    elseif ($match -eq $total) { $status = 'applied' }
    elseif ($match -gt 0) { $status = 'partial' }
    return @{
        status = $status
        tracked = ($null -ne $entry)
        appliedAt = $(if ($entry) { $entry.appliedAt } else { $null })
        errors = $errors
    }
}

function Invoke-TRTweakApply {
    param($Tweak, $Ctx, $State)
    if (-not (Test-TRTweakGuard $Tweak $Ctx)) {
        $why = 'Not applicable to this PC.'
        if ($Tweak.guardMessage) { $why = $Tweak.guardMessage }
        return @{ ok = $false; errors = @($why); skipped = $true }
    }
    $entry = $State.tweaks[$Tweak.id]
    if ($null -eq $entry) { $entry = @{ appliedAt = (Get-Date).ToString('o'); title = $Tweak.title; backups = @{} } }
    if ($null -eq $entry.backups) { $entry.backups = @{} }
    $ops = @($Tweak.ops)
    $errors = @()
    for ($i = 0; $i -lt $ops.Count; $i++) {
        $existing = $entry.backups["$i"]
        try {
            $b = Invoke-TROpApply $ops[$i] $Ctx $existing
            if ($null -ne $b) { $entry.backups["$i"] = $b }
        } catch {
            $errors += "op $i ($($ops[$i].op)): $($_.Exception.Message)"
        }
    }
    $entry.lastAppliedAt = (Get-Date).ToString('o')
    $State.tweaks[$Tweak.id] = $entry
    return @{ ok = ($errors.Count -eq 0); errors = $errors }
}

function Invoke-TRTweakRevert {
    param($Tweak, $Ctx, $State)
    $entry = $State.tweaks[$Tweak.id]
    $ops = @($Tweak.ops)
    $errors = @()
    for ($i = $ops.Count - 1; $i -ge 0; $i--) {
        $b = $null
        if ($entry -and $entry.backups) { $b = $entry.backups["$i"] }
        try { Invoke-TROpRevert $ops[$i] $Ctx $b } catch { $errors += "op $i ($($ops[$i].op)): $($_.Exception.Message)" }
    }
    if ($errors.Count -eq 0) { $State.tweaks.Remove($Tweak.id) }
    return @{ ok = ($errors.Count -eq 0); errors = $errors; hadBackup = ($null -ne $entry) }
}
