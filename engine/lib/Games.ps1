# Locates Fortnite and VALORANT installs from launcher manifests.

function Find-TRFortnite {
    $result = @{ installed = $false; dir = $null; exe = $null; eacExe = $null }
    $manifest = Join-Path $env:ProgramData 'Epic\UnrealEngineLauncher\LauncherInstalled.dat'
    $candidates = @()
    if (Test-Path $manifest) {
        try {
            $data = [IO.File]::ReadAllText($manifest) | ConvertFrom-Json
            foreach ($item in @($data.InstallationList)) {
                if ($item.AppName -eq 'Fortnite' -or $item.InstallLocation -match 'Fortnite') { $candidates += $item.InstallLocation }
            }
        } catch { }
    }
    $candidates += @("$env:ProgramFiles\Epic Games\Fortnite", 'C:\Program Files\Epic Games\Fortnite', 'D:\Epic Games\Fortnite')
    foreach ($dir in $candidates) {
        if (-not $dir) { continue }
        $exe = Join-Path $dir 'FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe'
        if (Test-Path $exe) {
            $result.installed = $true
            $result.dir = $dir
            $result.exe = $exe
            $result.eacExe = Join-Path $dir 'FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping_EAC_EOS.exe'
            break
        }
    }
    return $result
}

function Find-TRValorant {
    $result = @{ installed = $false; dir = $null; exe = $null; riotDir = $null }
    $candidates = @()
    $settings = Join-Path $env:ProgramData 'Riot Games\Metadata\valorant.live\valorant.live.product_settings.yaml'
    if (Test-Path $settings) {
        $line = Get-Content $settings | Where-Object { $_ -match 'product_install_full_path' } | Select-Object -First 1
        if ($line -match 'product_install_full_path:\s*"?([^"]+)"?') { $candidates += ($Matches[1] -replace '/', '\') }
    }
    $candidates += @('C:\Riot Games\VALORANT\live', 'D:\Riot Games\VALORANT\live')
    foreach ($dir in $candidates) {
        if (-not $dir) { continue }
        $exe = Join-Path $dir 'ShooterGame\Binaries\Win64\VALORANT-Win64-Shipping.exe'
        if (Test-Path $exe) {
            $result.installed = $true
            $result.dir = $dir
            $result.exe = $exe
            $result.riotDir = Split-Path (Split-Path $dir -Parent) -Parent
            break
        }
    }
    return $result
}

function Get-TRGames {
    return @{ fortnite = (Find-TRFortnite); valorant = (Find-TRValorant) }
}
