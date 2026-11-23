# NVIDIA Profile Inspector integration.
# Uses the official Orbmu2k/nvidiaProfileInspector release and its command-line switches:
#   -exportCustomized             export every customized profile to CustomProfiles_<date>.nip
#   -silentImport -mergeImport    merge a .nip into the driver profile database
#   -silentImport -replaceImport  reset the profiles named in the .nip, then apply its contents

$script:NvpiDir = $null

function Get-TRNvpiDir {
    if (-not $script:NvpiDir) { $script:NvpiDir = Join-Path $script:DataRoot 'tools\nvidiaProfileInspector' }
    return $script:NvpiDir
}

function Get-TRNvpiExe {
    $dir = Get-TRNvpiDir
    if (-not (Test-Path $dir)) { return $null }
    $exe = Get-ChildItem $dir -Recurse -Filter 'nvidiaProfileInspector.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exe) { return $exe.FullName }
    return $null
}

function Get-TRNvidiaStatus {
    $exe = Get-TRNvpiExe
    $state = Get-TRState
    $version = $null
    if ($exe) { $version = (Get-Item $exe).VersionInfo.FileVersion }
    return @{
        installed = [bool]$exe; exe = $exe; version = $version
        hasNvidiaGpu = [bool](Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match 'NVIDIA' })
        applied = $state.nvidia
    }
}

function Install-TRNvpi {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{ 'User-Agent' = 'Tickrate-Optimizer'; 'Accept' = 'application/vnd.github+json' }
    Write-TRLog 'Looking up the latest NVIDIA Profile Inspector release on GitHub'
    $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/Orbmu2k/nvidiaProfileInspector/releases/latest' -Headers $headers -UseBasicParsing
    $asset = @($rel.assets) | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
    if (-not $asset) { throw "Release $($rel.tag_name) has no .zip asset" }
    $dir = Get-TRNvpiDir
    $zip = Join-Path $env:TEMP "nvpi-$($rel.tag_name).zip"
    Write-TRLog "Downloading $($asset.name) ($($rel.tag_name))"
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -Headers @{ 'User-Agent' = 'Tickrate-Optimizer' } -UseBasicParsing
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Expand-Archive -Path $zip -DestinationPath $dir -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Get-ChildItem $dir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
    $exe = Get-TRNvpiExe
    if (-not $exe) { throw 'nvidiaProfileInspector.exe was not found in the downloaded archive' }
    Write-TRLog "Installed to $exe"
    return Get-TRNvidiaStatus
}

function Invoke-TRNvpi {
    param([string[]]$Arguments)
    $exe = Get-TRNvpiExe
    if (-not $exe) { throw 'NVIDIA Profile Inspector is not installed yet.' }
    Write-TRLog "> nvidiaProfileInspector $($Arguments -join ' ')"
    $quoted = $Arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
    $p = Start-Process -FilePath $exe -ArgumentList $quoted -PassThru -WindowStyle Hidden -WorkingDirectory (Split-Path $exe)
    if (-not $p.WaitForExit(90000)) { try { $p.Kill() } catch { }; throw 'NVIDIA Profile Inspector did not finish within 90 seconds.' }
}

function Export-TRNvpiCustomized {
    $exe = Get-TRNvpiExe
    $dir = Split-Path $exe
    $before = @(Get-ChildItem $dir -Filter 'CustomProfiles_*.nip' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    Invoke-TRNvpi @('-exportCustomized')
    $new = Get-ChildItem $dir -Filter 'CustomProfiles_*.nip' -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.FullName } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $new) { return $null }
    return $new.FullName
}

function Get-TRNipProfileNode {
    param([string]$File, [string]$ProfileName)
    if (-not $File -or -not (Test-Path $File)) { return $null }
    [xml]$doc = Get-Content -LiteralPath $File -Raw
    foreach ($p in $doc.ArrayOfProfile.Profile) {
        if ($p.ProfileName -eq $ProfileName) { return $p }
    }
    return $null
}

function Read-TRNvidiaBaseProfile {
    $file = Export-TRNvpiCustomized
    $node = Get-TRNipProfileNode $file 'Base Profile'
    $settings = @{}
    if ($node -and $node.Settings) {
        foreach ($s in @($node.Settings.ProfileSetting)) { $settings[[string]$s.SettingID] = [string]$s.SettingValue }
    }
    if ($file) { Remove-Item $file -Force -ErrorAction SilentlyContinue }
    return $settings
}

function ConvertTo-TRXmlText {
    param([string]$s)
    return [Security.SecurityElement]::Escape($s)
}

function New-TRNipFile {
    param([string]$Path, [string]$ProfileName, $Settings)
    # $Settings: list of @{ id; value; name; type }
    $sb = New-Object Text.StringBuilder
    [void]$sb.AppendLine('<?xml version="1.0" encoding="utf-8"?>')
    [void]$sb.AppendLine('<ArrayOfProfile>')
    [void]$sb.AppendLine('  <Profile>')
    [void]$sb.AppendLine("    <ProfileName>$(ConvertTo-TRXmlText $ProfileName)</ProfileName>")
    [void]$sb.AppendLine('    <Executeables />')
    if (@($Settings).Count -eq 0) { [void]$sb.AppendLine('    <Settings />') }
    else {
        [void]$sb.AppendLine('    <Settings>')
        foreach ($s in $Settings) {
            $type = 'Dword'; if ($s.type) { $type = $s.type }
            [void]$sb.AppendLine('      <ProfileSetting>')
            [void]$sb.AppendLine("        <SettingNameInfo>$(ConvertTo-TRXmlText ([string]$s.name))</SettingNameInfo>")
            [void]$sb.AppendLine("        <SettingID>$([uint32]$s.id)</SettingID>")
            [void]$sb.AppendLine("        <SettingValue>$(ConvertTo-TRXmlText ([string]$s.value))</SettingValue>")
            [void]$sb.AppendLine("        <ValueType>$type</ValueType>")
            [void]$sb.AppendLine('      </ProfileSetting>')
        }
        [void]$sb.AppendLine('    </Settings>')
    }
    [void]$sb.AppendLine('  </Profile>')
    [void]$sb.AppendLine('</ArrayOfProfile>')
    [IO.File]::WriteAllText($Path, $sb.ToString(), (New-Object Text.UTF8Encoding $false))
}

function Invoke-TRNvidiaApply {
    param($Settings)
    $state = Get-TRState
    $backupDir = Join-Path $script:DataRoot 'backups\nvidia'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    if (-not $state.nvidia -or -not $state.nvidia.backupTaken) {
        Write-TRLog 'Backing up your current NVIDIA driver profiles'
        $export = Export-TRNvpiCustomized
        $backupFile = $null
        $hadBase = $false
        if ($export) {
            $backupFile = Join-Path $backupDir ("original-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.nip')
            Move-Item $export $backupFile -Force
            $hadBase = [bool](Get-TRNipProfileNode $backupFile 'Base Profile')
        }
        $state.nvidia = @{ backupTaken = $true; backupFile = $backupFile; hadBaseProfile = $hadBase; firstAppliedAt = (Get-Date).ToString('o') }
    }

    $nip = Join-Path $backupDir 'tickrate-apply.nip'
    New-TRNipFile $nip 'Base Profile' $Settings
    Invoke-TRNvpi @('-silentImport', '-mergeImport', $nip)

    # verify by reading the profile back
    $now = Read-TRNvidiaBaseProfile
    $mismatch = @()
    foreach ($s in $Settings) {
        $id = [string]([uint32]$s.id)
        if ($now.ContainsKey($id)) {
            if ($now[$id] -ne [string]$s.value) { $mismatch += $s.name }
        } elseif ($null -eq $s.default -or [string]$s.default -ne [string]$s.value) {
            # settings equal to the driver default are not exported as "customized"
            $mismatch += $s.name
        }
    }
    $state.nvidia.applied = @($Settings)
    $state.nvidia.lastAppliedAt = (Get-Date).ToString('o')
    Save-TRState $state
    return @{ verified = ($mismatch.Count -eq 0); mismatch = $mismatch; current = $now }
}

function Invoke-TRNvidiaRevert {
    $state = Get-TRState
    $backupDir = Join-Path $script:DataRoot 'backups\nvidia'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $restore = Join-Path $backupDir 'tickrate-restore.nip'
    $settings = @()
    if ($state.nvidia -and $state.nvidia.hadBaseProfile -and $state.nvidia.backupFile) {
        $node = Get-TRNipProfileNode $state.nvidia.backupFile 'Base Profile'
        if ($node -and $node.Settings) {
            foreach ($s in @($node.Settings.ProfileSetting)) {
                $settings += @{ id = [uint32]$s.SettingID; value = [string]$s.SettingValue; name = [string]$s.SettingNameInfo; type = [string]$s.ValueType }
            }
        }
        Write-TRLog "Restoring your original Base Profile ($($settings.Count) customized settings)"
    } else {
        Write-TRLog 'Resetting Base Profile to NVIDIA defaults (it had no custom settings before)'
    }
    New-TRNipFile $restore 'Base Profile' $settings
    Invoke-TRNvpi @('-silentImport', '-replaceImport', $restore)
    $state.nvidia = $null
    Save-TRState $state
    return @{ restored = $settings.Count; current = (Read-TRNvidiaBaseProfile) }
}
