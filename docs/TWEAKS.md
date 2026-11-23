# Tweak reference

> Generated from `electron/catalog/` by `npm run docs`. Do not edit by hand.

56 tweaks in 12 categories. Every change is backed up before it is made and can be reverted individually.

**Impact** is the expected effect on input latency or frame pacing. **Risk** describes the trade-off: *safe* has none worth mentioning, *moderate* has a documented trade-off, *advanced* needs care. **Evidence** says how solid the case for the tweak is.

| Preset | Tweaks |
|---|---|
| Essential | 28 |
| Competitive | 45 |
| Everything | 53 |

## Contents

- [Input & mouse](#input--mouse)
- [Scheduler & timers](#scheduler--timers)
- [Ryzen X3D](#ryzen-x3d)
- [Power plan](#power-plan)
- [NVIDIA & graphics](#nvidia--graphics)
- [Windows gaming](#windows-gaming)
- [Fortnite & VALORANT](#fortnite--valorant)
- [Network](#network)
- [Background apps](#background-apps)
- [Privacy & telemetry](#privacy--telemetry)
- [Windows Update](#windows-update)
- [Services](#services)
- [Left out on purpose](#left-out-on-purpose)

## Input & mouse

Make the desktop and menus feel like raw input.

### Disable mouse acceleration

`input.mouse-acceleration-off` · impact **high** · risk **safe** · evidence *measurable* · after applying: sign out · presets: Essential, Competitive, Everything

Windows scales cursor speed by how fast you move the mouse ("Enhance pointer precision"). That makes flicks inconsistent: the same physical distance lands on a different spot depending on speed. Both Fortnite and VALORANT read raw input in matches, but menus, the buy phase, the inventory, the Epic and Riot launchers and anything windowed still use the Windows pointer. This sets the acceleration curve thresholds to zero so the desktop matches your in-game feel.

What changes:

- Registry `HKCU\Control Panel\Mouse` → `MouseSpeed` = `"0"` (String)
- Registry `HKCU\Control Panel\Mouse` → `MouseThreshold1` = `"0"` (String)
- Registry `HKCU\Control Panel\Mouse` → `MouseThreshold2` = `"0"` (String)

### Set Windows pointer speed to 6/11

`input.pointer-speed-default` · impact **low** · risk **safe** · evidence *measurable* · after applying: sign out · presets: Competitive, Everything

The middle notch (6 of 11) is the only Windows pointer speed that does not multiply or drop mouse counts. Anything else skips pixels or adds interpolation on the desktop. Change sensitivity with mouse DPI and in-game sensitivity instead.

What changes:

- Registry `HKCU\Control Panel\Mouse` → `MouseSensitivity` = `"10"` (String)

### Disable Sticky / Filter / Toggle Keys hotkeys

`input.accessibility-shortcuts-off` · impact **medium** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything

Pressing Shift five times (crouch-spam, building edits) or holding right Shift opens an accessibility dialog that steals focus from the game. This disables only the keyboard shortcuts. The features themselves stay available in Settings > Accessibility.

What changes:

- Registry `HKCU\Control Panel\Accessibility\StickyKeys` → `Flags` = `"506"` (String)
- Registry `HKCU\Control Panel\Accessibility\ToggleKeys` → `Flags` = `"58"` (String)
- Registry `HKCU\Control Panel\Accessibility\Keyboard Response` → `Flags` = `"122"` (String)

### Fastest keyboard repeat rate

`input.keyboard-repeat-fast` · impact **low** · risk **safe** · evidence *quality of life* · after applying: sign out · presets: Everything

Shortens the delay before a held key starts repeating and raises the repeat rate to the maximum Windows allows. Mostly a desktop and chat quality-of-life change. Games that poll key state directly are not affected.

What changes:

- Registry `HKCU\Control Panel\Keyboard` → `KeyboardDelay` = `"0"` (String)
- Registry `HKCU\Control Panel\Keyboard` → `KeyboardSpeed` = `"31"` (String)

## Scheduler & timers

How Windows hands out CPU time and keeps time.

### Restore global timer resolution requests

`sched.global-timer-resolution` · impact **medium** · risk **safe** · evidence *situational* · after applying: restart · presets: Competitive, Everything

Since Windows 10 2004, a timer-resolution request only affects the process that made it, and Windows 11 ignores requests from minimized or occluded windows. With this key set, the high-resolution timer a game or overlay requests applies globally again. Community frame-time captures show tighter 1% lows in some titles, though results vary by system. Costs a little idle power.

What changes:

- Registry `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\kernel` → `GlobalTimerResolutionRequests` = `1` (DWord)

### Foreground-biased CPU scheduling (0x26)

`sched.priority-separation` · impact **medium** · risk **safe** · evidence *situational* · after applying: none · presets: Competitive, Everything

Win32PrioritySeparation controls how long a thread runs before the scheduler reconsiders (the quantum) and how much extra time the foreground app gets. 0x26 (38) means short, variable quanta with the maximum foreground boost. The game thread gets back on a core sooner when it wakes, which can trim scheduling jitter. Some users prefer 0x28 or 0x2A. 0x26 is the most widely tested value.

What changes:

- Registry `HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl` → `Win32PrioritySeparation` = `0x26` (DWord)

### MMCSS: prioritize the "Games" task

`sched.mmcss-games` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Competitive, Everything

The Multimedia Class Scheduler Service (MMCSS) boosts threads that register for a task profile such as "Games" or "Pro Audio". This sets the Games profile to High scheduling category, GPU priority 8 and I/O priority High. SystemResponsiveness drops to 10%, the minimum Windows honours (0 is treated as 10). The effect is small: many engines, Unreal included, register audio threads with MMCSS but not their render threads.

What changes:

- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile` → `SystemResponsiveness` = `0xa` (DWord)
- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games` → `GPU Priority` = `8` (DWord)
- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games` → `Priority` = `6` (DWord)
- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games` → `Scheduling Category` = `"High"` (String)
- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games` → `SFIO Priority` = `"High"` (String)

### Disable Power Throttling (EcoQoS)

`sched.power-throttling-off` · impact **medium** · risk **safe** · evidence *situational* · after applying: restart · presets: Essential, Competitive, Everything

Power Throttling tags processes Windows thinks are in the background (Discord, voice chat, OBS, overlays, the anti-cheat helper) as EcoQoS and runs them at reduced clocks. When those processes sit in the game's critical path, for example voice or capture, that can add hitches. Desktops gain nothing from the power savings, so turning it off is a free win.

What changes:

- Registry `HKLM\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling` → `PowerThrottlingOff` = `1` (DWord)

### Remove forced platform clock (HPET) from boot config

`sched.no-forced-hpet` · impact **high** · risk **safe** · evidence *measurable* · after applying: restart · presets: Essential, Competitive, Everything

Old optimization guides told people to run "bcdedit /set useplatformclock true". That forces every timer query through the slow HPET hardware timer, which measurably increases timer overhead and input latency on modern Ryzen systems. This removes the flag if present, returning Windows to its default invariant-TSC timer. If the flag is not set, nothing changes. If BitLocker is on, Windows may ask for your recovery key on the next boot after any boot-configuration change.

What changes:

- Boot config `useplatformclock` → removed

### Disable dynamic tick

`sched.disable-dynamic-tick` · impact **low** · risk **advanced** · evidence *situational* · after applying: restart · presets: Everything

Dynamic tick lets Windows skip timer interrupts while idle to save power. Disabling it keeps a regular tick, which some users find gives more consistent latency. Measured gains on desktop Ryzen are small and inconsistent, and idle power rises. Keep it only if you can measure a difference. It is a boot-configuration change, so BitLocker users may be asked for their recovery key on the next boot.

> **Note:** Boot configuration change. Have your BitLocker recovery key available if drive encryption is on.

What changes:

- Boot config `disabledynamictick` → `yes`

## Ryzen X3D

V-Cache scheduling for 3D V-Cache CPUs.

### Pin Fortnite & VALORANT to the V-Cache CCD

`x3d.prefer-cache-games` · impact **high** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything · CPUs: dual-CCD X3D

On a 7900X3D, 7950X3D, 9900X3D or 9950X3D only one of the two CCDs has the 3D V-Cache. AMD's amd3dvcache driver decides per app whether to prefer the cache CCD or the higher-clocked one, and its automatic detection can miss a game. This adds per-app "prefer cache" entries for FortniteClient-Win64-Shipping.exe and VALORANT-Win64-Shipping.exe, the same interface AMD3DConfigurator and vcache-tray use, then restarts the V-Cache service. Both games are latency-bound and benefit heavily from the extra L3. Requires the AMD chipset driver with the 3D V-Cache Performance Optimizer.

What changes:

- Restarts the related service on revert
- Registry `HKLM\SYSTEM\CurrentControlSet\Services\amd3dvcache\Preferences\App\Tickrate_Fortnite` → `EndsWith` = `"FortniteClient-Win64-Shipping.exe"` (String)
- Registry `HKLM\SYSTEM\CurrentControlSet\Services\amd3dvcache\Preferences\App\Tickrate_Fortnite` → `Type` = `1` (DWord)
- Registry `HKLM\SYSTEM\CurrentControlSet\Services\amd3dvcache\Preferences\App\Tickrate_Valorant` → `EndsWith` = `"VALORANT-Win64-Shipping.exe"` (String)
- Registry `HKLM\SYSTEM\CurrentControlSet\Services\amd3dvcache\Preferences\App\Tickrate_Valorant` → `Type` = `1` (DWord)
- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### X3D dual-CCD: keep Xbox Game Bar game detection working

`x3d.keep-game-bar` · impact **high** · risk **safe** · evidence *measurable* · after applying: sign out · presets: Essential, Competitive, Everything · CPUs: dual-CCD X3D

Many debloat scripts kill GameBarPresenceWriter or set the GameDVR policy to "off", which breaks Windows' "this is a game" signal. Without it, a dual-CCD X3D CPU never parks its frequency CCD and the game runs on the wrong cores. This removes those blocks if a previous tool set them. If Xbox Game Bar was uninstalled, reinstall it from the Microsoft Store.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\GameDVR` → `AllowGameDVR` removed
- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

## Power plan

Clocks, parking and device power saving.

### X3D dual-CCD: tuned Balanced power plan

`x3d.dual-ccd-balanced-plan` · impact **high** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything · CPUs: dual-CCD X3D

Dual-CCD X3D chips depend on the Windows Balanced plan: AMD's driver parks the non-cache CCD through Balanced's core-parking policy while Game Mode is active. High Performance, Ultimate Performance and most "gaming" power plans disable parking, so games spread across both CCDs and lose the V-Cache benefit. This activates the stock Balanced plan and changes only settings that do not touch the CPU. USB selective suspend is turned off (mouse and keyboard never sleep), PCIe link-state power management is turned off (the GPU link stays at full speed), and disk sleep is set to never. Processor settings stay at AMD's defaults on purpose.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Tickrate Low Latency power plan

`power.low-latency-plan` · impact **high** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything · CPUs: single-CCD X3D, other Ryzen, non-AMD

For single-CCD X3D (5800X3D, 5700X3D, 7800X3D, 9800X3D) and other CPUs. Duplicates High Performance into a "Tickrate Low Latency" plan and activates it, with these changes. Minimum processor state 100% and energy-performance preference 0, so CPPC requests full speed immediately. Core parking off, so a waking thread never lands on a sleeping core. Aggressive boost. USB selective suspend off, PCIe ASPM off, disk sleep never, Wi-Fi maximum performance. C-states stay enabled on purpose: disabling idle makes X3D chips run hot, which lowers their boost clocks. Not offered on dual-CCD X3D CPUs, which need the Balanced plan for CCD parking.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

## NVIDIA & graphics

Interrupts and driver housekeeping. Driver profiles are on the NVIDIA page.

### Ensure MSI interrupts on the NVIDIA GPU

`gpu.msi-mode` · impact **medium** · risk **safe** · evidence *measurable* · after applying: restart · presets: Essential, Competitive, Everything

With line-based interrupts, the GPU can share an IRQ with other devices, and interrupt handling takes a slower path, which shows up as higher DPC latency. RTX 40 and 50 series cards normally enable MSI already, but driver reinstalls, older cards and some DDU cleanups leave it off. This sets MSISupported=1 for every NVIDIA display adapter. It is the GPU tweak with the strongest community measurements behind it. Interrupt priority overrides are left alone because they are obsolete on modern Windows.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Disable NVIDIA telemetry

`gpu.nvidia-telemetry-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Essential, Competitive, Everything

Opts out of NVIDIA's usage data collection, sets the driver's feature-telemetry flags to off, and disables the NvTm* crash and usage reporting scheduled tasks and the legacy NvTelemetryContainer service where present. Removes periodic background wake-ups. It has no effect on driver features such as Reflex, G-SYNC or DLSS.

What changes:

- Registry `HKLM\SOFTWARE\NVIDIA Corporation\NvControlPanel2\Client` → `OptInOrOutPreference` = `0` (DWord)
- Registry `HKLM\SOFTWARE\NVIDIA Corporation\Global\FTS` → `EnableRID44231` = `0` (DWord)
- Registry `HKLM\SOFTWARE\NVIDIA Corporation\Global\FTS` → `EnableRID64640` = `0` (DWord)
- Registry `HKLM\SOFTWARE\NVIDIA Corporation\Global\FTS` → `EnableRID66610` = `0` (DWord)
- Service `NvTelemetryContainer` → Disabled
- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Disable GPU energy tracking driver

`gpu.energy-driver-off` · impact **low** · risk **moderate** · evidence *quality of life* · after applying: restart · presets: Everything

GpuEnergyDrv is a small kernel driver that samples GPU activity so Windows can estimate per-app power use for battery reports. A desktop gains nothing from it. The only visible change is that Task Manager stops showing GPU "power usage" columns.

What changes:

- Service `GpuEnergyDrv` → Disabled

## Windows gaming

Game Mode, capture, presentation model and memory.

### Keep Game Mode on

`gaming.game-mode-on` · impact **high** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything

Game Mode tells Windows to suspend Windows Update installs and driver installs and to deprioritize background processes while a game has focus. On dual-CCD Ryzen X3D CPUs (7900X3D, 7950X3D, 9900X3D, 9950X3D) it does more: Game Mode is the signal AMD's V-Cache driver uses to park the non-cache CCD so the game runs on the cache cores. Turning it off, as many old guides suggest, costs those CPUs a lot of performance.

What changes:

- Registry `HKCU\Software\Microsoft\GameBar` → `AutoGameModeEnabled` = `1` (DWord)
- Registry `HKCU\Software\Microsoft\GameBar` → `AllowAutoGameMode` = `1` (DWord)

### Disable background recording (Game DVR)

`gaming.game-dvr-off` · impact **medium** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything

"Record what happened" keeps a rolling capture buffer, which uses GPU encoder time, VRAM and some CPU in every game. This turns off background capture and app capture but leaves Xbox Game Bar installed. Game Bar must stay installed because dual-CCD X3D CPUs rely on it to detect games. Use NVIDIA Instant Replay or OBS for clips if you need them.

What changes:

- Registry `HKCU\System\GameConfigStore` → `GameDVR_Enabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR` → `AppCaptureEnabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR` → `HistoricalCaptureEnabled` = `0` (DWord)

### Silence Game Bar pop-ups

`gaming.game-bar-quiet` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Essential, Competitive, Everything

Keeps Xbox Game Bar installed and working, which is required for X3D game detection, but stops it popping up. The startup tips panel is disabled and the Xbox/Guide button on a controller no longer opens the overlay. Win+G still works.

What changes:

- Registry `HKCU\Software\Microsoft\GameBar` → `ShowStartupPanel` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\GameBar` → `UseNexusForGameBarEnabled` = `0` (DWord)

### Enable Hardware-accelerated GPU scheduling

`gaming.hags-on` · impact **medium** · risk **safe** · evidence *situational* · after applying: restart · presets: Essential, Competitive, Everything

With HAGS, the GPU's own scheduler processor manages its command queue, removing a layer of CPU work and buffering. NVIDIA requires it for DLSS Frame Generation, and on RTX 30/40/50 cards with current drivers it is neutral-to-positive for frame pacing. With NVIDIA Reflex on, as it should be in both games, latency is equal or slightly lower. If you see stutter after enabling it, try reverting. Older GTX cards benefit less.

What changes:

- Registry `HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers` → `HwSchMode` = `2` (DWord)

### Optimizations for windowed games (flip model)

`gaming.windowed-optimizations` · impact **medium** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything

Older DX10/11 games that run borderless or windowed use the "blt" presentation model, which adds a copy and usually a frame of compositor latency. This Windows 11 setting upgrades them to flip-model presentation. That enables independent flip, which matches exclusive-fullscreen latency, and lets VRR work in a window. VALORANT runs on DX11 and Fortnite's Performance mode on DX11, so both benefit when played borderless.

What changes:

- Registry `HKCU\Software\Microsoft\DirectX\UserGpuPreferences` → `DirectXUserGlobalSettings` = `"SwapEffectUpgradeEnable=1;"` (String)

### Disable fullscreen optimizations globally

`gaming.fso-global-off` · impact **low** · risk **moderate** · evidence *situational* · after applying: sign out · presets: none (manual only)

Windows silently runs "exclusive fullscreen" games through the desktop compositor in flip mode. On a modern system that has the same latency as true exclusive fullscreen and allows faster alt-tab. Some players still report smoother input with real exclusive mode, especially in DX11 titles. This is a try-it-and-compare change, so it is not in any preset. The per-game version (Fortnite & Valorant tab) is the more targeted option.

What changes:

- Registry `HKCU\System\GameConfigStore` → `GameDVR_FSEBehaviorMode` = `2` (DWord)
- Registry `HKCU\System\GameConfigStore` → `GameDVR_HonorUserFSEBehaviorMode` = `1` (DWord)
- Registry `HKCU\System\GameConfigStore` → `GameDVR_FSEBehavior` = `2` (DWord)
- Registry `HKCU\System\GameConfigStore` → `GameDVR_DXGIHonorFSEWindowsCompatible` = `1` (DWord)

### Disable Multiplane Overlay (troubleshooting)

`gaming.mpo-off` · impact **low** · risk **moderate** · evidence *situational* · after applying: restart · presets: none (manual only)

Multiplane Overlay lets the display hardware compose some layers directly, which is part of how borderless games reach "independent flip" latency. On some multi-monitor and mixed-refresh setups, MPO causes flicker, browser stutter on a second screen, or black flashes. Disabling it fixes those but can add latency in windowed games, so use it only if you have those symptoms. Newer Windows 11 builds may ignore this key.

What changes:

- Registry `HKLM\SOFTWARE\Microsoft\Windows\Dwm` → `OverlayTestMode` = `5` (DWord)

### Disable Fast Startup

`gaming.fast-startup-off` · impact **low** · risk **safe** · evidence *situational* · after applying: none · presets: Essential, Competitive, Everything

Fast Startup hibernates the kernel and drivers on shutdown instead of closing them. Driver state, including GPU, chipset and the V-Cache optimizer, can then carry over between sessions. That is a known cause of "it was smooth yesterday" problems and of driver updates not fully applying. Boot takes a few seconds longer on an NVMe drive.

What changes:

- Registry `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power` → `HiberbootEnabled` = `0` (DWord)

### Disable hibernation

`gaming.hibernation-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Competitive, Everything

Desktop gaming PCs rarely need hibernation. Turning it off removes hiberfil.sys, which is sized to a large fraction of your RAM (often 12-25 GB on a 32-64 GB system), and implies Fast Startup off. Sleep is unaffected.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Disable transparency effects

`gaming.transparency-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Competitive, Everything

Acrylic blur makes the compositor re-render the blurred layers whenever something behind them changes. The cost is tiny on an RTX GPU, but it is pure overhead while a game runs borderless with the taskbar on another monitor.

What changes:

- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` → `EnableTransparency` = `0` (DWord)

### Reduce window and menu animations

`gaming.animations-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: sign out · presets: Everything

Makes alt-tabbing, opening Start and window snapping instant. It does not change game performance, but the desktop feels much snappier between matches.

What changes:

- Registry `HKCU\Control Panel\Desktop\WindowMetrics` → `MinAnimate` = `"0"` (String)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` → `TaskbarAnimations` = `0` (DWord)
- Registry `HKCU\Control Panel\Desktop` → `MenuShowDelay` = `"0"` (String)

### Disable memory compression (16 GB+ RAM)

`gaming.memory-compression-off` · impact **low** · risk **moderate** · evidence *situational* · after applying: restart · presets: Everything

Memory compression saves RAM by compressing pages that would otherwise be paged out, at the cost of CPU time to compress and decompress them. With 32 GB or more this rarely triggers anyway. Disabling it removes a source of occasional CPU spikes when a game reloads assets. Leave it on if you have 16 GB or less and run a browser alongside the game.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Keep kernel and drivers in RAM

`gaming.paging-executive-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: restart · presets: Competitive, Everything

DisablePagingExecutive keeps the kernel and drivers resident in RAM, so a driver path is never served from the page file after the PC has been idle. On systems with 16 GB or more the RAM cost is negligible. The benefit is avoiding rare, long hitches rather than raising average FPS.

What changes:

- Registry `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management` → `DisablePagingExecutive` = `1` (DWord)

## Fortnite & VALORANT

Per-game priority, GPU choice and scanning.

### Fortnite: High CPU & I/O priority

`games.fortnite-priority` · impact **medium** · risk **moderate** · evidence *situational* · after applying: none · presets: Competitive, Everything

Uses the Windows "PerfOptions" launch setting (Image File Execution Options) to start Fortnite at High CPU priority. Easy Anti-Cheat blocks I/O priority changes on the game executable itself. EAC's bootstrapper (FortniteClient-Win64-Shipping_EAC_EOS.exe) passes its priority on to the game, so it gets High CPU and I/O priority as well. No values are injected into the game process, which is why this is anti-cheat safe.

What changes:

- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe\PerfOptions` → `CpuPriorityClass` = `3` (DWord)
- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping_EAC_EOS.exe\PerfOptions` → `CpuPriorityClass` = `3` (DWord)
- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping_EAC_EOS.exe\PerfOptions` → `IoPriority` = `3` (DWord)

### VALORANT: High CPU priority

`games.valorant-priority` · impact **medium** · risk **moderate** · evidence *situational* · after applying: none · presets: Competitive, Everything

Uses the same PerfOptions launch setting to give VALORANT-Win64-Shipping.exe High CPU priority. VALORANT is very CPU-bound at high frame rates, so it benefits from not being preempted by Discord, browsers or RGB software. "Realtime" priority is deliberately not used: it can starve input and audio threads and make things worse.

What changes:

- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\VALORANT-Win64-Shipping.exe\PerfOptions` → `CpuPriorityClass` = `3` (DWord)

### Force games onto the NVIDIA GPU

`games.gpu-preference` · impact **medium** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything

Ryzen 7000 and 9000 CPUs include an integrated Radeon GPU. If it is enabled in BIOS, or a monitor is plugged into the motherboard, Windows can pick the wrong adapter or route frames across PCIe, which adds latency. This writes the same per-app "High performance" preference as Settings > Display > Graphics, using the installed game paths it detects.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Disable fullscreen optimizations for both games

`games.fso-off` · impact **low** · risk **safe** · evidence *situational* · after applying: none · presets: Everything

Applies the compatibility flag from the exe's Properties > Compatibility tab to the detected Fortnite and VALORANT executables. With it set, "Fullscreen" really is exclusive fullscreen instead of a compositor-managed flip window. Some players find input feels more direct, especially in DX11 (VALORANT, Fortnite Performance mode). Alt-tab gets slower. Test it: leave it on if it feels better, revert if not.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Microsoft Defender: exclude game and shader-cache folders

`games.defender-exclusions` · impact **low** · risk **moderate** · evidence *situational* · after applying: none · presets: Competitive, Everything

Fortnite streams assets and both games write shader caches during play. Real-time scanning of every read and write adds I/O latency and can turn a shader compile into a visible hitch. This excludes the Fortnite install folder, the Riot Games folder and the DirectX/NVIDIA shader cache folders from real-time scanning only. Full scans still cover them. The trade-off: a malicious file placed in those folders would not be caught on access. Skipped if a third-party antivirus has replaced Defender.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

## Network

Adapter power saving, interrupts and QoS.

### QoS: tag game traffic as high priority (DSCP 46)

`games.qos-dscp` · impact **low** · risk **safe** · evidence *situational* · after applying: none · presets: Competitive, Everything

Creates Windows QoS policies that tag all traffic from the two game executables with DSCP 46, the same class VoIP uses. Many consumer and gaming routers honour it, sending game packets ahead of downloads and streams when your upload is saturated, which reduces ping spikes. It does nothing on routers that ignore DSCP and is harmless there. Also sets "Do not use NLA" so Windows applies the tags on home (non-domain) networks.

What changes:

- Registry `HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\QoS` → `Do not use NLA` = `"1"` (String)
- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Disable multimedia network throttling

`net.throttling-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: restart · presets: Competitive, Everything

While MMCSS-registered media plays (Discord voice, Spotify, a stream on another monitor), Windows limits non-multimedia network processing to about 10 packets per millisecond. Game traffic stays far below that, so the real-world effect is minimal, but there is no downside on a gaming PC.

What changes:

- Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile` → `NetworkThrottlingIndex` = `0xffffffff` (DWord)

### Disable network adapter power saving

`net.adapter-power-saving-off` · impact **medium** · risk **safe** · evidence *situational* · after applying: none · presets: Essential, Competitive, Everything

Energy-Efficient Ethernet (802.3az) and vendor equivalents (Green Ethernet, Advanced EEE, Gigabit Lite, power saving mode) put the link into low-power idle between packets. Waking it adds microseconds to milliseconds of jitter, and some Realtek and Intel controllers drop packets during transitions. This disables those features plus Windows' device power-off on every connected physical adapter. Original values are saved and restored on revert. The adapter resets once, so expect a few seconds of disconnect.

> **Note:** Your network connection will drop for a few seconds while adapters reset.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

### Disable NIC interrupt moderation

`net.interrupt-moderation-off` · impact **low** · risk **moderate** · evidence *situational* · after applying: none · presets: Competitive, Everything

Interrupt moderation, also called interrupt coalescing, holds incoming packets for a few dozen to a few hundred microseconds so the CPU handles them in batches. Disabling it delivers each game packet to Windows immediately. That lowers network-path latency and jitter at the cost of more interrupts, which a modern Ryzen absorbs easily at game packet rates. Avoid it if you regularly saturate 2.5/10 GbE for big transfers. The adapter resets once.

> **Note:** Your network connection will drop for a few seconds while adapters reset.

What changes:

- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)

## Background apps

Things that wake up while you play.

### Block Store apps from running in the background

`bg.background-apps-off` · impact **low** · risk **moderate** · evidence *quality of life* · after applying: none · presets: Competitive, Everything

Store apps such as Mail, Weather, Photos and Phone Link can run background tasks on timers and network changes. This group policy stops them unless you open the app. Desktop apps (Discord, Steam, Epic) are not affected. The trade-off: Store apps will not deliver notifications while closed.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy` → `LetAppsRunInBackground` = `2` (DWord)

### Stop Microsoft Edge running in the background

`bg.edge-background-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Essential, Competitive, Everything

Edge pre-launches at sign-in (Startup Boost) and keeps processes alive after you close it, holding hundreds of MB of RAM and waking periodically. Disabling both means Edge only runs when you open it, and it opens slightly slower the first time.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Edge` → `StartupBoostEnabled` = `0` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Edge` → `BackgroundModeEnabled` = `0` (DWord)

### Disable Widgets (News and interests)

`bg.widgets-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: sign out · presets: Essential, Competitive, Everything

The Widgets board runs a WebView2 host process that refreshes news and weather in the background even if you never open it, and it can pop open when you hover the taskbar corner mid-game. This turns the feature off by policy.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Dsh` → `AllowNewsAndInterests` = `0` (DWord)

### Disable Copilot and Recall

`bg.copilot-recall-off` · impact **medium** · risk **safe** · evidence *situational* · after applying: sign out · presets: Essential, Competitive, Everything

On Copilot+ PCs, Recall takes a screenshot every few seconds and runs on-device OCR and indexing on it: constant background CPU, NPU and disk work, and a privacy concern. This disables Recall snapshots, blocks Recall from being enabled, turns off Windows Copilot by policy and hides the Copilot taskbar button. Nothing changes on PCs without these features.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsAI` → `DisableAIDataAnalysis` = `1` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsAI` → `AllowRecallEnablement` = `0` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot` → `TurnOffWindowsCopilot` = `1` (DWord)
- Registry `HKCU\Software\Policies\Microsoft\Windows\WindowsCopilot` → `TurnOffWindowsCopilot` = `1` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` → `ShowCopilotButton` = `0` (DWord)

### Disable Bing web results in Start search

`bg.web-search-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: sign out · presets: Essential, Competitive, Everything

Every keystroke in Start search queries Bing and renders web results, which makes search slow and occasionally hangs Start. This makes search local-only: apps, settings and files.

What changes:

- Registry `HKCU\Software\Policies\Microsoft\Windows\Explorer` → `DisableSearchBoxSuggestions` = `1` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Search` → `BingSearchEnabled` = `0` (DWord)

### Stop suggested apps, ads and auto-installs

`bg.consumer-features-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: sign out · presets: Essential, Competitive, Everything

Windows "consumer features" quietly download promoted apps (games, streaming apps) and show tips and ads in Start, Settings and the lock screen. Those installs happen in the background, sometimes while you play. This disables silent installs, suggestions, "welcome experience" pages and Start recommendations.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\CloudContent` → `DisableWindowsConsumerFeatures` = `1` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\CloudContent` → `DisableSoftLanding` = `1` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` → `SilentInstalledAppsEnabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` → `SystemPaneSuggestionsEnabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` → `SoftLandingEnabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` → `SubscribedContent-338388Enabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` → `SubscribedContent-338389Enabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` → `SubscribedContent-353694Enabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` → `SubscribedContent-353696Enabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` → `Start_IrisRecommendations` = `0` (DWord)

## Privacy & telemetry

Data collection that costs CPU, disk and upload.

### Minimize Windows telemetry

`privacy.telemetry-off` · impact **medium** · risk **safe** · evidence *situational* · after applying: restart · presets: Essential, Competitive, Everything

The Connected User Experiences service (DiagTrack) and the Compatibility Appraiser (CompatTelRunner.exe) periodically scan installed programs and upload diagnostics. The Appraiser in particular can pin a CPU core and hammer the disk for minutes, sometimes mid-session. This sets AllowTelemetry to the lowest level your edition allows, disables DiagTrack and the WAP push service, and disables the Appraiser, CEIP and disk-diagnostic scheduled tasks.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection` → `AllowTelemetry` = `0` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection` → `DoNotShowFeedbackNotifications` = `1` (DWord)
- Service `DiagTrack` → Disabled
- Service `dmwappushservice` → Disabled
- Scheduled task `\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser` → Disabled
- Scheduled task `\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser Exp` → Disabled
- Scheduled task `\Microsoft\Windows\Application Experience\ProgramDataUpdater` → Disabled
- Scheduled task `\Microsoft\Windows\Application Experience\StartupAppTask` → Disabled
- Scheduled task `\Microsoft\Windows\Customer Experience Improvement Program\Consolidator` → Disabled
- Scheduled task `\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip` → Disabled
- Scheduled task `\Microsoft\Windows\Autochk\Proxy` → Disabled
- Scheduled task `\Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector` → Disabled

### Disable advertising ID and tailored experiences

`privacy.advertising-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Essential, Competitive, Everything

Disables the advertising ID apps use to track you across apps, and stops Windows from using your diagnostic data for personalized tips, ads and recommendations. This is a privacy change with no performance effect.

What changes:

- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo` → `Enabled` = `0` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\AdvertisingInfo` → `DisabledByGroupPolicy` = `1` (DWord)
- Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Privacy` → `TailoredExperiencesWithDiagnosticDataEnabled` = `0` (DWord)
- Registry `HKCU\Software\Microsoft\Siuf\Rules` → `NumberOfSIUFInPeriod` = `0` (DWord)

### Disable activity history

`privacy.activity-history-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Competitive, Everything

Turns off the activity feed that records app and document usage locally and can sync it to your Microsoft account. This is a privacy change that also removes a small amount of background database writing.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\System` → `EnableActivityFeed` = `0` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\System` → `PublishUserActivities` = `0` (DWord)
- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\System` → `UploadUserActivities` = `0` (DWord)

### Disable Windows Error Reporting uploads

`privacy.error-reporting-off` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Competitive, Everything

After a crash, WER gathers a dump and uploads it, which can take noticeable disk and CPU time right when you relaunch the game. Local crash dumps for the game itself (Fortnite/Riot crash folders) are unaffected. The service is set to Manual rather than Disabled so dependent components still work.

What changes:

- Registry `HKLM\SOFTWARE\Microsoft\Windows\Windows Error Reporting` → `Disabled` = `1` (DWord)
- Service `WerSvc` → Manual

### Stop sharing Windows updates with other PCs

`privacy.delivery-optimization-p2p-off` · impact **medium** · risk **safe** · evidence *measurable* · after applying: none · presets: Essential, Competitive, Everything

Delivery Optimization can upload Windows and Store updates to other PCs on your network or the internet. Upload saturation is a classic cause of ping spikes and packet loss. This keeps update downloads working normally (HTTP only, from Microsoft) but stops peer-to-peer sharing.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization` → `DODownloadMode` = `0` (DWord)

## Windows Update

Keep updates from breaking your setup.

### Stop Windows Update replacing your GPU and chipset drivers

`updates.no-driver-updates` · impact **medium** · risk **moderate** · evidence *measurable* · after applying: none · presets: Competitive, Everything

Windows Update regularly "updates" GPU drivers to an older OEM build, or swaps the AMD chipset driver package. That can break the V-Cache optimizer and reset your NVIDIA profile settings. With this on, you install drivers yourself from NVIDIA and AMD, which you should be doing for a gaming PC anyway. Security and quality updates are unaffected.

> **Note:** You become responsible for driver updates: use NVIDIA App or nvidia.com and AMD's chipset driver page.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate` → `ExcludeWUDriversInQualityUpdate` = `1` (DWord)

### Never auto-restart while you are signed in

`updates.no-auto-restart` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Essential, Competitive, Everything

Windows still downloads and installs updates, but it waits for you to restart instead of forcing a reboot. Pair it with a manual restart after big updates.

What changes:

- Registry `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU` → `NoAutoRebootWithLoggedOnUsers` = `1` (DWord)

## Services

Services a gaming PC does not need.

### Disable unneeded legacy services

`svc.unneeded-pack` · impact **low** · risk **safe** · evidence *quality of life* · after applying: none · presets: Essential, Competitive, Everything

Disables services that a home gaming PC never uses: Fax (Fax), Downloaded Maps Manager (MapsBroker), Retail Demo (RetailDemo), Remote Registry (RemoteRegistry), WalletService and the Windows Insider Service (wisvc). None run constantly. Disabling them removes trigger-start wake-ups and reduces attack surface. Services that Windows, Xbox/Game Pass, Store, EAC or Vanguard depend on are deliberately left alone.

What changes:

- Service `Fax` → Disabled
- Service `MapsBroker` → Disabled
- Service `RetailDemo` → Disabled
- Service `RemoteRegistry` → Disabled
- Service `WalletService` → Disabled
- Service `wisvc` → Disabled

### Disable SysMain (Superfetch)

`svc.sysmain-off` · impact **low** · risk **moderate** · evidence *situational* · after applying: none · presets: Everything

SysMain learns your app usage and preloads apps into standby memory. On an NVMe SSD the benefit is small, and the background reads and memory reshuffling can coincide with gameplay. Disabling it makes app launches slightly slower after a reboot. It is a reasonable trade on a dedicated gaming PC, less so on a mixed work machine.

What changes:

- Service `SysMain` → Disabled

### Disable Windows Search indexing

`svc.search-indexer-off` · impact **low** · risk **moderate** · evidence *situational* · after applying: none · presets: Everything

The search indexer re-crawls files when they change. Game updates (Fortnite patches are many GB) can trigger long bursts of indexer CPU and disk activity. Disabling it removes that. Start-menu search still finds apps and settings, but searching file contents becomes slow. Skip this if you rely on file search.

What changes:

- Service `WSearch` → Disabled

### Disable Print Spooler (no printer)

`svc.print-spooler-off` · impact **low** · risk **moderate** · evidence *quality of life* · after applying: none · presets: none (manual only)

Print Spooler is always running and has a long history of security vulnerabilities (PrintNightmare). If you never print or use "Print to PDF", disabling it frees a process and closes that attack surface. Printing will not work until you revert this.

What changes:

- Service `Spooler` → Disabled

## Left out on purpose

These show up in other optimizers. Tickrate does not apply them, for the reasons below.

- **Disable Memory Integrity (HVCI) / VBS**: VALORANT's Vanguard On-Demand mode (2026) requires VBS, HVCI, IOMMU, TPM 2.0 and Secure Boot, and Fortnite PC tournaments check Secure Boot, TPM and IOMMU. Turning these off can block you from matches. The FPS cost of HVCI on Zen 4/5 is small (a few % at most in CPU-bound scenes).
- **Disable Spectre/Meltdown mitigations**: A real security risk for very little gain on Zen 4/Zen 5, where the hardware mitigations are cheap.
- **Disable HPET in Device Manager / force "useplatformclock"**: Forcing HPET increases timer overhead and latency. Tickrate does the opposite and removes a forced HPET flag if one exists.
- **Disable CPU idle states (C-states) from the power plan**: X3D CPUs are temperature-limited. Pinning every core awake raises temperature and lowers boost clocks, which is the opposite of the goal.
- **High/Ultimate Performance plan on dual-CCD X3D**: Breaks AMD's CCD parking, so games spill onto the non-V-Cache CCD. Dual-CCD chips get a tuned Balanced plan instead.
- **Uninstall Xbox Game Bar**: Dual-CCD X3D CPUs need it for game detection, and it powers Game Mode detection on every PC.
- **Nagle's algorithm (TcpAckFrequency / TCPNoDelay)**: Only affects TCP. Fortnite and VALORANT gameplay traffic is UDP, so it does nothing for them.
- **TCP auto-tuning / "network throttling" registry packs**: Myths from the Windows XP/7 era with no measurable effect on UDP game traffic.
- **Mouse/keyboard data queue size (mouclass/kbdclass)**: Changes buffer size, not latency. Values set too low drop input events.
- **GPU interrupt priority / affinity overrides**: Obsolete on modern Windows with MSI-X GPUs, and wrong values cause stutter. Tickrate only ensures MSI mode is on.
- **DisableDynamicPstate (lock GPU clocks)**: Keeps the GPU at full clocks on the desktop 24/7. "Prefer maximum performance" in the driver profile gets the in-game benefit without that.
- **Disable the page file**: Causes crashes when committed memory runs out (Fortnite plus a browser can do it) and gives no FPS benefit with enough RAM.
- **Disable DEP / test-signing / driver signature enforcement**: Easy Anti-Cheat and Vanguard refuse to run with these, and they are serious security holes.
- **"Realtime" process priority for games**: Starves input, audio and driver threads and can freeze the system. Tickrate uses High priority instead.

## NVIDIA driver profile settings

Applied to the Base Profile through NVIDIA Profile Inspector from the NVIDIA page.

| Setting | Setting ID | Tickrate default | Why |
|---|---|---|---|
| Power management mode | `0x1057eb71` | Prefer maximum performance | Keeps the GPU at its full boost clock while a 3D app runs instead of ramping up and down. That matters most for light, CPU-bound esports loads such as VALORANT at 400+ FPS, where the GPU otherwise downclocks between frames and frame times wobble. Costs some power while games are open. The desktop still idles down. |
| Low latency mode (max pre-rendered frames) | `0x007ba09e` | On: 1 queued frame | Limits the CPU to queuing one frame ahead of the GPU in games without NVIDIA Reflex. Fortnite and VALORANT both support Reflex, which overrides this in-game, so this mainly covers other games and the launchers. |
| Shader cache size | `0x00ac8497` | Unlimited | Fortnite, especially on DX12, compiles thousands of shaders, and every Fortnite update plus other games share the 4 GB default. When the cache fills, old shaders are evicted and recompiled mid-match, which causes stutter. Unlimited stops that. It uses disk space, which the Cleanup page can reclaim after driver updates. |
| Texture filtering quality | `0x00ce2691` | High performance | Lets the driver use cheaper texture-filtering shortcuts. Gains are small on RTX cards (around 1-2%), with slightly softer textures at grazing angles. Competitive players usually take it. |
| Trilinear optimization | `0x002ecaf2` | On (default) | Keeps the driver's trilinear filtering optimization on, which goes with the High performance texture filtering above. |
| Anisotropic sample optimization | `0x00e73211` | On | Reduces the number of anisotropic filtering samples where the difference is not visible. A small GPU saving with negligible visual change. |
| Threaded optimization | `0x20c1221e` | Auto (recommended) | Lets the driver offload work to extra CPU threads. Auto lets NVIDIA decide per game, which is the right call for both titles. Forcing On can hurt some DX11 games, so it is listed here only so you can see it is left at Auto on purpose. |
| Vertical sync | `0x00a879cf` | Use the 3D application setting | With a G-SYNC or G-SYNC Compatible monitor, the lowest-latency tear-free setup is G-SYNC on, V-Sync forced on here, V-Sync off in-game and Reflex On + Boost: Reflex then caps FPS just under your refresh rate automatically. On a fixed-refresh monitor, force V-Sync off. Pick your monitor type above and this is set for you. |
| Preferred refresh rate | `0x0064b541` | Highest available | Forces exclusive-fullscreen games to use your monitor's highest refresh rate, even if the game asks for 60 Hz. |
