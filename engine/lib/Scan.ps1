# PC scanner: collects raw facts. Findings/score are computed by the UI (src/lib/findings.ts)
# so the rules are easy to read and test.

function Invoke-TRSafe {
    param([scriptblock]$Block, $Fallback = $null)
    try { return (& $Block) } catch { Write-TRLog "scan: $($_.Exception.Message)"; return $Fallback }
}

function Get-TRCpuClass {
    param([string]$Name)
    if ($Name -notmatch 'AMD') { return 'other' }
    if ($Name -match '(\d{4})X3D') {
        $model = $Matches[1]
        if ($model.Substring(1, 1) -eq '9') { return 'x3d-dual' }   # Ryzen 9 X3D parts have two CCDs
        return 'x3d-single'
    }
    if ($Name -match 'HX3D') { return 'x3d-dual' }                # mobile Ryzen 9 HX3D
    return 'ryzen'
}

$script:DisplayTypeAdded = $false
function Get-TRDisplays {
    if (-not $script:DisplayTypeAdded) {
        Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class TRDisplay {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra;
        public int dmFields; public int dmPositionX; public int dmPositionY; public int dmDisplayOrientation; public int dmDisplayFixedOutput;
        public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public short dmLogPixels; public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight;
        public int dmDisplayFlags; public int dmDisplayFrequency; public int dmICMMethod; public int dmICMIntent;
        public int dmMediaType; public int dmDitherType; public int dmReserved1; public int dmReserved2;
        public int dmPanningWidth; public int dmPanningHeight;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DISPLAY_DEVICE {
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);
    public static List<string[]> Query() {
        var list = new List<string[]>();
        for (uint i = 0; i < 16; i++) {
            var dd = new DISPLAY_DEVICE(); dd.cb = Marshal.SizeOf(dd);
            if (!EnumDisplayDevices(null, i, ref dd, 0)) break;
            if ((dd.StateFlags & 1) == 0) continue; // not attached to desktop
            var cur = new DEVMODE(); cur.dmSize = (short)Marshal.SizeOf(cur);
            if (!EnumDisplaySettings(dd.DeviceName, -1, ref cur)) continue;
            int max = cur.dmDisplayFrequency;
            var m = new DEVMODE(); m.dmSize = (short)Marshal.SizeOf(m);
            for (int n = 0; EnumDisplaySettings(dd.DeviceName, n, ref m); n++) {
                if (m.dmPelsWidth == cur.dmPelsWidth && m.dmPelsHeight == cur.dmPelsHeight && m.dmDisplayFrequency > max) max = m.dmDisplayFrequency;
            }
            list.Add(new string[] { dd.DeviceName, dd.DeviceString, cur.dmPelsWidth.ToString(), cur.dmPelsHeight.ToString(), cur.dmDisplayFrequency.ToString(), max.ToString(), ((dd.StateFlags & 4) != 0).ToString() });
        }
        return list;
    }
}
'@
        $script:DisplayTypeAdded = $true
    }
    $out = @()
    foreach ($d in [TRDisplay]::Query()) {
        $out += @{ device = $d[0]; adapter = $d[1]; width = [int]$d[2]; height = [int]$d[3]; refresh = [int]$d[4]; maxRefresh = [int]$d[5]; primary = ($d[6] -eq 'True') }
    }
    return ,$out
}

function Get-TRNvidiaSmi {
    $smi = Join-Path $env:SystemRoot 'System32\nvidia-smi.exe'
    if (-not (Test-Path $smi)) { return $null }
    $fields = 'name,driver_version,pcie.link.gen.max,pcie.link.width.max,pcie.link.gen.current,pcie.link.width.current,temperature.gpu,memory.total,power.draw,clocks.max.graphics'
    $line = & $smi "--query-gpu=$fields" '--format=csv,noheader,nounits' 2>$null | Select-Object -First 1
    if (-not $line) { return $null }
    $v = $line.Split(',') | ForEach-Object { $_.Trim() }
    $bar1 = $null
    $mem = & $smi -q -d MEMORY 2>$null
    $inBar = $false
    foreach ($l in $mem) {
        if ($l -match 'BAR1 Memory Usage') { $inBar = $true; continue }
        if ($inBar -and $l -match 'Total\s*:\s*(\d+)\s*MiB') { $bar1 = [int]$Matches[1]; break }
    }
    return @{
        name = $v[0]; driver = $v[1]
        pcieGenMax = $v[2]; pcieWidthMax = $v[3]; pcieGenCur = $v[4]; pcieWidthCur = $v[5]
        tempC = $v[6]; vramMiB = $v[7]; powerW = $v[8]; maxClock = $v[9]
        bar1MiB = $bar1
        rebar = $(if ($bar1) { $bar1 -gt 256 } else { $null })
    }
}

function Get-TRGpuMsi {
    $out = @()
    $devs = Get-PnpDevice -Class Display -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match 'NVIDIA' }
    foreach ($d in $devs) {
        $v = Read-TRRegValue "HKLM\SYSTEM\CurrentControlSet\Enum\$($d.InstanceId)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties" 'MSISupported'
        $out += @{ name = $d.FriendlyName; msi = ($v.exists -and [int64]$v.value -eq 1) }
    }
    return ,$out
}

function Get-TRStartupCount {
    $n = 0
    foreach ($p in @('HKCU\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run')) {
        $k = Open-TRRegKey $p
        if ($k) { $n += $k.ValueCount; $k.Close() }
    }
    foreach ($dir in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))) {
        if ($dir -and (Test-Path $dir)) { $n += @(Get-ChildItem $dir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' }).Count }
    }
    return $n
}

function Get-TRPendingReboot {
    if (Test-Path 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') { return $true }
    if (Test-Path 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { return $true }
    $v = Read-TRRegValue 'HKLM\SYSTEM\CurrentControlSet\Control\Session Manager' 'PendingFileRenameOperations'
    return [bool]$v.exists
}

$script:KnownBackgroundApps = @(
    @{ proc = 'OneDrive'; label = 'OneDrive sync' },
    @{ proc = 'Teams'; label = 'Microsoft Teams' }, @{ proc = 'ms-teams'; label = 'Microsoft Teams' },
    @{ proc = 'msedge'; label = 'Microsoft Edge' },
    @{ proc = 'chrome'; label = 'Google Chrome' },
    @{ proc = 'Spotify'; label = 'Spotify' },
    @{ proc = 'steamwebhelper'; label = 'Steam web helper' },
    @{ proc = 'RazerAppEngine'; label = 'Razer Synapse' }, @{ proc = 'Razer Synapse Service Process'; label = 'Razer Synapse' },
    @{ proc = 'iCUE'; label = 'Corsair iCUE' },
    @{ proc = 'ArmouryCrate'; label = 'ASUS Armoury Crate' }, @{ proc = 'ArmouryCrateControlInterface'; label = 'ASUS Armoury Crate' },
    @{ proc = 'LightingService'; label = 'ASUS Aura lighting' },
    @{ proc = 'SignalRgb'; label = 'SignalRGB' },
    @{ proc = 'NZXT CAM'; label = 'NZXT CAM' },
    @{ proc = 'lghub'; label = 'Logitech G HUB' },
    @{ proc = 'MSIAfterburner'; label = 'MSI Afterburner' },
    @{ proc = 'RTSS'; label = 'RivaTuner Statistics Server' },
    @{ proc = 'Widgets'; label = 'Windows Widgets' },
    @{ proc = 'PhoneExperienceHost'; label = 'Phone Link' },
    @{ proc = 'CompatTelRunner'; label = 'Windows telemetry runner' },
    @{ proc = 'SearchApp'; label = 'Windows Search UI' },
    @{ proc = 'Copilot'; label = 'Copilot' },
    @{ proc = 'WallpaperEngine'; label = 'Wallpaper Engine' }, @{ proc = 'wallpaper64'; label = 'Wallpaper Engine' }
)

function Get-TRScan {
    $facts = @{ scannedAt = (Get-Date).ToString('o') }

    $facts.os = Invoke-TRSafe {
        $os = Get-CimInstance Win32_OperatingSystem
        $cv = Get-ItemProperty 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
        $uptime = (Get-Date) - $os.LastBootUpTime
        @{
            caption = $os.Caption; build = [int]$cv.CurrentBuild; ubr = $cv.UBR; displayVersion = $cv.DisplayVersion
            edition = $cv.EditionID; uptimeHours = [math]::Round($uptime.TotalHours, 1)
            pendingReboot = (Get-TRPendingReboot)
        }
    } @{}

    $facts.cpu = Invoke-TRSafe {
        $c = Get-CimInstance Win32_Processor | Select-Object -First 1
        $name = ($c.Name -replace '\s+', ' ').Trim()
        @{ name = $name; cores = $c.NumberOfCores; threads = $c.NumberOfLogicalProcessors; maxMHz = $c.MaxClockSpeed; class = (Get-TRCpuClass $name)
           vcacheDriver = [bool](Get-Service -Name 'amd3dvcacheSvc' -ErrorAction SilentlyContinue)
           vcacheDefaultType = $(
               $v = Read-TRRegValue 'HKLM\SYSTEM\CurrentControlSet\Services\amd3dvcache\Preferences' 'DefaultType'
               if ($v.exists) { $v.value } else { $null }) }
    } @{ class = 'other' }

    # @() keeps one-item lists as JSON arrays (PowerShell unrolls single-element arrays)
    $facts.gpus = @(Invoke-TRSafe {
        $list = @()
        foreach ($g in Get-CimInstance Win32_VideoController) {
            $list += @{ name = $g.Name; driver = $g.DriverVersion; driverDate = $(if ($g.DriverDate) { $g.DriverDate.ToString('yyyy-MM-dd') } else { $null }); vendor = $(if ($g.Name -match 'NVIDIA') { 'nvidia' } elseif ($g.Name -match 'AMD|Radeon') { 'amd' } elseif ($g.Name -match 'Intel') { 'intel' } else { 'other' }) }
        }
        ,$list
    } @())
    $facts.nvidia = Invoke-TRSafe { Get-TRNvidiaSmi }
    $facts.gpuMsi = @(Invoke-TRSafe { Get-TRGpuMsi } @())

    $facts.memory = Invoke-TRSafe {
        $mods = @(Get-CimInstance Win32_PhysicalMemory)
        $total = ($mods | Measure-Object -Property Capacity -Sum).Sum
        $type = $null
        $t = ($mods | Select-Object -First 1).SMBIOSMemoryType
        if ($t -eq 34) { $type = 'DDR5' } elseif ($t -eq 26) { $type = 'DDR4' }
        @{ totalGB = [math]::Round($total / 1GB); modules = $mods.Count; type = $type
           ratedMTs = ($mods | Measure-Object -Property Speed -Maximum).Maximum
           configuredMTs = ($mods | Measure-Object -Property ConfiguredClockSpeed -Minimum).Minimum }
    } @{}

    $facts.displays = @(Invoke-TRSafe { Get-TRDisplays } @())

    $facts.storage = Invoke-TRSafe {
        $sys = Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':'))
        $disks = @()
        foreach ($d in Get-PhysicalDisk -ErrorAction SilentlyContinue) {
            $disks += @{ name = $d.FriendlyName; media = [string]$d.MediaType; bus = [string]$d.BusType; sizeGB = [math]::Round($d.Size / 1GB) }
        }
        @{ systemFreeGB = [math]::Round($sys.Free / 1GB, 1); systemTotalGB = [math]::Round(($sys.Free + $sys.Used) / 1GB); disks = @($disks) }
    } @{}

    $facts.security = Invoke-TRSafe {
        $sb = $null; try { $sb = Confirm-SecureBootUEFI -ErrorAction Stop } catch { $sb = $null }
        $tpm = $null; try { $t = Get-Tpm -ErrorAction Stop; $tpm = @{ present = $t.TpmPresent; ready = $t.TpmReady } } catch { }
        $dg = $null; try { $dg = Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard -ErrorAction Stop } catch { }
        $bl = $null
        try {
            $vol = Get-CimInstance -Namespace root\CIMV2\Security\MicrosoftVolumeEncryption -ClassName Win32_EncryptableVolume -Filter "DriveLetter='$env:SystemDrive'" -ErrorAction Stop
            if ($vol) { $bl = ($vol.ProtectionStatus -eq 1) }
        } catch { }
        @{
            secureBoot = $sb; tpm = $tpm; bitlocker = $bl
            vbsRunning = $(if ($dg) { $dg.VirtualizationBasedSecurityStatus -eq 2 } else { $null })
            hvciRunning = $(if ($dg) { @($dg.SecurityServicesRunning) -contains 2 } else { $null })
        }
    } @{}

    $facts.settings = Invoke-TRSafe {
        $r = { param($p, $n) $v = Read-TRRegValue $p $n; if ($v.exists) { $v.value } else { $null } }
        $scheme = (& powercfg.exe /getactivescheme) -join ' '
        $guid = $null; $schemeName = $null
        if ($scheme -match '([0-9a-fA-F-]{36})\s*\((.+)\)') { $guid = $Matches[1]; $schemeName = $Matches[2] }
        $bcd = Get-TRBcdValues
        @{
            gameMode = (& $r 'HKCU\Software\Microsoft\GameBar' 'AutoGameModeEnabled')
            gameDvr = (& $r 'HKCU\System\GameConfigStore' 'GameDVR_Enabled')
            appCapture = (& $r 'HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled')
            hags = (& $r 'HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode')
            mouseSpeed = (& $r 'HKCU\Control Panel\Mouse' 'MouseSpeed')
            globalTimer = (& $r 'HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' 'GlobalTimerResolutionRequests')
            fastStartup = (& $r 'HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled')
            powerThrottlingOff = (& $r 'HKLM\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling' 'PowerThrottlingOff')
            powerScheme = $guid; powerSchemeName = $schemeName
            useplatformclock = $bcd['useplatformclock']
            gameBarInstalled = [bool](Get-AppxPackage -Name 'Microsoft.XboxGamingOverlay' -ErrorAction SilentlyContinue)
        }
    } @{}

    $facts.software = Invoke-TRSafe {
        $procs = Get-Process -ErrorAction SilentlyContinue
        $names = $procs | ForEach-Object { $_.ProcessName }
        $bg = @()
        foreach ($k in $script:KnownBackgroundApps) {
            if (($names -contains $k.proc) -and ($bg -notcontains $k.label)) { $bg += $k.label }
        }
        @{ processCount = $procs.Count; startupCount = (Get-TRStartupCount); backgroundApps = @($bg) }
    } @{}

    $facts.games = Invoke-TRSafe { Get-TRGames } @{}
    $facts.appliedTweaks = @((Get-TRState).tweaks.Keys)
    return $facts
}
