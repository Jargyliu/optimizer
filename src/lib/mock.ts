// Demo bridge used when the UI runs outside Electron-on-Windows (browser dev, screenshots, macOS/Linux).
// Nothing here touches the system.
import type { Catalog, LogLine, ScanFacts, Settings, TickrateBridge, TweakStatus } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockBridge(): TickrateBridge {
  let catalog: Catalog | null = null;
  const listeners = new Set<(l: LogLine) => void>();
  const applied = new Set<string>([
    'input.mouse-acceleration-off', 'input.pointer-speed-default', 'gaming.game-mode-on', 'gaming.hags-on', 'sched.no-forced-hpet',
  ]);
  let settings: Settings = { autoRestorePoint: true, monitorType: null };
  let nvidiaInstalled = false;
  let nvidiaApplied: any = null;
  const restorePoints = [
    { seq: 41, description: 'Windows Update', created: new Date(Date.now() - 86400e3 * 3).toISOString(), type: 0 },
    { seq: 42, description: 'Installed NVIDIA Graphics Driver', created: new Date(Date.now() - 86400e3).toISOString(), type: 0 },
  ];
  const startup = [
    { id: 'HKCU Run|Discord', name: 'Discord', command: 'C:\\Users\\player\\AppData\\Local\\Discord\\Update.exe --processStart Discord.exe', source: 'HKCU Run', enabled: true },
    { id: 'HKCU Run|Steam', name: 'Steam', command: '"C:\\Program Files (x86)\\Steam\\steam.exe" -silent', source: 'HKCU Run', enabled: true },
    { id: 'HKCU Run|OneDrive', name: 'OneDrive', command: '"C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe" /background', source: 'HKCU Run', enabled: true },
    { id: 'HKLM Run|RtkAudUService', name: 'RtkAudUService', command: '"C:\\Windows\\System32\\RtkAudUService64.exe" -background', source: 'HKLM Run', enabled: true },
    { id: 'HKCU Run|EpicGamesLauncher', name: 'EpicGamesLauncher', command: '"C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe" -silent', source: 'HKCU Run', enabled: false },
    { id: 'Startup folder|Spotify.lnk', name: 'Spotify', command: 'C:\\Users\\player\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Spotify.lnk', source: 'Startup folder', enabled: true },
  ];

  const emit = (message: string, action = 'demo', level: LogLine['level'] = 'info') => {
    const line = { time: new Date().toISOString(), action, level, message };
    listeners.forEach((l) => l(line));
  };

  const scan: ScanFacts = {
    scannedAt: new Date().toISOString(),
    os: { caption: 'Microsoft Windows 11 Pro', build: 26200, ubr: 7171, displayVersion: '25H2', edition: 'Professional', uptimeHours: 31.4, pendingReboot: false },
    cpu: { name: 'AMD Ryzen 9 9950X3D 16-Core Processor', cores: 16, threads: 32, maxMHz: 4300, class: 'x3d-dual', vcacheDriver: true, vcacheDefaultType: 0 },
    gpus: [
      { name: 'NVIDIA GeForce RTX 5080', driver: '32.0.15.8180', driverDate: '2026-10-28', vendor: 'nvidia' },
      { name: 'AMD Radeon(TM) Graphics', driver: '32.0.21025.1', driverDate: '2026-06-11', vendor: 'amd' },
    ],
    nvidia: { name: 'NVIDIA GeForce RTX 5080', driver: '581.80', pcieGenMax: '5', pcieWidthMax: '16', pcieGenCur: '1', pcieWidthCur: '16', tempC: '41', vramMiB: '16303', powerW: '23.71', maxClock: '3105', bar1MiB: 16384, rebar: true },
    gpuMsi: [{ name: 'NVIDIA GeForce RTX 5080', msi: true }],
    memory: { totalGB: 32, modules: 2, type: 'DDR5', ratedMTs: 6000, configuredMTs: 4800 },
    displays: [
      { device: '\\\\.\\DISPLAY1', adapter: 'NVIDIA GeForce RTX 5080', width: 2560, height: 1440, refresh: 144, maxRefresh: 360, primary: true },
      { device: '\\\\.\\DISPLAY2', adapter: 'NVIDIA GeForce RTX 5080', width: 1920, height: 1080, refresh: 60, maxRefresh: 75, primary: false },
    ],
    storage: { systemFreeGB: 212.6, systemTotalGB: 931, disks: [{ name: 'Samsung SSD 990 PRO 1TB', media: 'SSD', bus: 'NVMe', sizeGB: 932 }, { name: 'WD_BLACK SN850X 2TB', media: 'SSD', bus: 'NVMe', sizeGB: 1863 }] },
    security: { secureBoot: true, tpm: { present: true, ready: true }, bitlocker: false, vbsRunning: true, hvciRunning: true },
    settings: { gameMode: 1, gameDvr: 1, appCapture: 1, hags: 2, mouseSpeed: '0', globalTimer: null, fastStartup: 1, powerThrottlingOff: null, powerScheme: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', powerSchemeName: 'High performance', useplatformclock: null, gameBarInstalled: true },
    software: { processCount: 287, startupCount: 9, backgroundApps: ['OneDrive sync', 'Microsoft Edge', 'Corsair iCUE', 'Windows Widgets'] },
    games: {
      fortnite: { installed: true, dir: 'C:\\Program Files\\Epic Games\\Fortnite', exe: 'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe' },
      valorant: { installed: true, dir: 'C:\\Riot Games\\VALORANT\\live', exe: 'C:\\Riot Games\\VALORANT\\live\\ShooterGame\\Binaries\\Win64\\VALORANT-Win64-Shipping.exe', riotDir: 'C:\\Riot Games' },
    },
    appliedTweaks: [],
  };

  const statusFor = (id: string): TweakStatus => {
    const t = catalog?.tweaks.find((x) => x.id === id);
    if (t?.cpu && !t.cpu.includes(scan.cpu.class)) return { status: 'na', tracked: false, appliedAt: null, errors: [] };
    return applied.has(id)
      ? { status: 'applied', tracked: true, appliedAt: new Date(Date.now() - 3600e3).toISOString(), errors: [] }
      : { status: 'default', tracked: false, appliedAt: null, errors: [] };
  };

  // ?psjson reproduces Windows PowerShell's JSON quirk (one-item lists become bare objects),
  // so the UI can be tested against real-engine-shaped data.
  const psjson = typeof location !== 'undefined' && location.search.includes('psjson');
  const one = <T,>(a: T[]): any => (psjson && a.length ? a[0] : a);

  async function handle(action: string, payload: any): Promise<any> {
    switch (action) {
      case 'ping': return { admin: true, psVersion: '5.1.26100', dataRoot: 'C:\\ProgramData\\Tickrate' };
      case 'scan':
        emit('Reading CPU, GPU, memory and display information', 'scan');
        await wait(1400);
        if (psjson) {
          return {
            ...scan, scannedAt: new Date().toISOString(), appliedTweaks: one([...applied].slice(0, 1)),
            gpus: one(scan.gpus.slice(0, 1)), gpuMsi: one(scan.gpuMsi), displays: one(scan.displays.slice(0, 1)),
            storage: { ...scan.storage, disks: one(scan.storage.disks!.slice(0, 1)) },
            software: { ...scan.software, backgroundApps: one(scan.software.backgroundApps!.slice(0, 1)) },
          };
        }
        return { ...scan, scannedAt: new Date().toISOString(), appliedTweaks: [...applied] };
      case 'games.detect': return scan.games;
      case 'tweaks.detect': {
        await wait(500);
        const out: Record<string, TweakStatus> = {};
        for (const t of catalog!.tweaks) out[t.id] = statusFor(t.id);
        return out;
      }
      case 'tweaks.apply':
      case 'tweaks.revert': {
        const out: Record<string, any> = {};
        for (const id of payload.ids as string[]) {
          const t = catalog!.tweaks.find((x) => x.id === id)!;
          emit(`${action === 'tweaks.apply' ? 'Applying' : 'Reverting'}: ${t.title}`, action);
          await wait(180);
          if (action === 'tweaks.apply') applied.add(id); else applied.delete(id);
          out[id] = { ok: true, errors: [] };
        }
        return out;
      }
      case 'state.get': {
        const tweaks: Record<string, any> = {};
        for (const id of applied) { const t = catalog!.tweaks.find((x) => x.id === id); if (t) tweaks[id] = { appliedAt: new Date(Date.now() - 3600e3).toISOString(), title: t.title }; }
        return { tweaks, apps: [{ name: 'Microsoft.BingNews', removedAt: new Date(Date.now() - 7200e3).toISOString() }], nvidia: nvidiaApplied };
      }
      case 'cleanup.analyze':
        await wait(1100);
        return {
          'user-temp': { bytes: 2_184_771_421, files: 6120 }, 'windows-temp': { bytes: 412_884_102, files: 388 },
          'wu-cache': { bytes: 1_903_118_224, files: 214 }, 'delivery-opt': { bytes: 734_003_200, files: 52 },
          'nvidia-shader': { bytes: 3_311_488_119, files: 1402 }, 'd3d-shader': { bytes: 1_082_117_003, files: 77 },
          'crash-dumps': { bytes: 811_420_114, files: 9 }, wer: { bytes: 96_120_004, files: 41 }, thumbnails: { bytes: 188_002_310, files: 12 },
          'fortnite-logs': { bytes: 274_552_031, files: 133 }, 'valorant-logs': { bytes: 61_337_118, files: 58 },
          'epic-webcache': { bytes: 402_118_300, files: 3301 }, 'windows-logs': { bytes: 1_211_009_330, files: 17 }, 'recycle-bin': { bytes: 5_120_331_008, files: 204 },
        };
      case 'cleanup.run': {
        const out: Record<string, any> = {};
        for (const id of payload.ids) { emit(`Cleaning ${id}`, action); await wait(250); out[id] = { freed: Math.round(Math.random() * 9e8), skipped: Math.round(Math.random() * 4) }; }
        return out;
      }
      case 'restore.status': return { enabled: true, points: one(restorePoints.slice(0, psjson ? 1 : restorePoints.length)) };
      case 'restore.create':
        emit(`Creating restore point '${payload.description}'`, action);
        await wait(1500);
        restorePoints.push({ seq: restorePoints.length + 41, description: payload.description, created: new Date().toISOString(), type: 12 });
        return { enabled: true, points: restorePoints };
      case 'restore.open': return {};
      case 'startup.list': return one(startup.slice(0, psjson ? 1 : startup.length));
      case 'startup.set': { const s = startup.find((x) => x.id === payload.id); if (s) s.enabled = payload.enabled; return startup; }
      case 'apps.list': {
        const installed: Record<string, any> = {};
        for (const p of payload.patterns as string[]) if (!/LinkedIn|Teams$|Skype|3DViewer|Portal|Cortana|549981/.test(p)) installed[p] = { name: p.replace('*', ''), version: '1.0' };
        return installed;
      }
      case 'apps.remove':
        for (const p of payload.patterns) { emit(`Removing ${p}`, action); await wait(300); }
        return { removed: payload.patterns, failed: [] };
      case 'maint.run':
        for (const l of ['Beginning system scan.  This process will take some time.', 'Beginning verification phase of system scan.', 'Verification 100% complete.', 'Windows Resource Protection did not find any integrity violations.']) { emit(l, action); await wait(500); }
        return { exitCode: 0 };
      case 'power.list':
        if (psjson) return { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced', active: true };
        return [
          { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced', active: false },
          { guid: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', name: 'High performance', active: true },
          { guid: 'a1841308-3541-4fab-bc81-f71556f20b4a', name: 'Power saver', active: false },
        ];
      case 'power.activate': return [];
      case 'nvidia.status': return { installed: nvidiaInstalled, exe: nvidiaInstalled ? 'C:\\ProgramData\\Tickrate\\tools\\nvidiaProfileInspector\\nvidiaProfileInspector.exe' : null, version: nvidiaInstalled ? '3.0.1.13' : null, hasNvidiaGpu: true, applied: nvidiaApplied };
      case 'nvidia.install':
        emit('Looking up the latest NVIDIA Profile Inspector release on GitHub', action); await wait(700);
        emit('Downloading nvidiaProfileInspector.zip', action); await wait(900);
        nvidiaInstalled = true;
        return handle('nvidia.status', {});
      case 'nvidia.read': await wait(800); return nvidiaApplied ? Object.fromEntries(nvidiaApplied.applied.map((s: any) => [String(s.id), String(s.value)])) : { '13510289': '0' };
      case 'nvidia.apply': {
        await wait(1200);
        const settingsList = (payload.settings as { key: string; value: number }[]).map((s) => {
          const def = catalog!.nvidiaSettings.find((d) => d.key === s.key)!;
          return { id: def.id, name: def.name, value: s.value };
        });
        nvidiaApplied = { backupTaken: true, backupFile: 'C:\\ProgramData\\Tickrate\\backups\\nvidia\\original.nip', hadBaseProfile: true, firstAppliedAt: new Date().toISOString(), applied: settingsList };
        return { verified: true, mismatch: [], current: {} };
      }
      case 'nvidia.revert': await wait(900); nvidiaApplied = null; return { restored: 1, current: {} };
      default: throw new Error(`Demo mode does not implement '${action}'`);
    }
  }

  return {
    async catalog() {
      const mod = await import('virtual:catalog');
      catalog = mod.default;
      return mod.default;
    },
    async call(action, payload) {
      try { return { ok: true, data: await handle(action, payload as any) }; } catch (e: any) { return { ok: false, error: e.message }; }
    },
    async settings() { return settings; },
    async setSettings(patch) { settings = { ...settings, ...patch }; return settings; },
    async info() { return { version: 'demo', platform: 'demo', dataRoot: 'C:\\ProgramData\\Tickrate' }; },
    async openExternal() { return true; },
    async openDataFolder() { return true; },
    onLog(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };
}
