'use strict';

const tweaks = [
  ...require('./core.cjs'),
  ...require('./hardware.cjs'),
  ...require('./games.cjs'),
  ...require('./debloat.cjs'),
];

const categories = [
  { id: 'input', label: 'Input & mouse', blurb: 'Make the desktop and menus feel like raw input.' },
  { id: 'scheduler', label: 'Scheduler & timers', blurb: 'How Windows hands out CPU time and keeps time.' },
  { id: 'x3d', label: 'Ryzen X3D', blurb: 'V-Cache scheduling for 3D V-Cache CPUs.' },
  { id: 'power', label: 'Power plan', blurb: 'Clocks, parking and device power saving.' },
  { id: 'gpu', label: 'NVIDIA & graphics', blurb: 'Interrupts and driver housekeeping. Driver profiles are on the NVIDIA page.' },
  { id: 'gaming', label: 'Windows gaming', blurb: 'Game Mode, capture, presentation model and memory.' },
  { id: 'games', label: 'Fortnite & VALORANT', blurb: 'Per-game priority, GPU choice and scanning.' },
  { id: 'network', label: 'Network', blurb: 'Adapter power saving, interrupts and QoS.' },
  { id: 'background', label: 'Background apps', blurb: 'Things that wake up while you play.' },
  { id: 'privacy', label: 'Privacy & telemetry', blurb: 'Data collection that costs CPU, disk and upload.' },
  { id: 'updates', label: 'Windows Update', blurb: 'Keep updates from breaking your setup.' },
  { id: 'services', label: 'Services', blurb: 'Services a gaming PC does not need.' },
];

const presets = [
  { id: 'essential', label: 'Essential', blurb: 'Safe, proven changes with no meaningful trade-offs. Start here.' },
  { id: 'competitive', label: 'Competitive', blurb: 'Essential plus priority, network and update tweaks with small, documented trade-offs.' },
  { id: 'extreme', label: 'Everything', blurb: 'Competitive plus situational tweaks. Test them one at a time if something feels off.' },
];

// Store apps offered for removal. Patterns are Get-AppxPackage -Name wildcards.
const apps = [
  { pattern: 'Microsoft.BingNews', label: 'News', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.BingWeather', label: 'Weather', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.BingSearch', label: 'Bing Search', group: 'Microsoft extras', recommended: true },
  { pattern: 'Clipchamp.Clipchamp', label: 'Clipchamp video editor', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.GetHelp', label: 'Get Help', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.Getstarted', label: 'Tips', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.MicrosoftSolitaireCollection', label: 'Solitaire Collection', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.MicrosoftOfficeHub', label: 'Microsoft 365 (Office) hub', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.People', label: 'People', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.PowerAutomateDesktop', label: 'Power Automate', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.Todos', label: 'Microsoft To Do', group: 'Microsoft extras', recommended: false },
  { pattern: 'Microsoft.WindowsFeedbackHub', label: 'Feedback Hub', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.WindowsMaps', label: 'Maps', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.ZuneVideo', label: 'Films & TV', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.MixedReality.Portal', label: 'Mixed Reality Portal', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.Microsoft3DViewer', label: '3D Viewer', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.549981C3F5F10', label: 'Cortana', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.Windows.DevHome', label: 'Dev Home', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.OutlookForWindows', label: 'Outlook (new)', group: 'Microsoft extras', recommended: false },
  { pattern: 'Microsoft.Copilot', label: 'Copilot app', group: 'Microsoft extras', recommended: false },
  { pattern: 'MSTeams', label: 'Microsoft Teams (personal)', group: 'Microsoft extras', recommended: false },
  { pattern: 'MicrosoftTeams', label: 'Microsoft Teams (classic personal)', group: 'Microsoft extras', recommended: false },
  { pattern: 'Microsoft.SkypeApp', label: 'Skype', group: 'Microsoft extras', recommended: true },
  { pattern: 'Microsoft.YourPhone', label: 'Phone Link', group: 'Microsoft extras', recommended: false },
  { pattern: 'Microsoft.ZuneMusic', label: 'Media Player', group: 'Microsoft extras', recommended: false },
  { pattern: 'Microsoft.WindowsSoundRecorder', label: 'Sound Recorder', group: 'Microsoft extras', recommended: false },
  { pattern: 'Microsoft.WindowsAlarms', label: 'Clock & Alarms', group: 'Microsoft extras', recommended: false },
  { pattern: 'Microsoft.MicrosoftStickyNotes', label: 'Sticky Notes', group: 'Microsoft extras', recommended: false },
  { pattern: 'MicrosoftCorporationII.QuickAssist', label: 'Quick Assist', group: 'Microsoft extras', recommended: false },
  { pattern: 'king.com.*', label: 'Candy Crush and other King games', group: 'Promoted third-party', recommended: true },
  { pattern: 'SpotifyAB.SpotifyMusic', label: 'Spotify (Store version)', group: 'Promoted third-party', recommended: false },
  { pattern: 'Disney.*', label: 'Disney+', group: 'Promoted third-party', recommended: true },
  { pattern: 'AmazonVideo.PrimeVideo', label: 'Prime Video', group: 'Promoted third-party', recommended: true },
  { pattern: 'BytedancePte.Ltd.TikTok', label: 'TikTok', group: 'Promoted third-party', recommended: true },
  { pattern: 'Facebook.*', label: 'Facebook / Instagram', group: 'Promoted third-party', recommended: true },
  { pattern: '*LinkedInforWindows', label: 'LinkedIn', group: 'Promoted third-party', recommended: true },
];

// Shown on the debloat page as "kept on purpose", with the reason.
const protectedApps = [
  { label: 'Xbox Game Bar', reason: 'Dual-CCD X3D CPUs depend on it to detect games and park the right CCD. It also provides Game Mode detection.' },
  { label: 'Gaming Services & Xbox Identity Provider', reason: 'Needed by Game Pass, the Xbox app and some anti-cheat and launcher integrations.' },
  { label: 'Microsoft Store & App Installer (winget)', reason: 'Needed to reinstall anything removed here and to update the components above.' },
  { label: 'VCLibs, UI.Xaml, .NET Native, WebView2', reason: 'Shared frameworks that other apps, including the NVIDIA App, need to run.' },
  { label: 'Microsoft Edge', reason: 'WebView2 and parts of Windows use it. Tickrate stops it running in the background instead.' },
];

const cleanupTargets = [
  { id: 'user-temp', label: 'Your temp files', detail: '%TEMP%: installers and apps leave files here and rarely clean up. Files from the last 24 hours are kept because they may still be in use.', recommended: true },
  { id: 'windows-temp', label: 'Windows temp files', detail: 'C:\\Windows\\Temp. Files from the last 24 hours are kept.', recommended: true },
  { id: 'wu-cache', label: 'Windows Update download cache', detail: 'Already-installed update packages. Windows re-downloads if needed.', recommended: true },
  { id: 'delivery-opt', label: 'Delivery Optimization cache', detail: 'Cached update chunks kept for peer-to-peer sharing.', recommended: true },
  { id: 'crash-dumps', label: 'Crash dumps', detail: 'Minidumps, MEMORY.DMP and live kernel reports. Keep them if you are diagnosing a BSOD.', recommended: true },
  { id: 'wer', label: 'Error reports', detail: 'Queued and archived Windows Error Reporting files.', recommended: true },
  { id: 'fortnite-logs', label: 'Fortnite logs & crash reports', detail: '%LOCALAPPDATA%\\FortniteGame\\Saved\\Logs and \\Crashes', recommended: true },
  { id: 'valorant-logs', label: 'VALORANT & Riot Client logs', detail: 'Game and Riot Client log folders.', recommended: true },
  { id: 'epic-webcache', label: 'Epic Games Launcher web cache', detail: 'Launcher browser cache. Fixes a slow or glitchy launcher store page.', recommended: true },
  { id: 'windows-logs', label: 'Windows setup & servicing logs', detail: 'CBS, DISM and Panther logs older than 7 days.', recommended: true },
  { id: 'thumbnails', label: 'Thumbnail cache', detail: 'Explorer rebuilds thumbnails as you browse.', recommended: false },
  { id: 'nvidia-shader', label: 'NVIDIA shader cache', detail: 'Clear only after a driver update or if you have shader corruption. The first matches afterwards stutter while shaders rebuild.', recommended: false },
  { id: 'd3d-shader', label: 'DirectX shader cache', detail: 'Same trade-off as the NVIDIA cache: clear after driver updates, expect one-time rebuild stutter.', recommended: false },
  { id: 'recycle-bin', label: 'Recycle Bin', detail: 'Permanently deletes everything in the Recycle Bin.', recommended: false },
];

const maintenanceTasks = [
  { id: 'trim', label: 'Optimize drives', detail: 'Runs TRIM on SSDs (and defrag on any HDD). Keeps NVMe write performance consistent.', minutes: '1-3' },
  { id: 'flush-dns', label: 'Flush DNS cache', detail: 'Clears cached DNS lookups. Useful if a launcher or matchmaking endpoint will not resolve.', minutes: '<1' },
  { id: 'dism-cleanup', label: 'Component store cleanup', detail: 'DISM /StartComponentCleanup removes superseded Windows Update components and frees space.', minutes: '5-15' },
  { id: 'sfc', label: 'System file check', detail: 'sfc /scannow verifies and repairs protected Windows files. Run DISM repair first if it reports errors it cannot fix.', minutes: '5-15' },
  { id: 'dism-restore', label: 'Repair Windows image', detail: 'DISM /RestoreHealth repairs the component store from Windows Update. Use it when SFC cannot repair files.', minutes: '10-30' },
  { id: 'restart-explorer', label: 'Restart Explorer', detail: 'Restarts the taskbar and desktop shell. Fixes a frozen taskbar without rebooting.', minutes: '<1' },
  { id: 'reset-network', label: 'Reset network stack', detail: 'netsh winsock reset + int ip reset. Fixes broken networking after VPNs or bad tweaks. Requires restart and resets custom IP settings.', minutes: '<1', danger: true },
];

/**
 * NVIDIA driver profile (Base Profile) settings applied through NVIDIA Profile Inspector.
 * IDs and values are taken from nvidiaProfileInspector/CustomSettingNames.xml.
 */
const nvidiaSettings = [
  {
    key: 'power', id: 0x1057eb71, name: 'Power Management - Mode', label: 'Power management mode', default: 0, recommended: 1,
    options: [{ value: 0, label: 'Adaptive (driver default)' }, { value: 5, label: 'Optimal performance' }, { value: 1, label: 'Prefer maximum performance' }],
    description: 'Keeps the GPU at its full boost clock while a 3D app runs instead of ramping up and down. That matters most for light, CPU-bound esports loads such as VALORANT at 400+ FPS, where the GPU otherwise downclocks between frames and frame times wobble. Costs some power while games are open. The desktop still idles down.',
  },
  {
    key: 'mprf', id: 0x007ba09e, name: 'Maximum Pre-Rendered Frames', label: 'Low latency mode (max pre-rendered frames)', default: 0, recommended: 1,
    options: [{ value: 0, label: 'Off: app controlled' }, { value: 1, label: 'On: 1 queued frame' }],
    description: 'Limits the CPU to queuing one frame ahead of the GPU in games without NVIDIA Reflex. Fortnite and VALORANT both support Reflex, which overrides this in-game, so this mainly covers other games and the launchers.',
  },
  {
    key: 'shadercache', id: 0x00ac8497, name: 'Shader Cache - Cache Size', label: 'Shader cache size', default: 4096, recommended: 0xffffffff,
    options: [{ value: 4096, label: '4 GB (driver default)' }, { value: 10240, label: '10 GB' }, { value: 102400, label: '100 GB' }, { value: 0xffffffff, label: 'Unlimited' }],
    description: 'Fortnite, especially on DX12, compiles thousands of shaders, and every Fortnite update plus other games share the 4 GB default. When the cache fills, old shaders are evicted and recompiled mid-match, which causes stutter. Unlimited stops that. It uses disk space, which the Cleanup page can reclaim after driver updates.',
  },
  {
    key: 'texq', id: 0x00ce2691, name: 'Texture Filtering - Quality', label: 'Texture filtering quality', default: 0, recommended: 20,
    options: [{ value: 0xfffffff6, label: 'High quality' }, { value: 0, label: 'Quality (default)' }, { value: 10, label: 'Performance' }, { value: 20, label: 'High performance' }],
    description: 'Lets the driver use cheaper texture-filtering shortcuts. Gains are small on RTX cards (around 1-2%), with slightly softer textures at grazing angles. Competitive players usually take it.',
  },
  {
    key: 'trilinear', id: 0x002ecaf2, name: 'Texture Filtering - Trilinear Optimization', label: 'Trilinear optimization', default: 0, recommended: 0,
    options: [{ value: 0, label: 'On (default)' }, { value: 1, label: 'Off' }],
    description: 'Keeps the driver\'s trilinear filtering optimization on, which goes with the High performance texture filtering above.',
  },
  {
    key: 'anisoopt', id: 0x00e73211, name: 'Anisotropic Filter - Sample Optimization', label: 'Anisotropic sample optimization', default: 0, recommended: 1,
    options: [{ value: 0, label: 'Off (default)' }, { value: 1, label: 'On' }],
    description: 'Reduces the number of anisotropic filtering samples where the difference is not visible. A small GPU saving with negligible visual change.',
  },
  {
    key: 'threaded', id: 0x20c1221e, name: 'Threaded Optimization', label: 'Threaded optimization', default: 0, recommended: 0,
    options: [{ value: 0, label: 'Auto (recommended)' }, { value: 1, label: 'On' }, { value: 2, label: 'Off' }],
    description: 'Lets the driver offload work to extra CPU threads. Auto lets NVIDIA decide per game, which is the right call for both titles. Forcing On can hurt some DX11 games, so it is listed here only so you can see it is left at Auto on purpose.',
  },
  {
    key: 'vsync', id: 0x00a879cf, name: 'Vertical Sync', label: 'Vertical sync', default: 0x60925292, recommended: 0x60925292, dependsOnVrr: true,
    options: [{ value: 0x60925292, label: 'Use the 3D application setting' }, { value: 0x08416747, label: 'Force off' }, { value: 0x47814940, label: 'Force on (for G-SYNC)' }],
    description: 'With a G-SYNC or G-SYNC Compatible monitor, the lowest-latency tear-free setup is G-SYNC on, V-Sync forced on here, V-Sync off in-game and Reflex On + Boost: Reflex then caps FPS just under your refresh rate automatically. On a fixed-refresh monitor, force V-Sync off. Pick your monitor type above and this is set for you.',
  },
  {
    key: 'refresh', id: 0x0064b541, name: 'Prefered Refreshrate', label: 'Preferred refresh rate', default: 0, recommended: 1,
    options: [{ value: 0, label: 'Application controlled' }, { value: 1, label: 'Highest available' }],
    description: 'Forces exclusive-fullscreen games to use your monitor\'s highest refresh rate, even if the game asks for 60 Hz.',
  },
];

// Things we deliberately did NOT include, with the reasoning. Rendered on the Tweaks page and in docs.
const excluded = [
  { title: 'Disable Memory Integrity (HVCI) / VBS', reason: 'VALORANT\'s Vanguard On-Demand mode (2026) requires VBS, HVCI, IOMMU, TPM 2.0 and Secure Boot, and Fortnite PC tournaments check Secure Boot, TPM and IOMMU. Turning these off can block you from matches. The FPS cost of HVCI on Zen 4/5 is small (a few % at most in CPU-bound scenes).' },
  { title: 'Disable Spectre/Meltdown mitigations', reason: 'A real security risk for very little gain on Zen 4/Zen 5, where the hardware mitigations are cheap.' },
  { title: 'Disable HPET in Device Manager / force "useplatformclock"', reason: 'Forcing HPET increases timer overhead and latency. Tickrate does the opposite and removes a forced HPET flag if one exists.' },
  { title: 'Disable CPU idle states (C-states) from the power plan', reason: 'X3D CPUs are temperature-limited. Pinning every core awake raises temperature and lowers boost clocks, which is the opposite of the goal.' },
  { title: 'High/Ultimate Performance plan on dual-CCD X3D', reason: 'Breaks AMD\'s CCD parking, so games spill onto the non-V-Cache CCD. Dual-CCD chips get a tuned Balanced plan instead.' },
  { title: 'Uninstall Xbox Game Bar', reason: 'Dual-CCD X3D CPUs need it for game detection, and it powers Game Mode detection on every PC.' },
  { title: 'Nagle\'s algorithm (TcpAckFrequency / TCPNoDelay)', reason: 'Only affects TCP. Fortnite and VALORANT gameplay traffic is UDP, so it does nothing for them.' },
  { title: 'TCP auto-tuning / "network throttling" registry packs', reason: 'Myths from the Windows XP/7 era with no measurable effect on UDP game traffic.' },
  { title: 'Mouse/keyboard data queue size (mouclass/kbdclass)', reason: 'Changes buffer size, not latency. Values set too low drop input events.' },
  { title: 'GPU interrupt priority / affinity overrides', reason: 'Obsolete on modern Windows with MSI-X GPUs, and wrong values cause stutter. Tickrate only ensures MSI mode is on.' },
  { title: 'DisableDynamicPstate (lock GPU clocks)', reason: 'Keeps the GPU at full clocks on the desktop 24/7. "Prefer maximum performance" in the driver profile gets the in-game benefit without that.' },
  { title: 'Disable the page file', reason: 'Causes crashes when committed memory runs out (Fortnite plus a browser can do it) and gives no FPS benefit with enough RAM.' },
  { title: 'Disable DEP / test-signing / driver signature enforcement', reason: 'Easy Anti-Cheat and Vanguard refuse to run with these, and they are serious security holes.' },
  { title: '"Realtime" process priority for games', reason: 'Starves input, audio and driver threads and can freeze the system. Tickrate uses High priority instead.' },
];

module.exports = { tweaks, categories, presets, apps, protectedApps, cleanupTargets, maintenanceTasks, nvidiaSettings, excluded };
