import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { CaretDown, Funnel, Lightning, MagnifyingGlass, Prohibit, Warning, X } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import { isApplicable } from '../lib/findings';
import type { Tweak, TweakOp } from '../lib/types';
import { Button, Checkbox, Chip, PageHeader, Skeleton, Toggle, TweakStatePill, cx, evidenceLabel, impactTone, riskTone, spring } from '../components/ui';
import { Dialog, useDialog } from '../components/Shell';
import { PresetDialog } from '../components/PresetDialog';

type StatusFilter = 'all' | 'applied' | 'todo';
const REBOOT_LABEL = { none: '', signout: 'Sign-out', restart: 'Restart' } as const;
const CPU_LABEL: Record<string, string> = { 'x3d-dual': 'Dual-CCD X3D', 'x3d-single': 'Single-CCD X3D', ryzen: 'Ryzen', other: 'Other CPUs' };

export function Tweaks() {
  const { catalog, statuses, detecting, scan, tasks, applyTweaks, revertTweaks, focusTweaks, go } = useStore();
  const [cat, setCat] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presetOpen, setPresetOpen] = useState(false);
  const confirm = useDialog<{ tweak: Tweak; mode: 'apply' | 'revert' }>();
  const busy = tasks.length > 0;
  const cpuClass = scan?.cpu?.class;

  useEffect(() => { if (focusTweaks) setCat('all'); }, [focusTweaks]);

  const list = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.tweaks.filter((t) => {
      if (focusTweaks) return focusTweaks.includes(t.id);
      if (cat !== 'all' && t.category !== cat) return false;
      const st = statuses[t.id]?.status;
      if (status === 'applied' && st !== 'applied') return false;
      if (status === 'todo' && (st === 'applied' || st === 'na' || !isApplicable(t, cpuClass))) return false;
      if (q && !(`${t.title} ${t.summary} ${t.description}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [catalog, cat, query, status, statuses, focusTweaks, cpuClass]);

  const counts = useMemo(() => {
    const m: Record<string, { applied: number; total: number }> = {};
    for (const t of catalog?.tweaks || []) {
      const ok = isApplicable(t, cpuClass) && statuses[t.id]?.status !== 'na';
      for (const k of [t.category, 'all']) {
        m[k] ??= { applied: 0, total: 0 };
        if (ok) { m[k].total++; if (statuses[t.id]?.status === 'applied') m[k].applied++; }
      }
    }
    return m;
  }, [catalog, statuses, cpuClass]);

  const toggleOne = (t: Tweak, next: boolean) => {
    const mode = next ? 'apply' : 'revert';
    if (mode === 'apply' && t.risk !== 'safe') confirm.show({ tweak: t, mode });
    else (mode === 'apply' ? applyTweaks : revertTweaks)([t.id]);
  };
  const sel = [...selected];
  const selApplied = sel.filter((id) => statuses[id]?.status === 'applied' || statuses[id]?.status === 'partial');
  const selTodo = sel.filter((id) => statuses[id]?.status !== 'applied' && statuses[id]?.status !== 'na');

  return (
    <>
      <PageHeader eyebrow={`${catalog?.tweaks.length ?? ''} tweaks · every change is backed up`} title="Tweaks"
        actions={<Button variant="primary" icon={<Lightning size={15} weight="fill" />} onClick={() => setPresetOpen(true)}>Apply a preset</Button>}>
        Each tweak shows what it changes, why, and how strong the evidence is. Apply them one at a time or in a batch. Reverting restores the exact values your PC had before.
      </PageHeader>

      <div className="grid grid-cols-[196px_1fr] gap-8">
        {/* category rail */}
        <nav className="sticky top-0 self-start">
          <ul className="flex flex-col gap-0.5">
            {[{ id: 'all', label: 'All tweaks' }, ...(catalog?.categories || [])].map((c) => (
              <li key={c.id}>
                <button onClick={() => { setCat(c.id); if (focusTweaks) go('tweaks'); }}
                  className={cx('relative flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] transition-colors', cat === c.id && !focusTweaks ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
                  {cat === c.id && !focusTweaks && <motion.span layoutId="cat-active" transition={spring} className="absolute inset-0 rounded-lg bg-ink-800" />}
                  <span className="relative truncate">{c.label}</span>
                  <span className="num relative text-[11px] text-fg-faint">{counts[c.id] ? `${counts[c.id].applied}/${counts[c.id].total}` : ''}</span>
                </button>
              </li>
            ))}
            <li className="mt-3 border-t hairline pt-3">
              <button onClick={() => setCat('excluded')} className={cx('relative flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px]', cat === 'excluded' ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
                {cat === 'excluded' && <motion.span layoutId="cat-active" transition={spring} className="absolute inset-0 rounded-lg bg-ink-800" />}
                <Prohibit size={14} className="relative" /><span className="relative">Left out on purpose</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="min-w-0">
          {cat === 'excluded' ? <Excluded /> : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-ink-900 px-3 focus-within:border-white/20">
                  <MagnifyingGlass size={15} className="text-fg-faint" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tweaks, e.g. timer, X3D, mouse" className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-faint" />
                  {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} className="text-fg-faint" /></button>}
                </label>
                <div className="flex h-9 items-center rounded-lg border border-white/[0.07] bg-ink-900 p-0.5 text-[12.5px]">
                  {(['all', 'todo', 'applied'] as StatusFilter[]).map((s) => (
                    <button key={s} onClick={() => setStatus(s)} className={cx('relative h-full rounded-md px-3', status === s ? 'text-fg' : 'text-fg-muted')}>
                      {status === s && <motion.span layoutId="status-filter" transition={spring} className="absolute inset-0 rounded-md bg-ink-750" />}
                      <span className="relative">{s === 'all' ? 'All' : s === 'todo' ? 'Not applied' : 'Applied'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {focusTweaks && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-info/20 bg-info/[0.06] px-3.5 py-2 text-[12.5px] text-info">
                  <span className="inline-flex items-center gap-2"><Funnel size={13} /> Showing tweaks linked to a scan finding</span>
                  <button onClick={() => go('tweaks')} className="text-fg-muted hover:text-fg">Show all</button>
                </div>
              )}
              {cat !== 'all' && catalog && <p className="mb-3 text-[12.5px] text-fg-faint">{catalog.categories.find((c) => c.id === cat)?.blurb}</p>}

              {!catalog ? (
                <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[76px]" />)}</div>
              ) : list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center text-[13px] text-fg-muted">No tweaks match. Clear the search or switch the filter to "All".</p>
              ) : (
                <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900">
                  {list.map((t) => (
                    <TweakRow key={t.id} t={t} detecting={detecting && !statuses[t.id]} busy={busy} cpuClass={cpuClass}
                      selected={selected.has(t.id)}
                      onSelect={(v) => setSelected((s) => { const n = new Set(s); v ? n.add(t.id) : n.delete(t.id); return n; })}
                      onToggle={(v) => toggleOne(t, v)} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* selection bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={spring}
            className="surface fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl py-2 pl-5 pr-2" style={{ marginLeft: 114 }}>
            <span className="mr-3 text-[13px]"><span className="num">{selected.size}</span> selected</span>
            <Button size="sm" variant="primary" disabled={!selTodo.length || busy} onClick={() => { applyTweaks(selTodo); setSelected(new Set()); }}>Apply {selTodo.length || ''}</Button>
            <Button size="sm" disabled={!selApplied.length || busy} onClick={() => { revertTweaks(selApplied); setSelected(new Set()); }}>Revert {selApplied.length || ''}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <PresetDialog open={presetOpen} onClose={() => setPresetOpen(false)} initial="competitive" />
      <Dialog open={confirm.open} onClose={confirm.close} title={confirm.value ? `Apply "${confirm.value.tweak.title}"?` : ''}
        actions={<>
          <Button variant="ghost" onClick={confirm.close}>Cancel</Button>
          <Button variant="primary" onClick={() => { applyTweaks([confirm.value!.tweak.id]); confirm.close(); }}>Apply</Button>
        </>}>
        {confirm.value && (
          <>
            <p>This is a <span className={confirm.value.tweak.risk === 'advanced' ? 'text-bad' : 'text-warn'}>{confirm.value.tweak.risk}</span> tweak: it has a trade-off worth knowing about.</p>
            <p className="mt-3">{confirm.value.tweak.description}</p>
            {confirm.value.tweak.warning && <p className="mt-3 flex gap-2 text-warn"><Warning size={16} className="mt-0.5 shrink-0" />{confirm.value.tweak.warning}</p>}
            <p className="mt-3 text-fg-faint">The original values are saved, so you can revert this from this page or from Restore & revert.</p>
          </>
        )}
      </Dialog>
    </>
  );
}

function TweakRow({ t, selected, onSelect, onToggle, busy, detecting, cpuClass }: {
  t: Tweak; selected: boolean; onSelect: (v: boolean) => void; onToggle: (v: boolean) => void; busy: boolean; detecting: boolean; cpuClass?: string;
}) {
  const { statuses } = useStore();
  const [open, setOpen] = useState(false);
  const st = statuses[t.id];
  const applicable = isApplicable(t, cpuClass);
  const state = !applicable ? 'na' : st?.status;
  const on = state === 'applied' || state === 'partial';
  return (
    <li className={cx('group transition-colors', selected && 'bg-accent/[0.035]')}>
      <div className="flex items-start gap-3.5 px-4 py-3.5">
        <div className="pt-[3px]"><Checkbox checked={selected} onChange={onSelect} label={`Select ${t.title}`} disabled={state === 'na'} /></div>
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <div className="flex items-center gap-2">
            <span className={cx('text-[14px] font-medium', state === 'na' && 'text-fg-muted')}>{t.title}</span>
            <CaretDown size={12} className={cx('text-fg-faint transition-transform duration-300', open && 'rotate-180')} />
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{t.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip tone={impactTone[t.impact]} title="Expected effect on latency / smoothness">{t.impact} impact</Chip>
            <Chip tone={riskTone[t.risk]} title="Trade-offs">{t.risk}</Chip>
            <Chip title="How solid the evidence is">{evidenceLabel[t.evidence]}</Chip>
            {t.reboot !== 'none' && <Chip>{REBOOT_LABEL[t.reboot]}</Chip>}
            {t.cpu && <Chip tone={applicable ? 'neutral' : 'warn'}>{t.cpu.map((c) => CPU_LABEL[c]).join(' / ')} only</Chip>}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-4 pt-0.5">
          {detecting ? <Skeleton className="h-4 w-20" /> : <TweakStatePill state={state} />}
          <Toggle checked={on} disabled={busy || state === 'na' || detecting} onChange={onToggle} label={`${on ? 'Revert' : 'Apply'} ${t.title}`} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="grid grid-cols-[1.25fr_1fr] gap-8 px-4 pb-5 pl-[50px] pt-1">
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-fg-faint">What it does</p>
                <p className="max-w-[65ch] text-[13px] leading-relaxed text-fg/85">{t.description}</p>
                {t.warning && <p className="mt-3 flex gap-2 text-[12.5px] text-warn"><Warning size={15} className="mt-0.5 shrink-0" />{t.warning}</p>}
                {state === 'na' && <p className="mt-3 text-[12.5px] text-fg-faint">{!applicable ? `Not used on your CPU. It is meant for ${t.cpu!.map((c) => CPU_LABEL[c]).join(' / ')}.` : t.guardMessage || 'Not applicable to this PC.'}</p>}
                {st?.errors?.length ? <p className="mt-3 text-[12px] text-bad">{[...st.errors].join(' · ')}</p> : null}
              </div>
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-fg-faint">What changes</p>
                <ul className="num space-y-1 text-[11.5px] leading-relaxed text-fg-muted">
                  {t.ops.map((op, i) => <OpLine key={i} op={op} />)}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function OpLine({ op }: { op: TweakOp }) {
  const [show, setShow] = useState(false);
  const fmt = (v: unknown) => (typeof v === 'string' ? `"${v}"` : typeof v === 'number' ? `${v}${v > 9 ? ` (0x${v.toString(16)})` : ''}` : JSON.stringify(v));
  switch (op.op) {
    case 'reg':
      return (
        <li className="break-all">
          <span className="text-fg-faint">{op.path}</span>
          <br />
          <span className="text-fg">{op.name}</span> {op.delete ? <span className="text-warn">→ removed</span> : <>= <span className="text-accent">{fmt(op.value)}</span> <span className="text-fg-faint">{op.type}</span></>}
        </li>
      );
    case 'service': return <li>Service <span className="text-fg">{op.name}</span> → <span className="text-accent">{op.start}</span></li>;
    case 'task': return <li className="break-all">Task <span className="text-fg-faint">{op.path}</span><span className="text-fg">{op.name}</span> → <span className="text-accent">{op.state}</span></li>;
    case 'bcd': return <li>bcdedit <span className="text-fg">{op.key}</span> → <span className="text-accent">{op.value === null ? 'removed' : String(op.value)}</span></li>;
    case 'ps':
      if (!op.apply?.trim() && !op.detect?.trim()) return <li className="text-fg-faint">Restarts the related service on revert</li>;
      return (
        <li>
          <button onClick={() => setShow((s) => !s)} className="text-fg underline decoration-white/20 underline-offset-2 hover:decoration-white/60">{show ? 'Hide' : 'Show'} PowerShell</button>
          {show && <pre className="mt-1.5 max-h-56 overflow-auto rounded-lg bg-ink-950 p-2.5 text-[11px] text-fg-muted">{op.apply?.trim()}</pre>}
        </li>
      );
    default: return null;
  }
}

function Excluded() {
  const { catalog } = useStore();
  return (
    <div>
      <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-fg-muted">
        Tweaks you will find in other optimizers that Tickrate deliberately does not apply, because they are myths, have no effect on these games, conflict with Ryzen X3D scheduling, or would lock you out of Vanguard and Easy Anti-Cheat.
      </p>
      <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06] bg-ink-900">
        {catalog?.excluded.map((e) => (
          <li key={e.title} className="px-5 py-4">
            <p className="flex items-center gap-2 text-[14px] font-medium"><Prohibit size={14} className="text-fg-faint" />{e.title}</p>
            <p className="mt-1 pl-[22px] text-[12.5px] leading-relaxed text-fg-muted">{e.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
