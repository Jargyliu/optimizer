# Restore points, startup manager, app debloat, maintenance tasks and power-plan listing.

# ---------------- restore points ----------------
function Get-TRRestoreStatus {
    $enabled = $false
    $k = Open-TRRegKey 'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SPP\Clients'
    if ($k) {
        foreach ($n in $k.GetValueNames()) {
            $v = $k.GetValue($n)
            $drive = ($env:SystemDrive -replace ':', '%3A')
            if ((@($v) -join ' ') -match [regex]::Escape($drive)) { $enabled = $true }
        }
        $k.Close()
    }
    $points = @()
    try {
        foreach ($p in @(Get-ComputerRestorePoint -ErrorAction Stop)) {
            $points += @{ seq = $p.SequenceNumber; description = $p.Description; created = ([Management.ManagementDateTimeConverter]::ToDateTime($p.CreationTime)).ToString('o'); type = [int]$p.RestorePointType }
        }
    } catch { }
    if ($points.Count -gt 0) { $enabled = $true }
    return @{ enabled = $enabled; points = $points }
}

function New-TRRestorePoint {
    param([string]$Description, [bool]$EnableIfOff = $true)
    $status = Get-TRRestoreStatus
    if (-not $status.enabled) {
        if (-not $EnableIfOff) { throw 'System Protection is off for the system drive.' }
        Write-TRLog "Turning on System Protection for $env:SystemDrive"
        Enable-ComputerRestore -Drive "$env:SystemDrive\"
        & vssadmin.exe resize shadowstorage /for=$env:SystemDrive /on=$env:SystemDrive /maxsize=5% 2>&1 | Out-Null
    }
    # Windows only allows one restore point per 24h by default; lift that limit just for this call.
    $key = 'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
    $prev = Read-TRRegValue $key 'SystemRestorePointCreationFrequency'
    Write-TRRegValue $key 'SystemRestorePointCreationFrequency' 'DWord' 0
    try {
        Write-TRLog "Creating restore point '$Description'"
        Checkpoint-Computer -Description $Description -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
    } finally {
        if ($prev.exists) { Write-TRRegValue $key 'SystemRestorePointCreationFrequency' $prev.kind $prev.value }
        else { Remove-TRRegValue $key 'SystemRestorePointCreationFrequency' }
    }
    return Get-TRRestoreStatus
}

# ---------------- startup manager ----------------
function Get-TRStartupSources {
    $approved = 'Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved'
    return @(
        @{ source = 'HKCU Run'; kind = 'reg'; path = 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run'; approved = "HKCU\$approved\Run" },
        @{ source = 'HKLM Run'; kind = 'reg'; path = 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'; approved = "HKLM\$approved\Run" },
        @{ source = 'HKLM Run (32-bit)'; kind = 'reg'; path = 'HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; approved = "HKLM\$approved\Run32" },
        @{ source = 'Startup folder'; kind = 'dir'; path = [Environment]::GetFolderPath('Startup'); approved = "HKCU\$approved\StartupFolder" },
        @{ source = 'Startup folder (all users)'; kind = 'dir'; path = [Environment]::GetFolderPath('CommonStartup'); approved = "HKLM\$approved\StartupFolder" }
    )
}

function Test-TRStartupEnabled {
    param([string]$Approved, [string]$Name)
    $v = Read-TRRegValue $Approved $Name
    if (-not $v.exists -or $v.kind -ne 'Binary' -or $v.value.Length -lt 2) { return $true }
    $first = [Convert]::ToByte($v.value.Substring(0, 2), 16)
    return (($first -band 1) -eq 0)
}

function Get-TRStartupItems {
    $items = @()
    foreach ($s in Get-TRStartupSources) {
        if ($s.kind -eq 'reg') {
            $k = Open-TRRegKey $s.path
            if (-not $k) { continue }
            foreach ($n in $k.GetValueNames()) {
                if ($n -eq '') { continue }
                $items += @{ id = "$($s.source)|$n"; name = $n; command = [string]$k.GetValue($n); source = $s.source; enabled = (Test-TRStartupEnabled $s.approved $n) }
            }
            $k.Close()
        } elseif ($s.path -and (Test-Path $s.path)) {
            foreach ($f in Get-ChildItem $s.path -File -ErrorAction SilentlyContinue) {
                if ($f.Name -eq 'desktop.ini') { continue }
                $items += @{ id = "$($s.source)|$($f.Name)"; name = [IO.Path]::GetFileNameWithoutExtension($f.Name); command = $f.FullName; source = $s.source; enabled = (Test-TRStartupEnabled $s.approved $f.Name) }
            }
        }
    }
    return ,$items
}

function Set-TRStartupItem {
    param([string]$Id, [bool]$Enabled)
    $parts = $Id.Split('|', 2)
    $src = Get-TRStartupSources | Where-Object { $_.source -eq $parts[0] } | Select-Object -First 1
    if (-not $src) { throw "Unknown startup source '$($parts[0])'" }
    $name = $parts[1]
    if ($Enabled) {
        $bytes = '020000000000000000000000'
    } else {
        $ft = [BitConverter]::GetBytes((Get-Date).ToFileTimeUtc())
        $bytes = '03000000' + (($ft | ForEach-Object { $_.ToString('X2') }) -join '')
    }
    Write-TRRegValue $src.approved $name 'Binary' $bytes
    Write-TRLog "Startup item '$name' -> $(if ($Enabled) { 'enabled' } else { 'disabled' })"
}

# ---------------- app debloat ----------------
function Get-TRApps {
    param([string[]]$Patterns)
    $installed = @{}
    $all = @(Get-AppxPackage -ErrorAction SilentlyContinue)
    foreach ($p in $Patterns) {
        $hit = $all | Where-Object { $_.Name -like $p } | Select-Object -First 1
        if ($hit) { $installed[$p] = @{ name = $hit.Name; version = [string]$hit.Version } }
    }
    return $installed
}

function Remove-TRApps {
    param([string[]]$Patterns, [bool]$Deprovision)
    $state = Get-TRState
    $removed = @(); $failed = @()
    $prov = @()
    if ($Deprovision) { $prov = @(Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue) }
    foreach ($p in $Patterns) {
        foreach ($pkg in @(Get-AppxPackage -Name $p -ErrorAction SilentlyContinue)) {
            try {
                Write-TRLog "Removing $($pkg.Name)"
                Remove-AppxPackage -Package $pkg.PackageFullName -ErrorAction Stop
                $removed += $pkg.Name
            } catch { $failed += "$($pkg.Name): $($_.Exception.Message)" }
        }
        foreach ($pp in ($prov | Where-Object { $_.DisplayName -like $p })) {
            try { $null = Remove-AppxProvisionedPackage -Online -PackageName $pp.PackageName -ErrorAction Stop; Write-TRLog "Deprovisioned $($pp.DisplayName)" }
            catch { $failed += "$($pp.DisplayName) (provisioned): $($_.Exception.Message)" }
        }
    }
    $apps = @($state.apps)
    foreach ($r in $removed) { $apps += @{ name = $r; removedAt = (Get-Date).ToString('o') } }
    $state.apps = $apps
    Save-TRState $state
    return @{ removed = $removed; failed = $failed }
}

# ---------------- maintenance ----------------
function Invoke-TRNative {
    param([string]$File, [string[]]$Arguments)
    Write-TRLog "> $File $($Arguments -join ' ')"
    & $File @Arguments 2>&1 | ForEach-Object {
        $line = ([string]$_) -replace "`0", ''
        if ($line.Trim()) { Write-TRLog $line.TrimEnd() }
    }
    return $LASTEXITCODE
}

function Invoke-TRMaintenance {
    param([string]$Task)
    switch ($Task) {
        'sfc'          { $code = Invoke-TRNative "$env:SystemRoot\System32\sfc.exe" @('/scannow') }
        'dism-restore' { $code = Invoke-TRNative "$env:SystemRoot\System32\dism.exe" @('/Online', '/Cleanup-Image', '/RestoreHealth') }
        'dism-cleanup' { $code = Invoke-TRNative "$env:SystemRoot\System32\dism.exe" @('/Online', '/Cleanup-Image', '/StartComponentCleanup') }
        'trim' {
            foreach ($v in Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter }) {
                Write-TRLog "Optimizing $($v.DriveLetter): (TRIM on SSDs, defrag on HDDs)"
                try { Optimize-Volume -DriveLetter $v.DriveLetter -ErrorAction Stop; Write-TRLog '  done' } catch { Write-TRLog "  $($_.Exception.Message)" }
            }
            $code = 0
        }
        'flush-dns'    { Clear-DnsClientCache; $code = Invoke-TRNative "$env:SystemRoot\System32\ipconfig.exe" @('/flushdns') }
        'reset-network' {
            $null = Invoke-TRNative "$env:SystemRoot\System32\netsh.exe" @('winsock', 'reset')
            $code = Invoke-TRNative "$env:SystemRoot\System32\netsh.exe" @('int', 'ip', 'reset')
            Write-TRLog 'Restart Windows to finish the network reset.'
        }
        'restart-explorer' {
            Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 800
            if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
            $code = 0
        }
        default { throw "Unknown maintenance task '$Task'" }
    }
    return @{ exitCode = $code }
}

# ---------------- power plans ----------------
function Get-TRPowerPlans {
    $plans = @()
    foreach ($line in (& powercfg.exe /list)) {
        if ($line -match '([0-9a-fA-F-]{36})\s+\((.+?)\)(\s*\*)?') {
            $plans += @{ guid = $Matches[1]; name = $Matches[2]; active = [bool]$Matches[3] }
        }
    }
    return ,$plans
}

function Set-TRPowerPlanActive {
    param([string]$Guid)
    & powercfg.exe /setactive $Guid
    if ($LASTEXITCODE -ne 0) { throw "powercfg /setactive $Guid failed" }
    return Get-TRPowerPlans
}
