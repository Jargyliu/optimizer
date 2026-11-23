'use strict';
const { dword, svc, task } = require('./helpers.cjs');

const POL = 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows';
const CDM = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager';
const ADV = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';

module.exports = [
  // ───────────────────────────── Background activity ─────────────────────────────
  {
    id: 'bg.background-apps-off',
    title: 'Block Store apps from running in the background',
    category: 'background',
    summary: 'Stops Microsoft Store (UWP) apps from waking in the background to sync, update tiles or fetch content.',
    description:
      'Store apps such as Mail, Weather, Photos and Phone Link can run background tasks on timers and network changes. This group policy stops them unless you open the app. Desktop apps (Discord, Steam, Epic) are not affected. The trade-off: Store apps will not deliver notifications while closed.',
    impact: 'low', risk: 'moderate', evidence: 'minor', reboot: 'none',
    presets: ['competitive', 'extreme'],
    ops: [dword(`${POL}\\AppPrivacy`, 'LetAppsRunInBackground', 2)],
  },
  {
    id: 'bg.edge-background-off',
    title: 'Stop Microsoft Edge running in the background',
    category: 'background',
    summary: 'Disables Edge Startup Boost and "continue running background apps when Edge is closed".',
    description:
      'Edge pre-launches at sign-in (Startup Boost) and keeps processes alive after you close it, holding hundreds of MB of RAM and waking periodically. Disabling both means Edge only runs when you open it, and it opens slightly slower the first time.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword('HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge', 'StartupBoostEnabled', 0),
      dword('HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge', 'BackgroundModeEnabled', 0),
    ],
  },
  {
    id: 'bg.widgets-off',
    title: 'Disable Widgets (News and interests)',
    category: 'background',
    summary: 'Removes the Widgets board and its always-running WebView host.',
    description:
      'The Widgets board runs a WebView2 host process that refreshes news and weather in the background even if you never open it, and it can pop open when you hover the taskbar corner mid-game. This turns the feature off by policy.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'signout',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [dword('HKLM\\SOFTWARE\\Policies\\Microsoft\\Dsh', 'AllowNewsAndInterests', 0)],
  },
  {
    id: 'bg.copilot-recall-off',
    title: 'Disable Copilot and Recall',
    category: 'background',
    summary: 'Turns off Windows Copilot, its taskbar button and Recall\'s continuous screen snapshots.',
    description:
      'On Copilot+ PCs, Recall takes a screenshot every few seconds and runs on-device OCR and indexing on it: constant background CPU, NPU and disk work, and a privacy concern. This disables Recall snapshots, blocks Recall from being enabled, turns off Windows Copilot by policy and hides the Copilot taskbar button. Nothing changes on PCs without these features.',
    impact: 'medium', risk: 'safe', evidence: 'situational', reboot: 'signout',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword(`${POL}\\WindowsAI`, 'DisableAIDataAnalysis', 1),
      dword(`${POL}\\WindowsAI`, 'AllowRecallEnablement', 0),
      dword(`${POL}\\WindowsCopilot`, 'TurnOffWindowsCopilot', 1),
      dword('HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot', 'TurnOffWindowsCopilot', 1),
      dword(ADV, 'ShowCopilotButton', 0, { default: 1 }),
    ],
  },
  {
    id: 'bg.web-search-off',
    title: 'Disable Bing web results in Start search',
    category: 'background',
    summary: 'Keeps Start-menu search local so typing does not send network requests or load web results.',
    description:
      'Every keystroke in Start search queries Bing and renders web results, which makes search slow and occasionally hangs Start. This makes search local-only: apps, settings and files.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'signout',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword('HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer', 'DisableSearchBoxSuggestions', 1),
      dword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', 0, { default: 1 }),
    ],
  },
  {
    id: 'bg.consumer-features-off',
    title: 'Stop suggested apps, ads and auto-installs',
    category: 'background',
    summary: 'Prevents Windows silently installing promoted apps and showing suggestions in Start, Settings and the lock screen.',
    description:
      'Windows "consumer features" quietly download promoted apps (games, streaming apps) and show tips and ads in Start, Settings and the lock screen. Those installs happen in the background, sometimes while you play. This disables silent installs, suggestions, "welcome experience" pages and Start recommendations.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'signout',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword(`${POL}\\CloudContent`, 'DisableWindowsConsumerFeatures', 1),
      dword(`${POL}\\CloudContent`, 'DisableSoftLanding', 1),
      dword(CDM, 'SilentInstalledAppsEnabled', 0, { default: 1 }),
      dword(CDM, 'SystemPaneSuggestionsEnabled', 0, { default: 1 }),
      dword(CDM, 'SoftLandingEnabled', 0, { default: 1 }),
      dword(CDM, 'SubscribedContent-338388Enabled', 0, { default: 1 }),
      dword(CDM, 'SubscribedContent-338389Enabled', 0, { default: 1 }),
      dword(CDM, 'SubscribedContent-353694Enabled', 0, { default: 1 }),
      dword(CDM, 'SubscribedContent-353696Enabled', 0, { default: 1 }),
      dword(ADV, 'Start_IrisRecommendations', 0, { default: 1 }),
    ],
  },

  // ───────────────────────────── Privacy & telemetry ─────────────────────────────
  {
    id: 'privacy.telemetry-off',
    title: 'Minimize Windows telemetry',
    category: 'privacy',
    summary: 'Sets diagnostic data to the minimum and disables the telemetry service and its compatibility scanners.',
    description:
      'The Connected User Experiences service (DiagTrack) and the Compatibility Appraiser (CompatTelRunner.exe) periodically scan installed programs and upload diagnostics. The Appraiser in particular can pin a CPU core and hammer the disk for minutes, sometimes mid-session. This sets AllowTelemetry to the lowest level your edition allows, disables DiagTrack and the WAP push service, and disables the Appraiser, CEIP and disk-diagnostic scheduled tasks.',
    impact: 'medium', risk: 'safe', evidence: 'situational', reboot: 'restart',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword(`${POL}\\DataCollection`, 'AllowTelemetry', 0),
      dword(`${POL}\\DataCollection`, 'DoNotShowFeedbackNotifications', 1),
      svc('DiagTrack', 'Disabled', 'Automatic'),
      svc('dmwappushservice', 'Disabled', 'Manual'),
      task('\\Microsoft\\Windows\\Application Experience\\', 'Microsoft Compatibility Appraiser'),
      task('\\Microsoft\\Windows\\Application Experience\\', 'Microsoft Compatibility Appraiser Exp'),
      task('\\Microsoft\\Windows\\Application Experience\\', 'ProgramDataUpdater'),
      task('\\Microsoft\\Windows\\Application Experience\\', 'StartupAppTask'),
      task('\\Microsoft\\Windows\\Customer Experience Improvement Program\\', 'Consolidator'),
      task('\\Microsoft\\Windows\\Customer Experience Improvement Program\\', 'UsbCeip'),
      task('\\Microsoft\\Windows\\Autochk\\', 'Proxy'),
      task('\\Microsoft\\Windows\\DiskDiagnostic\\', 'Microsoft-Windows-DiskDiagnosticDataCollector'),
    ],
  },
  {
    id: 'privacy.advertising-off',
    title: 'Disable advertising ID and tailored experiences',
    category: 'privacy',
    summary: 'Turns off the per-user advertising identifier and diagnostic-data-based tips and offers.',
    description:
      'Disables the advertising ID apps use to track you across apps, and stops Windows from using your diagnostic data for personalized tips, ads and recommendations. This is a privacy change with no performance effect.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      dword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', 'Enabled', 0, { default: 1 }),
      dword(`${POL}\\AdvertisingInfo`, 'DisabledByGroupPolicy', 1),
      dword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', 'TailoredExperiencesWithDiagnosticDataEnabled', 0, { default: 1 }),
      dword('HKCU\\Software\\Microsoft\\Siuf\\Rules', 'NumberOfSIUFInPeriod', 0, { defaultDelete: true }),
    ],
  },
  {
    id: 'privacy.activity-history-off',
    title: 'Disable activity history',
    category: 'privacy',
    summary: 'Stops Windows recording which apps, files and sites you use.',
    description:
      'Turns off the activity feed that records app and document usage locally and can sync it to your Microsoft account. This is a privacy change that also removes a small amount of background database writing.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['competitive', 'extreme'],
    ops: [
      dword(`${POL}\\System`, 'EnableActivityFeed', 0),
      dword(`${POL}\\System`, 'PublishUserActivities', 0),
      dword(`${POL}\\System`, 'UploadUserActivities', 0),
    ],
  },
  {
    id: 'privacy.error-reporting-off',
    title: 'Disable Windows Error Reporting uploads',
    category: 'privacy',
    summary: 'Stops crash reports from being collected and uploaded in the background after an app crashes.',
    description:
      'After a crash, WER gathers a dump and uploads it, which can take noticeable disk and CPU time right when you relaunch the game. Local crash dumps for the game itself (Fortnite/Riot crash folders) are unaffected. The service is set to Manual rather than Disabled so dependent components still work.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['competitive', 'extreme'],
    ops: [
      dword('HKLM\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting', 'Disabled', 1, { default: 0 }),
      svc('WerSvc', 'Manual', 'Manual'),
    ],
  },
  {
    id: 'privacy.delivery-optimization-p2p-off',
    title: 'Stop sharing Windows updates with other PCs',
    category: 'privacy',
    summary: 'Turns off peer-to-peer update delivery so your upload is not used to seed updates while you play.',
    description:
      'Delivery Optimization can upload Windows and Store updates to other PCs on your network or the internet. Upload saturation is a classic cause of ping spikes and packet loss. This keeps update downloads working normally (HTTP only, from Microsoft) but stops peer-to-peer sharing.',
    impact: 'medium', risk: 'safe', evidence: 'proven', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [dword(`${POL}\\DeliveryOptimization`, 'DODownloadMode', 0)],
  },

  // ───────────────────────────── Windows Update ─────────────────────────────
  {
    id: 'updates.no-driver-updates',
    title: 'Stop Windows Update replacing your GPU and chipset drivers',
    category: 'updates',
    summary: 'Excludes drivers from Windows Update so it cannot overwrite your NVIDIA or AMD chipset driver.',
    description:
      'Windows Update regularly "updates" GPU drivers to an older OEM build, or swaps the AMD chipset driver package. That can break the V-Cache optimizer and reset your NVIDIA profile settings. With this on, you install drivers yourself from NVIDIA and AMD, which you should be doing for a gaming PC anyway. Security and quality updates are unaffected.',
    impact: 'medium', risk: 'moderate', evidence: 'proven', reboot: 'none',
    presets: ['competitive', 'extreme'],
    warning: 'You become responsible for driver updates: use NVIDIA App or nvidia.com and AMD\'s chipset driver page.',
    ops: [dword(`${POL}\\WindowsUpdate`, 'ExcludeWUDriversInQualityUpdate', 1)],
  },
  {
    id: 'updates.no-auto-restart',
    title: 'Never auto-restart while you are signed in',
    category: 'updates',
    summary: 'Prevents Windows Update from rebooting the PC on its own while a user is logged on.',
    description:
      'Windows still downloads and installs updates, but it waits for you to restart instead of forcing a reboot. Pair it with a manual restart after big updates.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [dword(`${POL}\\WindowsUpdate\\AU`, 'NoAutoRebootWithLoggedOnUsers', 1)],
  },

  // ───────────────────────────── Services ─────────────────────────────
  {
    id: 'svc.unneeded-pack',
    title: 'Disable unneeded legacy services',
    category: 'services',
    summary: 'Fax, Maps download manager, Retail Demo, Remote Registry, Wallet and Windows Insider services.',
    description:
      'Disables services that a home gaming PC never uses: Fax (Fax), Downloaded Maps Manager (MapsBroker), Retail Demo (RetailDemo), Remote Registry (RemoteRegistry), WalletService and the Windows Insider Service (wisvc). None run constantly. Disabling them removes trigger-start wake-ups and reduces attack surface. Services that Windows, Xbox/Game Pass, Store, EAC or Vanguard depend on are deliberately left alone.',
    impact: 'low', risk: 'safe', evidence: 'minor', reboot: 'none',
    presets: ['essential', 'competitive', 'extreme'],
    ops: [
      svc('Fax', 'Disabled', 'Manual'),
      svc('MapsBroker', 'Disabled', 'Automatic'),
      svc('RetailDemo', 'Disabled', 'Manual'),
      svc('RemoteRegistry', 'Disabled', 'Disabled'),
      svc('WalletService', 'Disabled', 'Manual'),
      svc('wisvc', 'Disabled', 'Manual'),
    ],
  },
  {
    id: 'svc.sysmain-off',
    title: 'Disable SysMain (Superfetch)',
    category: 'services',
    summary: 'Stops Windows pre-loading frequently used apps into RAM in the background.',
    description:
      'SysMain learns your app usage and preloads apps into standby memory. On an NVMe SSD the benefit is small, and the background reads and memory reshuffling can coincide with gameplay. Disabling it makes app launches slightly slower after a reboot. It is a reasonable trade on a dedicated gaming PC, less so on a mixed work machine.',
    impact: 'low', risk: 'moderate', evidence: 'situational', reboot: 'none',
    presets: ['extreme'],
    ops: [svc('SysMain', 'Disabled', 'Automatic')],
  },
  {
    id: 'svc.search-indexer-off',
    title: 'Disable Windows Search indexing',
    category: 'services',
    summary: 'Stops the indexer crawling your drives. Start search still finds apps and settings, but file search is slower.',
    description:
      'The search indexer re-crawls files when they change. Game updates (Fortnite patches are many GB) can trigger long bursts of indexer CPU and disk activity. Disabling it removes that. Start-menu search still finds apps and settings, but searching file contents becomes slow. Skip this if you rely on file search.',
    impact: 'low', risk: 'moderate', evidence: 'situational', reboot: 'none',
    presets: ['extreme'],
    ops: [svc('WSearch', 'Disabled', 'Automatic')],
  },
  {
    id: 'svc.print-spooler-off',
    title: 'Disable Print Spooler (no printer)',
    category: 'services',
    summary: 'Only if you never print. Disables the print service and its attack surface.',
    description:
      'Print Spooler is always running and has a long history of security vulnerabilities (PrintNightmare). If you never print or use "Print to PDF", disabling it frees a process and closes that attack surface. Printing will not work until you revert this.',
    impact: 'low', risk: 'moderate', evidence: 'minor', reboot: 'none',
    presets: [],
    ops: [svc('Spooler', 'Disabled', 'Automatic')],
  },
];
