import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen, Broom, CheckCircle, ClockCounterClockwise, Cpu, Gauge, GraphicsCard, Lightning, MagnifyingGlass, Package,
  SlidersHorizontal, Terminal, Wrench, WarningCircle, X, XCircle,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isDemo, useStore } from '../lib/store';
import { cpuLabel } from '../lib/findings';
import type { PageId } from '../lib/types';
import { Button, cx, spring, StatusDot, TickLoader } from './ui';

const NAV: { id: PageId; label: string; icon: typeof Gauge; group: string }[] = [
  { id: 'dashboard', label: 'Overview', icon: Gauge, group: 'Optimize' },
  { id: 'scan', label: 'PC scan', icon: MagnifyingGlass, group: 'Optimize' },
  { id: 'tweaks', label: 'Tweaks', icon: SlidersHorizontal, group: 'Optimize' },
  { id: 'nvidia', label: 'NVIDIA profile', icon: GraphicsCard, group: 'Optimize' },
  { id: 'power', label: 'Power plans', icon: Lightning, group: 'Optimize' },
  { id: 'debloat', label: 'Debloat', icon: Package, group: 'Clean' },
  { id: 'cleanup', label: 'Cleanup', icon: Broom, group: 'Clean' },
  { id: 'tools', label: 'Maintenance', icon: Wrench, group: 'Clean' },
  { id: 'restore', label: 'Restore & revert', icon: ClockCounterClockwise, group: 'Safety' },
  { id: 'guide', label: 'BIOS & game guide', icon: BookOpen, group: 'Safety' },
];

export function TitleBar() {
  return (
    <div className="drag relative flex h-10 shrink-0 items-center border-b hairline pl-4 pr-[140px]">
      <div className="flex items-center gap-2.5">
        <Wordmark />
        {isDemo && <span className="rounded border border-warn/25 bg-warn/10 px-1.5 text-[10px] font-medium uppercase tracking-wider text-warn">Demo</span>}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <StatusIsland />
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
        <rect x="2" y="9" width="3" height="9" rx="1" fill="#62d4a6" opacity="0.45" />
        <rect x="8.5" y="5" width="3" height="13" rx="1" fill="#62d4a6" opacity="0.7" />
        <rect x="15" y="2" width="3" height="16" rx="1" fill="#62d4a6" />
      </svg>
      <span className="text-[13px] font-semibold tracking-tight">Tickrate</span>
    </div>
  );
}

/** Pill in the title bar that morphs to show what the engine is doing. */
function StatusIsland() {
  const { tasks, admin, pendingReboot } = useStore();
  const current = tasks[tasks.length - 1];
  let content: ReactNode;
  let key: string;
  if (current) {
    key = 'busy';
    content = (
      <>
        <TickLoader className="text-accent" />
        <span className="text-fg">{current.label}</span>
        {tasks.length > 1 && <span className="num text-fg-faint">+{tasks.length - 1}</span>}
      </>
    );
  } else if (pendingReboot) {
    key = 'reboot';
    content = (<><StatusDot tone="warn" pulse /><span>{pendingReboot === 'restart' ? 'Restart to finish applying changes' : 'Sign out to finish applying changes'}</span></>);
  } else if (admin === false && !isDemo) {
    key = 'noadmin';
    content = (<><StatusDot tone="bad" /><span>Not running as administrator</span></>);
  } else {
    key = 'idle';
    content = (<><StatusDot tone="accent" pulse /><span>Ready</span></>);
  }
  return (
    <motion.div layout transition={spring} className="no-drag flex h-7 items-center gap-2 overflow-hidden rounded-full border border-white/[0.07] bg-ink-850 px-3 text-[12px] text-fg-muted">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring} className="flex items-center gap-2">
          {content}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

export function Sidebar({ onToggleLog, logOpen }: { onToggleLog: () => void; logOpen: boolean }) {
  const { page, go, scan, statuses, logs } = useStore();
  const groups = [...new Set(NAV.map((n) => n.group))];
  const applied = Object.values(statuses).filter((s) => s.status === 'applied').length;
  const errors = logs.filter((l) => l.level === 'error').length;
  return (
    <aside className="flex w-[228px] shrink-0 flex-col border-r hairline bg-ink-950 px-3 pb-3 pt-5">
      <nav className="flex flex-col gap-5">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-faint">{g}</p>
            <ul className="flex flex-col gap-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const active = page === n.id;
                const Icon = n.icon;
                return (
                  <li key={n.id}>
                    <button onClick={() => go(n.id)} className={cx('relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors', active ? 'text-fg' : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg')}>
                      {active && <motion.span layoutId="nav-active" transition={spring} className="absolute inset-0 rounded-lg border border-white/[0.06] bg-ink-800" />}
                      <Icon size={17} weight={active ? 'fill' : 'regular'} className={cx('relative', active && 'text-accent')} />
                      <span className="relative">{n.label}</span>
                      {n.id === 'tweaks' && applied > 0 && <span className="num relative ml-auto text-[11px] text-fg-faint">{applied}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-ink-900 p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-fg-faint"><Cpu size={13} /> This PC</div>
          {scan ? (
            <>
              <p className="mt-2 truncate text-[12.5px] font-medium" title={scan.cpu.name}>{scan.cpu.name?.replace(/ \d+-Core Processor/, '')}</p>
              <p className="truncate text-[12px] text-fg-muted" title={scan.nvidia?.name || scan.gpus[0]?.name}>{scan.nvidia?.name?.replace('NVIDIA GeForce ', '') || scan.gpus[0]?.name}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-accent"><StatusDot tone="accent" />{cpuLabel(scan.cpu.class)} profile</p>
            </>
          ) : (
            <div className="mt-2 space-y-1.5"><div className="shimmer h-3 w-4/5 rounded" /><div className="shimmer h-3 w-3/5 rounded" /></div>
          )}
        </div>
        <button onClick={onToggleLog} className={cx('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors', logOpen ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg')}>
          <Terminal size={16} /> Activity log
          {errors > 0 && <span className="num ml-auto rounded bg-bad/15 px-1.5 text-[11px] text-bad">{errors}</span>}
        </button>
      </div>
    </aside>
  );
}

export function LogDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logs, clearLogs } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs, open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring} className="absolute inset-x-0 bottom-0 z-30 flex h-[38%] flex-col border-t hairline bg-ink-900/95 backdrop-blur-md">
          <div className="flex h-10 items-center justify-between border-b hairline px-5">
            <span className="text-[12px] font-medium text-fg-muted">Activity log <span className="text-fg-faint">· also saved to %ProgramData%\Tickrate\logs</span></span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={clearLogs}>Clear</Button>
              <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close log"><X size={14} /></Button>
            </div>
          </div>
          <div ref={ref} className="num flex-1 overflow-y-auto px-5 py-3 text-[12px] leading-[1.7]">
            {logs.length === 0 && <p className="text-fg-faint">Nothing yet. Everything Tickrate does to your system is listed here as it happens.</p>}
            {logs.map((l, i) => (
              <div key={i} className={cx('flex gap-3', l.level === 'error' ? 'text-bad' : l.level === 'debug' ? 'text-fg-faint' : 'text-fg-muted')}>
                <span className="shrink-0 text-fg-faint">{l.time.slice(11, 19)}</span>
                <span className="whitespace-pre-wrap break-all">{l.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-40 flex w-[360px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24 }} transition={spring}
            className="surface pointer-events-auto flex gap-3 rounded-xl p-3.5">
            {t.kind === 'success' ? <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-accent" /> : t.kind === 'error' ? <XCircle size={18} weight="fill" className="mt-px shrink-0 text-bad" /> : <WarningCircle size={18} weight="fill" className="mt-px shrink-0 text-info" />}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{t.title}</p>
              {t.detail && <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-fg-muted">{t.detail}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="shrink-0 text-fg-faint hover:text-fg" aria-label="Dismiss"><X size={13} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Modal that grows out of the page. Used for every confirmation before system changes. */
export function Dialog({ open, onClose, title, children, actions, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-50 grid place-items-center bg-ink-950/70 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal aria-label={title} onMouseDown={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={spring}
            className={cx('surface flex max-h-[80vh] flex-col rounded-2xl', wide ? 'w-[680px]' : 'w-[520px]')}>
            <div className="px-6 pb-2 pt-5"><h2 className="text-[17px] font-semibold tracking-tight">{title}</h2></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 text-[13.5px] leading-relaxed text-fg-muted">{children}</div>
            <div className="flex justify-end gap-2 border-t hairline px-6 py-4">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useDialog<T = true>() {
  const [state, setState] = useState<T | null>(null);
  return { value: state, open: state !== null, show: (v: T) => setState(v), close: () => setState(null) };
}
