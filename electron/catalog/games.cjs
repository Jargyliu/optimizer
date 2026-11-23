'use strict';
const { dword, sz, ps, IFEO } = require('./helpers.cjs');

const FN = 'FortniteClient-Win64-Shipping.exe';
const FN_EAC = 'FortniteClient-Win64-Shipping_EAC_EOS.exe';
const VAL = 'VALORANT-Win64-Shipping.exe';
const NET_ADAPTERS = `Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' }`;

// Per-exe registry values keyed by the game's full path (paths come from $Ctx.games).
function perExeValue({ key, data, merge = false }) {
  return ps({
    apply: `$b = @{ items = @() }
foreach ($g in @($Ctx.games.fortnite, $Ctx.games.valorant)) {
  if (-not $g -or -not $g.installed) { continue }
  $cur = Read-TRRegValue '${key}' $g.exe
  $b.items += @{ name = $g.exe; exists = $cur.exists; value = $cur.value; createdKey = (Get-TRMissingAncestor '${key}') }
  $new = '${data}'
  ${merge ? "if ($cur.exists -and $cur.value -notmatch [regex]::Escape('" + data.replace(/^~ /, '') + "')) { $new = ([string]$cur.value).TrimEnd() + ' ' + '" + data.replace(/^~ /, '') + "' } elseif ($cur.exists) { $new = $cur.value }" : ''}
  Write-TRRegValue '${key}' $g.exe 'String' $new
}
$b`,
    revert: `foreach ($i in @($Backup.items)) {
  if (-not $i) { continue }
  if ($i.exists) { Write-TRRegValue '${key}' $i.name 'String' $i.value }
  else { Remove-TRRegValue '${key}' $i.name; if ($i.createdKey -and (Test-TRRegTreeEmpty $i.createdKey)) { Remove-TRRegKeyTree $i.createdKey } }
}`,
    detect: `$games = @(@($Ctx.games.fortnite, $Ctx.games.valorant) | Where-Object { $_ -and $_.installed })
if ($games.Count -eq 0) { return 'na' }
$ok = $true
foreach ($g in $games) { $v = Read-TRRegValue '${key}' $g.exe; if (-not $v.exists -or ([string]$v.value) -notmatch [regex]::Escape('${data.replace(/^~ /, '')}')) { $ok = $false } }
$ok`,
  });
}

const GAMES_GUARD = `[bool](($Ctx.games.fortnite -and $Ctx.games.fortnite.installed) -or ($Ctx.games.valorant -and $Ctx.games.valorant.installed))`;

module.exports = [
  // ───────────────────────────── Fortnite & VALORANT ─────────────────────────────
  {
    id: 'games.fortnite-priority',
    title: 'Fortnite: High CPU & I/O priority',
    category: 'games',
    summary: 'Starts Fortnite at High CPU priority every launch, so background apps cannot preempt its game thread.',
    description:
      'Uses the Windows "PerfOptions" launch setting (Image File Execution Options) to start Fortnite at High CPU priority. Easy Anti-Cheat blocks I/O priority changes on the game executable itself. EAC\'s bootstrapper (FortniteClient-Win64-Shipping_EAC_EOS.exe) passes its priority on to the game, so it gets High CPU and I/O priority as well. No values are injected into the game process, which is why this is anti-cheat safe.',
    impact: 'medium', risk: 'moderate', evidence: 'situational', reboot: 'none',
    presets: ['competitive', 'extreme'],
    games: ['fortnite'],
    ops: [
      dword(`${IFEO}\\${FN}\\PerfOptions`, 'CpuPriorityClass', 3),
      dword(`${IFEO}\\${FN_EAC}\\PerfOptions`, 'CpuPriorityClass', 3),
      dword(`${IFEO}\\${FN_EAC}\\PerfOptions`, 'IoPriority', 3),
    ],
  },
  {
    id: 'games.valorant-priority',
    title: 'VALORANT: High CPU priority',
    category: 'games',
    summary: 'Starts VALORANT at High CPU priority every launch.',
    description:
      'Uses the same PerfOptions launch setting to give VALORANT-Win64-Shipping.exe High CPU priority. VALORANT is very CPU-bound at high frame rates, so it benefits from not being preempted by Discord, browsers or RGB software. "Realtime" priority is deliberately not used: it can starve input and audio threads and make things worse.',
    impact: 'medium', risk: 'moderate', evidence: 'situational', reboot: 'none',
    presets: ['competitive', 'extreme'],
    games: ['valorant'],
    ops: [dword(`${IFEO}\\${VAL}\\PerfOptions`, 'CpuPriorityClass', 3)],
  },
  {
    id: 'games.gpu-preference',
    title: 'Force games onto the NVIDIA GPU',
    category: 'games',
    summary: 'Sets Windows\' per-app graphics preference to "High performance" for both games.',
    description:
      'Ryzen 7000 and 9000 CPUs include an integrated Radeon GPU. If it is enabled in BIOS, or a monitor is plugged into the motherboard, Windows can pick the wrong adapter or route frames across PCIe, which adds latency. This writes the same per-app "High performance" preference as Settings > Display > Graphics, using the installed game paths it detects.',
    impact: 'medium', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    games: ['fortnite', 'valorant'],
    guard: GAMES_GUARD, guardMessage: 'Neither Fortnite nor VALORANT was found on this PC.',
    ops: [perExeValue({ key: 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences', data: 'GpuPreference=2;' })],
  },
  {
    id: 'games.fso-off',
    title: 'Disable fullscreen optimizations for both games',
    category: 'games',
    summary: 'Ticks "Disable fullscreen optimizations" on the game executables, forcing true exclusive fullscreen.',
    description:
      'Applies the compatibility flag from the exe\'s Properties > Compatibility tab to the detected Fortnite and VALORANT executables. With it set, "Fullscreen" really is exclusive fullscreen instead of a compositor-managed flip window. Some players find input feels more direct, especially in DX11 (VALORANT, Fortnite Performance mode). Alt-tab gets slower. Test it: leave it on if it feels better, revert if not.',
    impact: 'low', risk: 'safe', evidence: 'situational', reboot: 'none',
    presets: ['extreme'],
    games: ['fortnite', 'valorant'],
    guard: GAMES_GUARD, guardMessage: 'Neither Fortnite nor VALORANT was found on this PC.',
    ops: [perExeValue({ key: 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers', data: '~ DISABLEDXMAXIMIZEDWINDOWEDMODE', merge: true })],
  },
  {
    id: 'games.defender-exclusions',
    title: 'Microsoft Defender: exclude game and shader-cache folders',
    category: 'games',
    summary: 'Stops real-time scanning of game files and shader caches while they stream and compile.',
    description:
      'Fortnite streams assets and both games write shader caches during play. Real-time scanning of every read and write adds I/O latency and can turn a shader compile into a visible hitch. This excludes the Fortnite install folder, the Riot Games folder and the DirectX/NVIDIA shader cache folders from real-time scanning only. Full scans still cover them. The trade-off: a malicious file placed in those folders would not be caught on access. Skipped if a third-party antivirus has replaced Defender.',
    impact: 'low', risk: 'moderate', evidence: 'situational', reboot: 'none',
    presets: ['competitive', 'extreme'],
    games: ['fortnite', 'valorant'],
    guard: `try { $null = Get-MpPreference -ErrorAction Stop; (Get-MpComputerStatus -ErrorAction Stop).RealTimeProtectionEnabled } catch { $false }`,
    guardMessage: 'Microsoft Defender real-time protection is not active (another antivirus may be installed).',
    ops: [
      ps({
        apply: `$targets = @("$env:LOCALAPPDATA\\D3DSCache", "$env:LOCALAPPDATA\\NVIDIA\\DXCache")
if ($Ctx.games.fortnite.installed) { $targets += $Ctx.games.fortnite.dir }
if ($Ctx.games.valorant.installed) { $targets += $Ctx.games.valorant.riotDir }
$existing = @((Get-MpPreference).ExclusionPath)
$added = @()
foreach ($t in $targets) { if ($t -and ($existing -notcontains $t)) { Add-MpPreference -ExclusionPath $t; $added += $t } }
@{ added = $added }`,
        revert: `foreach ($t in @($Backup.added)) { if ($t) { Remove-MpPreference -ExclusionPath $t -ErrorAction SilentlyContinue } }`,
        detect: `$ex = @((Get-MpPreference).ExclusionPath)
$need = @("$env:LOCALAPPDATA\\D3DSCache")
if ($Ctx.games.fortnite.installed) { $need += $Ctx.games.fortnite.dir }
if ($Ctx.games.valorant.installed) { $need += $Ctx.games.valorant.riotDir }
@($need | Where-Object { $ex -notcontains $_ }).Count -eq 0`,
      }),
    ],
  },
  {
    id: 'games.qos-dscp',
    title: 'QoS: tag game traffic as high priority (DSCP 46)',
    category: 'network',
    summary: 'Marks Fortnite and VALORANT packets "Expedited Forwarding" so QoS-aware routers send them first.',
    description:
      'Creates Windows QoS policies that tag all traffic from the two game executables with DSCP 46, the same class VoIP uses. Many consumer and gaming routers honour it, sending game packets ahead of downloads and streams when your upload is saturated, which reduces ping spikes. It does nothing on routers that ignore DSCP and is harmless there. Also sets "Do not use NLA" so Windows applies the tags on home (non-domain) networks.',
    impact: 'low', risk: 'safe', evidence: 'situational', reboot: 'none',
    presets: ['competitive', 'extreme'],
    games: ['fortnite', 'valorant'],
    ops: [
      sz('HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\QoS', 'Do not use NLA', '1'),
      ps({
        apply: `foreach ($p in @(@('Tickrate-Fortnite','${FN}'), @('Tickrate-Valorant','${VAL}'))) {
  Remove-NetQosPolicy -Name $p[0] -Confirm:$false -ErrorAction SilentlyContinue
  $null = New-NetQosPolicy -Name $p[0] -AppPathNameMatchCondition $p[1] -DSCPAction 46 -NetworkProfile All
}
@{}`,
        revert: `foreach ($n in @('Tickrate-Fortnite','Tickrate-Valorant')) { Remove-NetQosPolicy -Name $n -Confirm:$false -ErrorAction SilentlyContinue }`,
        detect: `@(Get-NetQosPolicy -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Tickrate-*' }).Count -ge 2`,
      }),
    ],
  },

  // ───────────────────────────── Network adapter ─────────────────────────────
  {
    id: 'net.throttling-off',
    title: 'Disable multimedia network throttling',
    category: 'network',
    summary: 'Removes the cap on non-multimedia packet processing that kicks in while audio or video is playing.',
    description:
      'While MMCSS-registered media plays (Discord voice, Spotify, a stream on another monitor), Windows limits non-multimedia network processing to about 10 packets per millisecond. Game traffic stays far below that, so the real-world effect is minimal, but there is no downside on a gaming PC.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'restart',
    presets: ['competitive', 'extreme'],
    ops: [dword('HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile', 'NetworkThrottlingIndex', 0xffffffff, { default: 10 })],
  },
  {
    id: 'net.adapter-power-saving-off',
    title: 'Disable network adapter power saving',
    category: 'network',
    summary: 'Turns off Energy-Efficient Ethernet, Green Ethernet and "allow the computer to turn off this device" on active adapters.',
    description:
      'Energy-Efficient Ethernet (802.3az) and vendor equivalents (Green Ethernet, Advanced EEE, Gigabit Lite, power saving mode) put the link into low-power idle between packets. Waking it adds microseconds to milliseconds of jitter, and some Realtek and Intel controllers drop packets during transitions. This disables those features plus Windows\' device power-off on every connected physical adapter. Original values are saved and restored on revert. The adapter resets once, so expect a few seconds of disconnect.',
    impact: 'medium', risk: 'safe', evidence: 'situational', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    warning: 'Your network connection will drop for a few seconds while adapters reset.',
    ops: [
      ps({
        apply: `$kw = @('*EEE','EEELinkAdvertisement','AdvancedEEE','EnableGreenEthernet','GigaLite','PowerSavingMode','ReduceSpeedOnPowerDown','ULPMode','EnablePowerManagement','AutoPowerSaveModeEnabled','*SelectiveSuspend')
$b = @{ props = @(); pm = @() }
foreach ($a in @(${NET_ADAPTERS})) {
  foreach ($k in $kw) {
    $prop = Get-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword $k -ErrorAction SilentlyContinue
    if ($prop -and [string]($prop.RegistryValue | Select-Object -First 1) -ne '0') {
      $b.props += @{ adapter = $a.Name; keyword = $k; value = [string]($prop.RegistryValue | Select-Object -First 1) }
      Set-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword $k -RegistryValue 0 -ErrorAction SilentlyContinue
    }
  }
  $pm = Get-NetAdapterPowerManagement -Name $a.Name -ErrorAction SilentlyContinue
  if ($pm -and [string]$pm.AllowComputerToTurnOffDevice -eq 'Enabled') {
    $b.pm += $a.Name
    Set-NetAdapterPowerManagement -Name $a.Name -AllowComputerToTurnOffDevice Disabled -ErrorAction SilentlyContinue
  }
}
$b`,
        revert: `foreach ($p in @($Backup.props)) { if ($p) { Set-NetAdapterAdvancedProperty -Name $p.adapter -RegistryKeyword $p.keyword -RegistryValue $p.value -ErrorAction SilentlyContinue } }
foreach ($n in @($Backup.pm)) { if ($n) { Set-NetAdapterPowerManagement -Name $n -AllowComputerToTurnOffDevice Enabled -ErrorAction SilentlyContinue } }`,
        detect: `$kw = @('*EEE','EEELinkAdvertisement','AdvancedEEE','EnableGreenEthernet','GigaLite','PowerSavingMode','ReduceSpeedOnPowerDown','ULPMode','EnablePowerManagement','AutoPowerSaveModeEnabled','*SelectiveSuspend')
$ads = @(${NET_ADAPTERS})
if ($ads.Count -eq 0) { return 'na' }
foreach ($a in $ads) {
  foreach ($k in $kw) { $p = Get-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword $k -ErrorAction SilentlyContinue; if ($p -and [string]($p.RegistryValue | Select-Object -First 1) -ne '0') { return $false } }
  $pm = Get-NetAdapterPowerManagement -Name $a.Name -ErrorAction SilentlyContinue
  if ($pm -and [string]$pm.AllowComputerToTurnOffDevice -eq 'Enabled') { return $false }
}
$true`,
      }),
    ],
  },
  {
    id: 'net.interrupt-moderation-off',
    title: 'Disable NIC interrupt moderation',
    category: 'network',
    summary: 'Makes the network card raise an interrupt for each packet instead of batching them.',
    description:
      'Interrupt moderation, also called interrupt coalescing, holds incoming packets for a few dozen to a few hundred microseconds so the CPU handles them in batches. Disabling it delivers each game packet to Windows immediately. That lowers network-path latency and jitter at the cost of more interrupts, which a modern Ryzen absorbs easily at game packet rates. Avoid it if you regularly saturate 2.5/10 GbE for big transfers. The adapter resets once.',
    impact: 'low', risk: 'moderate', evidence: 'situational', reboot: 'none',
    presets: ['competitive', 'extreme'],
    warning: 'Your network connection will drop for a few seconds while adapters reset.',
    ops: [
      ps({
        apply: `$b = @{ props = @() }
foreach ($a in @(${NET_ADAPTERS})) {
  $prop = Get-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword '*InterruptModeration' -ErrorAction SilentlyContinue
  if ($prop -and [string]($prop.RegistryValue | Select-Object -First 1) -ne '0') {
    $b.props += @{ adapter = $a.Name; value = [string]($prop.RegistryValue | Select-Object -First 1) }
    Set-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword '*InterruptModeration' -RegistryValue 0 -ErrorAction SilentlyContinue
  }
}
$b`,
        revert: `foreach ($p in @($Backup.props)) { if ($p) { Set-NetAdapterAdvancedProperty -Name $p.adapter -RegistryKeyword '*InterruptModeration' -RegistryValue $p.value -ErrorAction SilentlyContinue } }`,
        detect: `$found = $false
foreach ($a in @(${NET_ADAPTERS})) {
  $p = Get-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword '*InterruptModeration' -ErrorAction SilentlyContinue
  if ($p) { $found = $true; if ([string]($p.RegistryValue | Select-Object -First 1) -ne '0') { return $false } }
}
if (-not $found) { return 'na' }
$true`,
      }),
    ],
  },
];
