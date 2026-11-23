import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createMockBridge } from './mock';
import { computeFindings, computeScore } from './findings';
import type { Catalog, EngineState, Finding, LogLine, PageId, ScanFacts, Settings, TickrateBridge, TweakStatus } from './types';

const bridge: TickrateBridge = window.tickrate ?? createMockBridge();
export const isDemo = !window.tickrate;

export interface Task { id: number; label: string; action: string; started: number }
export interface Toast { id: number; kind: 'success' | 'error' | 'info'; title: string; detail?: string }

interface Store {
  bridge: TickrateBridge;
  catalog: Catalog | null;
  statuses: Record<string, TweakStatus>;
  detecting: boolean;
  scan: ScanFacts | null;
  scanning: boolean;
  findings: Finding[];
  score: ReturnType<typeof computeScore>;
  engineState: EngineState | null;
  settings: Settings;
  admin: boolean | null;
  logs: LogLine[];
  tasks: Task[];
  toasts: Toast[];
  pendingReboot: 'signout' | 'restart' | null;
  page: PageId;
  focusTweaks: string[] | null;
  go: (page: PageId, opts?: { focusTweaks?: string[] }) => void;
  call: <T = any>(action: string, payload?: unknown, label?: string) => Promise<T>;
  refreshStatuses: () => Promise<void>;
  refreshEngineState: () => Promise<void>;
  runScan: () => Promise<void>;
  applyTweaks: (ids: string[]) => Promise<void>;
  revertTweaks: (ids: string[]) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  clearLogs: () => void;
}

const Ctx = createContext<Store | null>(null);
let seq = 1;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [statuses, setStatuses] = useState<Record<string, TweakStatus>>({});
  const [detecting, setDetecting] = useState(false);
  const [scan, setScan] = useState<ScanFacts | null>(null);
  const [scanning, setScanning] = useState(false);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [settings, setSettings] = useState<Settings>({ autoRestorePoint: true, monitorType: null });
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingReboot, setPendingReboot] = useState<'signout' | 'restart' | null>(null);
  const [page, setPage] = useState<PageId>('dashboard');
  const [focusTweaks, setFocusTweaks] = useState<string[] | null>(null);
  const catalogRef = useRef<Catalog | null>(null);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = seq++;
    setToasts((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.kind === 'error' ? 9000 : 5000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((x) => x.filter((y) => y.id !== id)), []);

  const call = useCallback(async <T,>(action: string, payload?: unknown, label?: string): Promise<T> => {
    const task: Task = { id: seq++, label: label || action, action, started: Date.now() };
    if (label) setTasks((t) => [...t, task]);
    try {
      const res = await bridge.call(action, payload);
      if (!res.ok) throw new Error(res.error);
      return res.data as T;
    } finally {
      if (label) setTasks((t) => t.filter((x) => x.id !== task.id));
    }
  }, []);

  const refreshStatuses = useCallback(async () => {
    setDetecting(true);
    try {
      setStatuses(await call<Record<string, TweakStatus>>('tweaks.detect', {}));
    } catch (e: any) {
      toast({ kind: 'error', title: 'Could not read tweak status', detail: e.message });
    } finally {
      setDetecting(false);
    }
  }, [call, toast]);

  const refreshEngineState = useCallback(async () => {
    try { setEngineState(await call<EngineState>('state.get')); } catch { /* shown elsewhere */ }
  }, [call]);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      setScan(await call<ScanFacts>('scan', {}, 'Scanning your PC'));
    } catch (e: any) {
      toast({ kind: 'error', title: 'Scan failed', detail: e.message });
    } finally {
      setScanning(false);
    }
  }, [call, toast]);

  const noteReboot = useCallback((ids: string[]) => {
    const tw = catalogRef.current?.tweaks.filter((t) => ids.includes(t.id)) || [];
    if (tw.some((t) => t.reboot === 'restart')) setPendingReboot('restart');
    else if (tw.some((t) => t.reboot === 'signout')) setPendingReboot((p) => p ?? 'signout');
  }, []);

  const runTweaks = useCallback(async (mode: 'apply' | 'revert', ids: string[]) => {
    if (!ids.length) return;
    const verb = mode === 'apply' ? 'Applying' : 'Reverting';
    try {
      const res = await call<Record<string, { ok: boolean; errors: string[]; skipped?: boolean }>>(`tweaks.${mode}`, { ids }, `${verb} ${ids.length} tweak${ids.length > 1 ? 's' : ''}`);
      const failed = Object.entries(res).filter(([, r]) => !r.ok);
      const okCount = ids.length - failed.length;
      if (okCount) noteReboot(ids.filter((id) => res[id]?.ok));
      if (failed.length) {
        toast({ kind: 'error', title: `${failed.length} of ${ids.length} could not be ${mode === 'apply' ? 'applied' : 'reverted'}`, detail: failed.map(([id, r]) => `${catalogRef.current?.tweaks.find((t) => t.id === id)?.title}: ${r.errors[0]}`).join('\n') });
      } else {
        toast({ kind: 'success', title: `${okCount} tweak${okCount > 1 ? 's' : ''} ${mode === 'apply' ? 'applied' : 'reverted'}`, detail: mode === 'apply' ? 'Original values were backed up and can be restored any time.' : 'Original values restored.' });
      }
    } catch (e: any) {
      toast({ kind: 'error', title: `${verb} failed`, detail: e.message });
    }
    await Promise.all([refreshStatuses(), refreshEngineState()]);
  }, [call, noteReboot, refreshEngineState, refreshStatuses, toast]);

  const applyTweaks = useCallback((ids: string[]) => runTweaks('apply', ids), [runTweaks]);
  const revertTweaks = useCallback((ids: string[]) => runTweaks('revert', ids), [runTweaks]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await bridge.setSettings(patch));
  }, []);

  const go = useCallback((p: PageId, opts?: { focusTweaks?: string[] }) => {
    setFocusTweaks(opts?.focusTweaks ?? null);
    setPage(p);
  }, []);

  useEffect(() => {
    const off = bridge.onLog((line) => setLogs((l) => (l.length > 800 ? [...l.slice(-600), line] : [...l, line])));
    (async () => {
      const c = await bridge.catalog();
      catalogRef.current = c;
      setCatalog(c);
      setSettings(await bridge.settings());
      try { setAdmin((await call<{ admin: boolean }>('ping')).admin); } catch { setAdmin(false); }
      await Promise.all([runScan(), refreshEngineState()]);
      await refreshStatuses();
    })();
    return off;
  }, [call, refreshEngineState, refreshStatuses, runScan]);

  const findings = useMemo(() => (scan ? computeFindings(scan) : []), [scan]);
  const score = useMemo(() => computeScore(findings, catalog, statuses, scan?.cpu?.class), [findings, catalog, statuses, scan]);

  const value: Store = {
    bridge, catalog, statuses, detecting, scan, scanning, findings, score, engineState, settings, admin, logs, tasks, toasts, pendingReboot,
    page, focusTweaks, go, call, refreshStatuses, refreshEngineState, runScan, applyTweaks, revertTweaks, updateSettings, toast, dismissToast,
    clearLogs: () => setLogs([]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
