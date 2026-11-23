'use strict';
const { dword, sz, svc, ps, IFEO } = require('./helpers.cjs');

const VCACHE = 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\amd3dvcache\\Preferences';
const VCACHE_GUARD = `Test-TRRegKey '${VCACHE}'`;
const NVIDIA_GUARD = `[bool](Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match 'NVIDIA' })`;

// powercfg GUIDs for settings that have no stable alias
const USB_SUB = '2a737441-1930-4402-8d77-b2bebba308a3';
const USB_SUSPEND = '48e6b7a6-50f5-4782-a5d4-53bb8f07e226';
const PCIE_SUB = '501a4d13-42af-4429-9fd1-a8218c268e20';
const PCIE_ASPM = 'ee12f906-d277-404b-b6da-e5fa1a576df5';
const WIFI_SUB = '19cbb8fa-5279-450e-9fac-8a3d5fedd0c1';
const WIFI_PS = '12bbebe6-58d6-4636-95bb-3217ef867c1a';
const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';
const HIGHPERF = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const PLAN_NAME = 'Tickrate Low Latency';

// Shared PowerShell snippets for the power-plan tweaks
const PS_ACTIVE = `function Get-TRActiveScheme { $o = (& powercfg.exe /getactivescheme) -join ' '; if ($o -match '([0-9a-fA-F-]{36})') { return $Matches[1].ToLowerInvariant() }; return $null }`;
const PS_FIND_PLAN = `function Get-TRPlanByName([string]$n) { foreach ($l in (& powercfg.exe /list)) { if ($l -match '([0-9a-fA-F-]{36})\\s+\\((.+?)\\)') { if ($Matches[2] -eq $n) { return $Matches[1].ToLowerInvariant() } } }; return $null }`;
const PS_QUERY = `function Get-TRPowerIndex([string]$scheme, [string]$sub, [string]$setting) {
  $o = (& powercfg.exe /query $scheme $sub $setting) -join "\`n"
  $m = [regex]::Matches($o, ':\\s*0x([0-9a-fA-F]{8})')
  if ($m.Count -lt 2) { return $null }
  return @{ ac = [Convert]::ToInt32($m[$m.Count - 2].Groups[1].Value, 16); dc = [Convert]::ToInt32($m[$m.Count - 1].Groups[1].Value, 16) }
}
function Set-TRPowerIndex([string]$scheme, [string]$sub, [string]$setting, [int]$ac, [int]$dc) {
  & powercfg.exe /setacvalueindex $scheme $sub $setting $ac | Out-Null
  & powercfg.exe /setdcvalueindex $scheme $sub $setting $dc | Out-Null
}`;

module.exports = [
  // ───────────────────────────── Ryzen X3D ─────────────────────────────
  {
    id: 'x3d.prefer-cache-games',
    title: 'Pin Fortnite & VALORANT to the V-Cache CCD',
    category: 'x3d',
    summary: 'Tells AMD\'s 3D V-Cache driver to always schedule both games on the cache CCD of a dual-CCD X3D CPU.',
    description:
      'On a 7900X3D, 7950X3D, 9900X3D or 9950X3D only one of the two CCDs has the 3D V-Cache. AMD\'s amd3dvcache driver decides per app whether to prefer the cache CCD or the higher-clocked one, and its automatic detection can miss a game. This adds per-app "prefer cache" entries for FortniteClient-Win64-Shipping.exe and VALORANT-Win64-Shipping.exe, the same interface AMD3DConfigurator and vcache-tray use, then restarts the V-Cache service. Both games are latency-bound and benefit heavily from the extra L3. Requires the AMD chipset driver with the 3D V-Cache Performance Optimizer.',
    impact: 'high', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    cpu: ['x3d-dual'],
    guard: VCACHE_GUARD,
    guardMessage: 'AMD 3D V-Cache Performance Optimizer driver not found. Install the latest AMD chipset driver.',
    ops: [
      ps({ revert: `Restart-Service -Name amd3dvcacheSvc -Force -ErrorAction SilentlyContinue` }),
      sz(`${VCACHE}\\App\\Tickrate_Fortnite`, 'EndsWith', 'FortniteClient-Win64-Shipping.exe'),
      dword(`${VCACHE}\\App\\Tickrate_Fortnite`, 'Type', 1),
      sz(`${VCACHE}\\App\\Tickrate_Valorant`, 'EndsWith', 'VALORANT-Win64-Shipping.exe'),
      dword(`${VCACHE}\\App\\Tickrate_Valorant`, 'Type', 1),
      ps({ apply: `Restart-Service -Name amd3dvcacheSvc -Force -ErrorAction SilentlyContinue` }),
    ],
  },
  {
    id: 'x3d.dual-ccd-balanced-plan',
    title: 'X3D dual-CCD: tuned Balanced power plan',
    category: 'power',
    summary: 'Keeps the stock Balanced plan that AMD\'s core parking requires, and removes only its USB, PCIe and disk power saving.',
    description:
      'Dual-CCD X3D chips depend on the Windows Balanced plan: AMD\'s driver parks the non-cache CCD through Balanced\'s core-parking policy while Game Mode is active. High Performance, Ultimate Performance and most "gaming" power plans disable parking, so games spread across both CCDs and lose the V-Cache benefit. This activates the stock Balanced plan and changes only settings that do not touch the CPU. USB selective suspend is turned off (mouse and keyboard never sleep), PCIe link-state power management is turned off (the GPU link stays at full speed), and disk sleep is set to never. Processor settings stay at AMD\'s defaults on purpose.',
    impact: 'high', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    cpu: ['x3d-dual'],
    ops: [
      ps({
        apply: `${PS_ACTIVE}
${PS_QUERY}
$bal = '${BALANCED}'
$b = @{ previous = (Get-TRActiveScheme); values = @{} }
foreach ($s in @(@('${USB_SUB}','${USB_SUSPEND}'), @('${PCIE_SUB}','${PCIE_ASPM}'), @('SUB_DISK','DISKIDLE'), @('${WIFI_SUB}','${WIFI_PS}'))) {
  $cur = Get-TRPowerIndex $bal $s[0] $s[1]
  if ($null -ne $cur) { $b.values[$s[0] + '|' + $s[1]] = $cur; Set-TRPowerIndex $bal $s[0] $s[1] 0 0 }
}
& powercfg.exe /setactive $bal | Out-Null
$b`,
        revert: `${PS_QUERY}
$bal = '${BALANCED}'
if ($Backup -and $Backup.values) {
  foreach ($k in $Backup.values.Keys) { $p = $k.Split('|'); Set-TRPowerIndex $bal $p[0] $p[1] ([int]$Backup.values[$k].ac) ([int]$Backup.values[$k].dc) }
}
if ($Backup -and $Backup.previous) { & powercfg.exe /setactive $Backup.previous | Out-Null }`,
        detect: `${PS_ACTIVE}
${PS_QUERY}
$bal = '${BALANCED}'
if ((Get-TRActiveScheme) -ne $bal) { return $false }
$u = Get-TRPowerIndex $bal '${USB_SUB}' '${USB_SUSPEND}'
$p = Get-TRPowerIndex $bal '${PCIE_SUB}' '${PCIE_ASPM}'
($u -and $u.ac -eq 0) -and ($p -and $p.ac -eq 0)`,
      }),
    ],
  },
  {
    id: 'x3d.keep-game-bar',
    title: 'X3D dual-CCD: keep Xbox Game Bar game detection working',
    category: 'x3d',
    summary: 'Makes sure the Game Bar presence writer is not disabled, because AMD\'s CCD parking relies on it.',
    description:
      'Many debloat scripts kill GameBarPresenceWriter or set the GameDVR policy to "off", which breaks Windows\' "this is a game" signal. Without it, a dual-CCD X3D CPU never parks its frequency CCD and the game runs on the wrong cores. This removes those blocks if a previous tool set them. If Xbox Game Bar was uninstalled, reinstall it from the Microsoft Store.',
    impact: 'high', risk: 'safe', evidence: 'proven', reboot: 'signout',
    presets: ['essential', 'competitive', 'extreme'],
    cpu: ['x3d-dual'],
    ops: [
      { op: 'reg', path: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR', name: 'AllowGameDVR', delete: true },
      ps({
        apply: `$p = 'HKLM\\SOFTWARE\\Microsoft\\WindowsRuntime\\ActivatableClassId\\Windows.Gaming.GameBar.PresenceServer.Internal.PresenceWriter'
$v = Read-TRRegValue $p 'ActivationType'
if ($v.exists -and [int64]$v.value -ne 1) {
  try { Write-TRRegValue $p 'ActivationType' 'DWord' 1 } catch { Write-TRLog "  Could not re-enable the Game Bar presence writer (key is owned by TrustedInstaller): $($_.Exception.Message)" }
  return @{ previous = $v.value }
}
@{}`,
        revert: `if ($Backup -and $null -ne $Backup.previous) { try { Write-TRRegValue 'HKLM\\SOFTWARE\\Microsoft\\WindowsRuntime\\ActivatableClassId\\Windows.Gaming.GameBar.PresenceServer.Internal.PresenceWriter' 'ActivationType' 'DWord' $Backup.previous } catch { } }`,
        detect: `$v = Read-TRRegValue 'HKLM\\SOFTWARE\\Microsoft\\WindowsRuntime\\ActivatableClassId\\Windows.Gaming.GameBar.PresenceServer.Internal.PresenceWriter' 'ActivationType'; (-not $v.exists) -or [int64]$v.value -eq 1`,
      }),
    ],
  },

  // ───────────────────────────── Power ─────────────────────────────
  {
    id: 'power.low-latency-plan',
    title: 'Tickrate Low Latency power plan',
    category: 'power',
    summary: 'A High Performance-based plan with core parking off, aggressive boost, and no USB or PCIe power saving.',
    description:
      'For single-CCD X3D (5800X3D, 5700X3D, 7800X3D, 9800X3D) and other CPUs. Duplicates High Performance into a "Tickrate Low Latency" plan and activates it, with these changes. Minimum processor state 100% and energy-performance preference 0, so CPPC requests full speed immediately. Core parking off, so a waking thread never lands on a sleeping core. Aggressive boost. USB selective suspend off, PCIe ASPM off, disk sleep never, Wi-Fi maximum performance. C-states stay enabled on purpose: disabling idle makes X3D chips run hot, which lowers their boost clocks. Not offered on dual-CCD X3D CPUs, which need the Balanced plan for CCD parking.',
    impact: 'high', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    cpu: ['x3d-single', 'ryzen', 'other'],
    ops: [
      ps({
        apply: `${PS_ACTIVE}
${PS_FIND_PLAN}
${PS_QUERY}
$name = '${PLAN_NAME}'
$active = Get-TRActiveScheme
$g = Get-TRPlanByName $name
$b = @{ previous = $active }
if ($g -and $active -eq $g) { $b.previous = '${BALANCED}' }
if (-not $g) {
  $out = (& powercfg.exe /duplicatescheme ${HIGHPERF}) -join ' '
  if ($out -notmatch '([0-9a-fA-F-]{36})') { $out = (& powercfg.exe /duplicatescheme ${BALANCED}) -join ' ' }
  if ($out -notmatch '([0-9a-fA-F-]{36})') { throw "Could not create the power plan: $out" }
  $g = $Matches[1]
  & powercfg.exe /changename $g $name 'Created by Tickrate: no core parking, aggressive boost, no USB/PCIe power saving.' | Out-Null
}
foreach ($s in @(
  @('SUB_PROCESSOR','PROCTHROTTLEMIN',100), @('SUB_PROCESSOR','PROCTHROTTLEMAX',100), @('SUB_PROCESSOR','CPMINCORES',100),
  @('SUB_PROCESSOR','PERFBOOSTMODE',2), @('SUB_PROCESSOR','PERFEPP',0), @('SUB_DISK','DISKIDLE',0),
  @('${USB_SUB}','${USB_SUSPEND}',0), @('${PCIE_SUB}','${PCIE_ASPM}',0), @('${WIFI_SUB}','${WIFI_PS}',0))) {
  Set-TRPowerIndex $g $s[0] $s[1] $s[2] $s[2]
}
& powercfg.exe /setactive $g | Out-Null
$b`,
        revert: `${PS_FIND_PLAN}
$target = '${BALANCED}'
if ($Backup -and $Backup.previous) { $target = $Backup.previous }
& powercfg.exe /setactive $target | Out-Null
if ($LASTEXITCODE -ne 0) { & powercfg.exe /setactive ${BALANCED} | Out-Null }
$g = Get-TRPlanByName '${PLAN_NAME}'
while ($g) { & powercfg.exe /delete $g | Out-Null; $next = Get-TRPlanByName '${PLAN_NAME}'; if ($next -eq $g) { break }; $g = $next }`,
        detect: `${PS_ACTIVE}
${PS_FIND_PLAN}
$g = Get-TRPlanByName '${PLAN_NAME}'
[bool]$g -and ((Get-TRActiveScheme) -eq $g)`,
      }),
    ],
  },

  // ───────────────────────────── NVIDIA & graphics ─────────────────────────────
  {
    id: 'gpu.msi-mode',
    title: 'Ensure MSI interrupts on the NVIDIA GPU',
    category: 'gpu',
    summary: 'Makes the GPU use Message Signaled Interrupts instead of legacy shared line interrupts.',
    description:
      'With line-based interrupts, the GPU can share an IRQ with other devices, and interrupt handling takes a slower path, which shows up as higher DPC latency. RTX 40 and 50 series cards normally enable MSI already, but driver reinstalls, older cards and some DDU cleanups leave it off. This sets MSISupported=1 for every NVIDIA display adapter. It is the GPU tweak with the strongest community measurements behind it. Interrupt priority overrides are left alone because they are obsolete on modern Windows.',
    impact: 'medium', risk: 'safe', evidence: 'proven', reboot: 'restart',
    presets: ['essential', 'competitive', 'extreme'],
    guard: NVIDIA_GUARD,
    guardMessage: 'No NVIDIA GPU detected.',
    ops: [
      ps({
        apply: `$b = @{ devices = @() }
foreach ($d in @(Get-PnpDevice -Class Display -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match 'NVIDIA' })) {
  $p = "HKLM\\SYSTEM\\CurrentControlSet\\Enum\\$($d.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"
  $cur = Read-TRRegValue $p 'MSISupported'
  $b.devices += @{ path = $p; exists = $cur.exists; value = $cur.value; createdKey = (Get-TRMissingAncestor $p) }
  Write-TRRegValue $p 'MSISupported' 'DWord' 1
}
$b`,
        revert: `foreach ($d in @($Backup.devices)) {
  if (-not $d) { continue }
  if ($d.exists) { Write-TRRegValue $d.path 'MSISupported' 'DWord' $d.value }
  else { Remove-TRRegValue $d.path 'MSISupported'; if ($d.createdKey -and (Test-TRRegTreeEmpty $d.createdKey)) { Remove-TRRegKeyTree $d.createdKey } }
}`,
        detect: `$devs = @(Get-PnpDevice -Class Display -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match 'NVIDIA' })
if ($devs.Count -eq 0) { return 'na' }
$ok = $true
foreach ($d in $devs) { $v = Read-TRRegValue "HKLM\\SYSTEM\\CurrentControlSet\\Enum\\$($d.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties" 'MSISupported'; if (-not ($v.exists -and [int64]$v.value -eq 1)) { $ok = $false } }
$ok`,
      }),
    ],
  },
  {
    id: 'gpu.nvidia-telemetry-off',
    title: 'Disable NVIDIA telemetry',
    category: 'gpu',
    summary: 'Opts out of NVIDIA driver telemetry and disables its scheduled reporting tasks.',
    description:
      'Opts out of NVIDIA\'s usage data collection, sets the driver\'s feature-telemetry flags to off, and disables the NvTm* crash and usage reporting scheduled tasks and the legacy NvTelemetryContainer service where present. Removes periodic background wake-ups. It has no effect on driver features such as Reflex, G-SYNC or DLSS.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    guard: NVIDIA_GUARD,
    guardMessage: 'No NVIDIA GPU detected.',
    ops: [
      dword('HKLM\\SOFTWARE\\NVIDIA Corporation\\NvControlPanel2\\Client', 'OptInOrOutPreference', 0),
      dword('HKLM\\SOFTWARE\\NVIDIA Corporation\\Global\\FTS', 'EnableRID44231', 0),
      dword('HKLM\\SOFTWARE\\NVIDIA Corporation\\Global\\FTS', 'EnableRID64640', 0),
      dword('HKLM\\SOFTWARE\\NVIDIA Corporation\\Global\\FTS', 'EnableRID66610', 0),
      svc('NvTelemetryContainer', 'Disabled', 'Automatic'),
      ps({
        apply: `$b = @{ enabled = @() }
foreach ($t in @(Get-ScheduledTask -TaskName 'NvTm*' -ErrorAction SilentlyContinue)) {
  if ($t.State -ne 'Disabled') { $b.enabled += ($t.TaskPath + '|' + $t.TaskName); $null = $t | Disable-ScheduledTask -ErrorAction SilentlyContinue }
}
$b`,
        revert: `foreach ($e in @($Backup.enabled)) { if (-not $e) { continue }; $p = $e.Split('|'); $null = Enable-ScheduledTask -TaskPath $p[0] -TaskName $p[1] -ErrorAction SilentlyContinue }`,
        detect: `$t = @(Get-ScheduledTask -TaskName 'NvTm*' -ErrorAction SilentlyContinue)
if ($t.Count -eq 0) { return 'na' }
@($t | Where-Object { $_.State -ne 'Disabled' }).Count -eq 0`,
      }),
    ],
  },
  {
    id: 'gpu.energy-driver-off',
    title: 'Disable GPU energy tracking driver',
    category: 'gpu',
    summary: 'Stops the GpuEnergyDrv kernel driver that feeds Task Manager\'s GPU power estimates.',
    description:
      'GpuEnergyDrv is a small kernel driver that samples GPU activity so Windows can estimate per-app power use for battery reports. A desktop gains nothing from it. The only visible change is that Task Manager stops showing GPU "power usage" columns.',
    impact: 'low', risk: 'moderate', evidence: 'minor', reboot: 'restart',
    presets: ['extreme'],
    ops: [svc('GpuEnergyDrv', 'Disabled', 'System')],
  },
];
