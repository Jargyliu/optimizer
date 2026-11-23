export type Impact = 'high' | 'medium' | 'low';
export type Risk = 'safe' | 'moderate' | 'advanced';
export type Evidence = 'proven' | 'situational' | 'minor';
export type Reboot = 'none' | 'signout' | 'restart';
export type CpuClass = 'x3d-dual' | 'x3d-single' | 'ryzen' | 'other';

export interface TweakOp {
  op: 'reg' | 'service' | 'task' | 'bcd' | 'ps';
  path?: string;
  name?: string;
  type?: string;
  value?: unknown;
  delete?: boolean;
  start?: string;
  state?: string;
  key?: string;
  apply?: string;
  revert?: string;
  detect?: string;
}

export interface Tweak {
  id: string;
  title: string;
  category: string;
  summary: string;
  description: string;
  impact: Impact;
  risk: Risk;
  evidence: Evidence;
  reboot: Reboot;
  presets: string[];
  cpu?: CpuClass[];
  games?: string[];
  warning?: string;
  guardMessage?: string;
  ops: TweakOp[];
}

export interface Category { id: string; label: string; blurb: string }
export interface Preset { id: string; label: string; blurb: string }
export interface AppEntry { pattern: string; label: string; group: string; recommended: boolean }
export interface CleanupTarget { id: string; label: string; detail: string; recommended: boolean }
export interface MaintenanceTask { id: string; label: string; detail: string; minutes: string; danger?: boolean }
export interface NvidiaSetting {
  key: string; id: number; name: string; label: string; default: number; recommended: number;
  options: { value: number; label: string }[]; description: string; dependsOnVrr?: boolean;
}

export interface Catalog {
  tweaks: Tweak[];
  categories: Category[];
  presets: Preset[];
  apps: AppEntry[];
  protectedApps: { label: string; reason: string }[];
  cleanupTargets: CleanupTarget[];
  maintenanceTasks: MaintenanceTask[];
  nvidiaSettings: NvidiaSetting[];
  excluded: { title: string; reason: string }[];
  version: string;
}

export type TweakState = 'applied' | 'default' | 'partial' | 'na' | 'unknown';
export interface TweakStatus { status: TweakState; tracked: boolean; appliedAt: string | null; errors: string[] }

export interface GameInfo { installed: boolean; dir: string | null; exe: string | null; riotDir?: string | null }

export interface ScanFacts {
  scannedAt: string;
  os: { caption?: string; build?: number; ubr?: number; displayVersion?: string; edition?: string; uptimeHours?: number; pendingReboot?: boolean };
  cpu: { name?: string; cores?: number; threads?: number; maxMHz?: number; class: CpuClass; vcacheDriver?: boolean; vcacheDefaultType?: number | null };
  gpus: { name: string; driver: string; driverDate: string | null; vendor: string }[];
  nvidia: null | {
    name: string; driver: string; pcieGenMax: string; pcieWidthMax: string; pcieGenCur: string; pcieWidthCur: string;
    tempC: string; vramMiB: string; powerW: string; maxClock: string; bar1MiB: number | null; rebar: boolean | null;
  };
  gpuMsi: { name: string; msi: boolean }[];
  memory: { totalGB?: number; modules?: number; type?: string | null; ratedMTs?: number; configuredMTs?: number };
  displays: { device: string; adapter: string; width: number; height: number; refresh: number; maxRefresh: number; primary: boolean }[];
  storage: { systemFreeGB?: number; systemTotalGB?: number; disks?: { name: string; media: string; bus: string; sizeGB: number }[] };
  security: { secureBoot?: boolean | null; tpm?: { present: boolean; ready: boolean } | null; bitlocker?: boolean | null; vbsRunning?: boolean | null; hvciRunning?: boolean | null };
  settings: {
    gameMode?: number | null; gameDvr?: number | null; appCapture?: number | null; hags?: number | null; mouseSpeed?: string | null;
    globalTimer?: number | null; fastStartup?: number | null; powerThrottlingOff?: number | null; powerScheme?: string | null;
    powerSchemeName?: string | null; useplatformclock?: string | null; gameBarInstalled?: boolean;
  };
  software: { processCount?: number; startupCount?: number; backgroundApps?: string[] };
  games: { fortnite?: GameInfo; valorant?: GameInfo };
  appliedTweaks: string[];
}

export type Severity = 'good' | 'info' | 'warn' | 'bad';
export interface Finding {
  id: string;
  severity: Severity;
  area: 'cpu' | 'gpu' | 'memory' | 'display' | 'windows' | 'security' | 'storage' | 'software';
  title: string;
  detail: string;
  fix?: { label: string; tweakIds?: string[]; page?: PageId; url?: string };
}

export type PageId = 'dashboard' | 'scan' | 'tweaks' | 'nvidia' | 'power' | 'debloat' | 'cleanup' | 'tools' | 'restore' | 'guide';

export interface LogLine { time: string; action?: string; level: 'info' | 'debug' | 'error'; message: string }

export interface RestoreStatus { enabled: boolean; points: { seq: number; description: string; created: string; type: number }[] }
export interface PowerPlan { guid: string; name: string; active: boolean }
export interface StartupItem { id: string; name: string; command: string; source: string; enabled: boolean }
export interface EngineState {
  tweaks: Record<string, { appliedAt: string; title: string; lastAppliedAt?: string }>;
  apps: { name: string; removedAt: string }[];
  nvidia: null | { backupTaken: boolean; backupFile: string | null; hadBaseProfile: boolean; firstAppliedAt: string; lastAppliedAt?: string; applied?: { id: number; name: string; value: number }[] };
}
export interface Settings { autoRestorePoint: boolean; monitorType: 'vrr' | 'fixed' | null }

export interface TickrateBridge {
  catalog(): Promise<Catalog>;
  call(action: string, payload?: unknown): Promise<{ ok: true; data: any } | { ok: false; error: string }>;
  settings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  info(): Promise<{ version: string; platform: string; dataRoot: string }>;
  openExternal(url: string): Promise<unknown>;
  openDataFolder(): Promise<unknown>;
  onLog(cb: (line: LogLine) => void): () => void;
}

declare global {
  interface Window { tickrate?: TickrateBridge }
}
