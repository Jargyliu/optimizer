'use strict';
const { dword, sz, delValue, bcd, ps } = require('./helpers.cjs');

const MOUSE = 'HKCU\\Control Panel\\Mouse';
const KERNEL = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel';
const PRIORITY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl';
const MMCSS = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile';
const GAMECONFIG = 'HKCU\\System\\GameConfigStore';
const GAMEBAR = 'HKCU\\Software\\Microsoft\\GameBar';
const GFX = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers';

module.exports = [
  // ───────────────────────────── Input ─────────────────────────────
  {
    id: 'input.mouse-acceleration-off',
    title: 'Disable mouse acceleration',
    category: 'input',
    summary: 'Turns off "Enhance pointer precision" so cursor movement is 1:1 with your hand.',
    description:
      'Windows scales cursor speed by how fast you move the mouse ("Enhance pointer precision"). That makes flicks inconsistent: the same physical distance lands on a different spot depending on speed. Both Fortnite and VALORANT read raw input in matches, but menus, the buy phase, the inventory, the Epic and Riot launchers and anything windowed still use the Windows pointer. This sets the acceleration curve thresholds to zero so the desktop matches your in-game feel.',
    impact: 'high', risk: 'safe', evidence: 'proven', reboot: 'signout',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      sz(MOUSE, 'MouseSpeed', '0', { default: '1' }),
      sz(MOUSE, 'MouseThreshold1', '0', { default: '6' }),
      sz(MOUSE, 'MouseThreshold2', '0', { default: '10' }),
    ],
  },
  {
    id: 'input.pointer-speed-default',
    title: 'Set Windows pointer speed to 6/11',
    category: 'input',
    summary: 'Sets the Windows sensitivity slider to the 1:1 position so no pixels are skipped or multiplied.',
    description:
      'The middle notch (6 of 11) is the only Windows pointer speed that does not multiply or drop mouse counts. Anything else skips pixels or adds interpolation on the desktop. Change sensitivity with mouse DPI and in-game sensitivity instead.',
    impact: 'low', risk: 'safe', evidence: 'proven', reboot: 'signout',
    presets: ['competitive', 'extreme'],
    ops: [sz(MOUSE, 'MouseSensitivity', '10', { default: '10' })],
  },
  {
    id: 'input.accessibility-shortcuts-off',
    title: 'Disable Sticky / Filter / Toggle Keys hotkeys',
    category: 'input',
    summary: 'Stops the Sticky Keys pop-up from tabbing you out when you tap Shift five times mid-fight.',
    description:
      'Pressing Shift five times (crouch-spam, building edits) or holding right Shift opens an accessibility dialog that steals focus from the game. This disables only the keyboard shortcuts. The features themselves stay available in Settings > Accessibility.',
    impact: 'medium', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      sz('HKCU\\Control Panel\\Accessibility\\StickyKeys', 'Flags', '506', { default: '510' }),
      sz('HKCU\\Control Panel\\Accessibility\\ToggleKeys', 'Flags', '58', { default: '62' }),
      sz('HKCU\\Control Panel\\Accessibility\\Keyboard Response', 'Flags', '122', { default: '126' }),
    ],
  },
  {
    id: 'input.keyboard-repeat-fast',
    title: 'Fastest keyboard repeat rate',
    category: 'input',
    summary: 'Shortest repeat delay and fastest repeat rate for held keys.',
    description:
      'Shortens the delay before a held key starts repeating and raises the repeat rate to the maximum Windows allows. Mostly a desktop and chat quality-of-life change. Games that poll key state directly are not affected.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'signout',
    presets: ['extreme'],
    ops: [
      sz('HKCU\\Control Panel\\Keyboard', 'KeyboardDelay', '0', { default: '1' }),
      sz('HKCU\\Control Panel\\Keyboard', 'KeyboardSpeed', '31', { default: '31' }),
    ],
  },

  // ─────────────────────── Scheduler & timers ───────────────────────
  {
    id: 'sched.global-timer-resolution',
    title: 'Restore global timer resolution requests',
    category: 'scheduler',
    summary: 'Lets a game\'s 1 ms timer request apply system-wide again, as it did before Windows 10 2004.',
    description:
      'Since Windows 10 2004, a timer-resolution request only affects the process that made it, and Windows 11 ignores requests from minimized or occluded windows. With this key set, the high-resolution timer a game or overlay requests applies globally again. Community frame-time captures show tighter 1% lows in some titles, though results vary by system. Costs a little idle power.',
    impact: 'medium', risk: 'safe', evidence: 'situational', reboot: 'restart',
    presets: ['competitive', 'extreme'],
    ops: [dword(KERNEL, 'GlobalTimerResolutionRequests', 1, { defaultDelete: true })],
  },
  {
    id: 'sched.priority-separation',
    title: 'Foreground-biased CPU scheduling (0x26)',
    category: 'scheduler',
    summary: 'Short, variable scheduler quanta with a 3:1 boost for the window you are playing in.',
    description:
      'Win32PrioritySeparation controls how long a thread runs before the scheduler reconsiders (the quantum) and how much extra time the foreground app gets. 0x26 (38) means short, variable quanta with the maximum foreground boost. The game thread gets back on a core sooner when it wakes, which can trim scheduling jitter. Some users prefer 0x28 or 0x2A. 0x26 is the most widely tested value.',
    impact: 'medium', risk: 'safe', evidence: 'situational', reboot: 'none',
    presets: ['competitive', 'extreme'],
    ops: [dword(PRIORITY, 'Win32PrioritySeparation', 38, { default: 2 })],
  },
  {
    id: 'sched.mmcss-games',
    title: 'MMCSS: prioritize the "Games" task',
    category: 'scheduler',
    summary: 'Raises the Multimedia Class Scheduler priorities for processes registered as games, and shrinks the share reserved for background work.',
    description:
      'The Multimedia Class Scheduler Service (MMCSS) boosts threads that register for a task profile such as "Games" or "Pro Audio". This sets the Games profile to High scheduling category, GPU priority 8 and I/O priority High. SystemResponsiveness drops to 10%, the minimum Windows honours (0 is treated as 10). The effect is small: many engines, Unreal included, register audio threads with MMCSS but not their render threads.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['competitive', 'extreme'],
    ops: [
      dword(MMCSS, 'SystemResponsiveness', 10, { default: 20 }),
      dword(`${MMCSS}\\Tasks\\Games`, 'GPU Priority', 8, { default: 8 }),
      dword(`${MMCSS}\\Tasks\\Games`, 'Priority', 6, { default: 2 }),
      sz(`${MMCSS}\\Tasks\\Games`, 'Scheduling Category', 'High', { default: 'Medium' }),
      sz(`${MMCSS}\\Tasks\\Games`, 'SFIO Priority', 'High', { default: 'Normal' }),
    ],
  },
  {
    id: 'sched.power-throttling-off',
    title: 'Disable Power Throttling (EcoQoS)',
    category: 'scheduler',
    summary: 'Stops Windows from running background processes in a low-frequency efficiency mode.',
    description:
      'Power Throttling tags processes Windows thinks are in the background (Discord, voice chat, OBS, overlays, the anti-cheat helper) as EcoQoS and runs them at reduced clocks. When those processes sit in the game\'s critical path, for example voice or capture, that can add hitches. Desktops gain nothing from the power savings, so turning it off is a free win.',
    impact: 'medium', risk: 'safe', evidence: 'situational', reboot: 'restart',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [dword('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling', 'PowerThrottlingOff', 1, { defaultDelete: true })],
  },
  {
    id: 'sched.no-forced-hpet',
    title: 'Remove forced platform clock (HPET) from boot config',
    category: 'scheduler',
    summary: 'Deletes the "useplatformclock" boot flag so Windows uses the low-overhead TSC timer.',
    description:
      'Old optimization guides told people to run "bcdedit /set useplatformclock true". That forces every timer query through the slow HPET hardware timer, which measurably increases timer overhead and input latency on modern Ryzen systems. This removes the flag if present, returning Windows to its default invariant-TSC timer. If the flag is not set, nothing changes. If BitLocker is on, Windows may ask for your recovery key on the next boot after any boot-configuration change.',
    impact: 'high', risk: 'safe', evidence: 'proven', reboot: 'restart',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [bcd('useplatformclock', null)],
  },
  {
    id: 'sched.disable-dynamic-tick',
    title: 'Disable dynamic tick',
    category: 'scheduler',
    summary: 'Keeps the system timer ticking at a fixed rate instead of coalescing idle ticks.',
    description:
      'Dynamic tick lets Windows skip timer interrupts while idle to save power. Disabling it keeps a regular tick, which some users find gives more consistent latency. Measured gains on desktop Ryzen are small and inconsistent, and idle power rises. Keep it only if you can measure a difference. It is a boot-configuration change, so BitLocker users may be asked for their recovery key on the next boot.',
    impact: 'low', risk: 'advanced', evidence: 'situational', reboot: 'restart',
    presets: ['extreme'],
    warning: 'Boot configuration change. Have your BitLocker recovery key available if drive encryption is on.',
    ops: [bcd('disabledynamictick', 'yes')],
  },

  // ─────────────────────── Windows gaming features ───────────────────────
  {
    id: 'gaming.game-mode-on',
    title: 'Keep Game Mode on',
    category: 'gaming',
    summary: 'Game Mode stops Windows Update and other background work from claiming resources while you play.',
    description:
      'Game Mode tells Windows to suspend Windows Update installs and driver installs and to deprioritize background processes while a game has focus. On dual-CCD Ryzen X3D CPUs (7900X3D, 7950X3D, 9900X3D, 9950X3D) it does more: Game Mode is the signal AMD\'s V-Cache driver uses to park the non-cache CCD so the game runs on the cache cores. Turning it off, as many old guides suggest, costs those CPUs a lot of performance.',
    impact: 'high', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword(GAMEBAR, 'AutoGameModeEnabled', 1, { default: 1 }),
      dword(GAMEBAR, 'AllowAutoGameMode', 1, { default: 1 }),
    ],
  },
  {
    id: 'gaming.game-dvr-off',
    title: 'Disable background recording (Game DVR)',
    category: 'gaming',
    summary: 'Stops Xbox Game Bar from constantly encoding the last few minutes of gameplay.',
    description:
      '"Record what happened" keeps a rolling capture buffer, which uses GPU encoder time, VRAM and some CPU in every game. This turns off background capture and app capture but leaves Xbox Game Bar installed. Game Bar must stay installed because dual-CCD X3D CPUs rely on it to detect games. Use NVIDIA Instant Replay or OBS for clips if you need them.',
    impact: 'medium', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword(GAMECONFIG, 'GameDVR_Enabled', 0, { default: 1 }),
      dword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', 0, { default: 1 }),
      dword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'HistoricalCaptureEnabled', 0, { default: 0 }),
    ],
  },
  {
    id: 'gaming.game-bar-quiet',
    title: 'Silence Game Bar pop-ups',
    category: 'gaming',
    summary: 'Stops the Game Bar startup panel and the controller Xbox button from opening overlays mid-game.',
    description:
      'Keeps Xbox Game Bar installed and working, which is required for X3D game detection, but stops it popping up. The startup tips panel is disabled and the Xbox/Guide button on a controller no longer opens the overlay. Win+G still works.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword(GAMEBAR, 'ShowStartupPanel', 0, { default: 1 }),
      dword(GAMEBAR, 'UseNexusForGameBarEnabled', 0, { default: 1 }),
    ],
  },
  {
    id: 'gaming.hags-on',
    title: 'Enable Hardware-accelerated GPU scheduling',
    category: 'gaming',
    summary: 'Lets the GPU manage its own memory and work queue instead of a CPU-side scheduler.',
    description:
      'With HAGS, the GPU\'s own scheduler processor manages its command queue, removing a layer of CPU work and buffering. NVIDIA requires it for DLSS Frame Generation, and on RTX 30/40/50 cards with current drivers it is neutral-to-positive for frame pacing. With NVIDIA Reflex on, as it should be in both games, latency is equal or slightly lower. If you see stutter after enabling it, try reverting. Older GTX cards benefit less.',
    impact: 'medium', risk: 'safe', evidence: 'situational', reboot: 'restart',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [dword(GFX, 'HwSchMode', 2, { default: 2 })],
  },
  {
    id: 'gaming.windowed-optimizations',
    title: 'Optimizations for windowed games (flip model)',
    category: 'gaming',
    summary: 'Upgrades DirectX 10/11 borderless and windowed games to the low-latency flip presentation model.',
    description:
      'Older DX10/11 games that run borderless or windowed use the "blt" presentation model, which adds a copy and usually a frame of compositor latency. This Windows 11 setting upgrades them to flip-model presentation. That enables independent flip, which matches exclusive-fullscreen latency, and lets VRR work in a window. VALORANT runs on DX11 and Fortnite\'s Performance mode on DX11, so both benefit when played borderless.',
    impact: 'medium', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [sz('HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences', 'DirectXUserGlobalSettings', 'SwapEffectUpgradeEnable=1;', { defaultDelete: true })],
  },
  {
    id: 'gaming.fso-global-off',
    title: 'Disable fullscreen optimizations globally',
    category: 'gaming',
    summary: 'Forces legacy exclusive fullscreen for every game instead of the flip-based "fullscreen optimizations" path.',
    description:
      'Windows silently runs "exclusive fullscreen" games through the desktop compositor in flip mode. On a modern system that has the same latency as true exclusive fullscreen and allows faster alt-tab. Some players still report smoother input with real exclusive mode, especially in DX11 titles. This is a try-it-and-compare change, so it is not in any preset. The per-game version (Fortnite & Valorant tab) is the more targeted option.',
    impact: 'low', risk: 'moderate', evidence: 'situational', reboot: 'signout',
    presets: [],
    ops: [
      dword(GAMECONFIG, 'GameDVR_FSEBehaviorMode', 2, { default: 0 }),
      dword(GAMECONFIG, 'GameDVR_HonorUserFSEBehaviorMode', 1, { default: 0 }),
      dword(GAMECONFIG, 'GameDVR_FSEBehavior', 2, { defaultDelete: true }),
      dword(GAMECONFIG, 'GameDVR_DXGIHonorFSEWindowsCompatible', 1, { default: 0 }),
    ],
  },
  {
    id: 'gaming.mpo-off',
    title: 'Disable Multiplane Overlay (troubleshooting)',
    category: 'gaming',
    summary: 'Only for flicker, black screens or stutter with multiple monitors. Not a performance tweak.',
    description:
      'Multiplane Overlay lets the display hardware compose some layers directly, which is part of how borderless games reach "independent flip" latency. On some multi-monitor and mixed-refresh setups, MPO causes flicker, browser stutter on a second screen, or black flashes. Disabling it fixes those but can add latency in windowed games, so use it only if you have those symptoms. Newer Windows 11 builds may ignore this key.',
    impact: 'low', risk: 'moderate', evidence: 'situational', reboot: 'restart',
    presets: [],
    ops: [dword('HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm', 'OverlayTestMode', 5, { defaultDelete: true })],
  },
  {
    id: 'gaming.fast-startup-off',
    title: 'Disable Fast Startup',
    category: 'gaming',
    summary: 'Makes "Shut down" a real shutdown so drivers and the kernel start fresh every boot.',
    description:
      'Fast Startup hibernates the kernel and drivers on shutdown instead of closing them. Driver state, including GPU, chipset and the V-Cache optimizer, can then carry over between sessions. That is a known cause of "it was smooth yesterday" problems and of driver updates not fully applying. Boot takes a few seconds longer on an NVMe drive.',
    impact: 'low', risk: 'safe', evidence: 'situational', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [dword('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power', 'HiberbootEnabled', 0, { default: 1 })],
  },
  {
    id: 'gaming.hibernation-off',
    title: 'Disable hibernation',
    category: 'gaming',
    summary: 'Turns hibernation off and deletes hiberfil.sys, freeing several GB on the system drive.',
    description:
      'Desktop gaming PCs rarely need hibernation. Turning it off removes hiberfil.sys, which is sized to a large fraction of your RAM (often 12-25 GB on a 32-64 GB system), and implies Fast Startup off. Sleep is unaffected.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['competitive', 'extreme'],
    ops: [
      ps({
        apply: `
$cur = Read-TRRegValue 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power' 'HibernateEnabled'
& powercfg.exe /hibernate off | Out-Null
@{ wasEnabled = (-not $cur.exists -or [int64]$cur.value -ne 0) }`,
        revert: `if ($null -eq $Backup -or $Backup.wasEnabled) { & powercfg.exe /hibernate on | Out-Null }`,
        detect: `$v = Read-TRRegValue 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power' 'HibernateEnabled'; $v.exists -and [int64]$v.value -eq 0`,
      }),
    ],
  },
  {
    id: 'gaming.transparency-off',
    title: 'Disable transparency effects',
    category: 'gaming',
    summary: 'Turns off acrylic blur in the taskbar, Start and Settings.',
    description:
      'Acrylic blur makes the compositor re-render the blurred layers whenever something behind them changes. The cost is tiny on an RTX GPU, but it is pure overhead while a game runs borderless with the taskbar on another monitor.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['competitive', 'extreme'],
    ops: [dword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency', 0, { default: 1 })],
  },
  {
    id: 'gaming.animations-off',
    title: 'Reduce window and menu animations',
    category: 'gaming',
    summary: 'Removes minimize/maximize animations, taskbar animations and the menu show delay.',
    description:
      'Makes alt-tabbing, opening Start and window snapping instant. It does not change game performance, but the desktop feels much snappier between matches.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'signout',
    presets: ['extreme'],
    ops: [
      sz('HKCU\\Control Panel\\Desktop\\WindowMetrics', 'MinAnimate', '0', { default: '1' }),
      dword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', 'TaskbarAnimations', 0, { default: 1 }),
      sz('HKCU\\Control Panel\\Desktop', 'MenuShowDelay', '0', { default: '400' }),
    ],
  },
  {
    id: 'gaming.memory-compression-off',
    title: 'Disable memory compression (16 GB+ RAM)',
    category: 'gaming',
    summary: 'Stops Windows compressing idle memory pages, trading RAM for less CPU work.',
    description:
      'Memory compression saves RAM by compressing pages that would otherwise be paged out, at the cost of CPU time to compress and decompress them. With 32 GB or more this rarely triggers anyway. Disabling it removes a source of occasional CPU spikes when a game reloads assets. Leave it on if you have 16 GB or less and run a browser alongside the game.',
    impact: 'low', risk: 'moderate', evidence: 'situational', reboot: 'restart',
    presets: ['extreme'],
    guard: `$gb = [math]::Round(((Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum) / 1GB); $gb -ge 16`,
    guardMessage: 'Needs at least 16 GB of RAM.',
    ops: [
      ps({
        apply: `$was = (Get-MMAgent).MemoryCompression; Disable-MMAgent -MemoryCompression | Out-Null; @{ wasEnabled = [bool]$was }`,
        revert: `if ($null -eq $Backup -or $Backup.wasEnabled) { Enable-MMAgent -MemoryCompression | Out-Null }`,
        detect: `-not (Get-MMAgent).MemoryCompression`,
      }),
    ],
  },
  {
    id: 'gaming.paging-executive-off',
    title: 'Keep kernel and drivers in RAM',
    category: 'gaming',
    summary: 'Prevents kernel-mode code and drivers from being paged out to disk.',
    description:
      'DisablePagingExecutive keeps the kernel and drivers resident in RAM, so a driver path is never served from the page file after the PC has been idle. On systems with 16 GB or more the RAM cost is negligible. The benefit is avoiding rare, long hitches rather than raising average FPS.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'restart',
    presets: ['competitive', 'extreme'],
    ops: [dword('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management', 'DisablePagingExecutive', 1, { default: 0 })],
  },
];
