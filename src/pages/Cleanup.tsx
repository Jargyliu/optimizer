import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Broom, MagnifyingGlass } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import { formatBytes } from '../lib/format';
import { Button, Checkbox, Chip, Empty, PageHeader, Panel, Skeleton, cx, spring } from '../components/ui';

type Sizes = Record<string, { bytes: number; files: number }>;

export function Cleanup() {
  const { catalog, call, toast, scan } = useStore();
  const [sizes, setSizes] = useState<Sizes | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [freed, setFreed] = useState<Record<string, { freed: number; skipped: number }> | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const analyze = async () => {
    setAnalyzing(true); setFreed(null);
    try {
      const r = await call<Sizes>('cleanup.analyze', {}, 'Measuring junk files');
      setSizes(r);
      setSel(new Set(catalog!.cleanupTargets.filter((t) => t.recommended && r[t.id]?.bytes > 0).map((t) => t.id)));
    } catch (e: any) { toast({ kind: 'error', title: 'Analysis failed', detail: e.message }); }
    finally { setAnalyzing(false); }
  };
  const clean = async () => {
    setCleaning(true);
    try {
      const r = await call<Record<string, { freed: number; skipped: number }>>('cleanup.run', { ids: [...sel] }, `Cleaning ${sel.size} locations`);
      setFreed(r);
      const total = Object.values(r).reduce((a, b) => a + b.freed, 0);
      const skipped = Object.values(r).reduce((a, b) => a + b.skipped, 0);
      toast({ kind: 'success', title: `Freed ${formatBytes(total)}`, detail: skipped ? `${skipped} files were in use and were skipped.` : undefined });
      setSizes(await call<Sizes>('cleanup.analyze'));
      setSel(new Set());
    } catch (e: any) { toast({ kind: 'error', title: 'Cleanup failed', detail: e.message }); }
    finally { setCleaning(false); }
  };

  const total = useMemo(() => [...sel].reduce((a, id) => a + (sizes?.[id]?.bytes || 0), 0), [sel, sizes]);
  const all = useMemo(() => Object.values(sizes || {}).reduce((a, b) => a + b.bytes, 0), [sizes]);

  return (
    <>
      <PageHeader eyebrow={scan?.storage.systemFreeGB !== undefined ? `${scan.storage.systemFreeGB} GB free on the system drive` : 'System cleanup'} title="Cleanup"
        actions={<Button icon={<MagnifyingGlass size={15} />} busy={analyzing} onClick={analyze} disabled={cleaning}>{sizes ? 'Re-analyze' : 'Analyze'}</Button>}>
        Clears temp files, update caches, crash dumps and game logs. Files that are in use are skipped, never forced. Shader caches are off by default: clear them only after a driver update, because the first matches afterwards stutter while shaders rebuild.
      </PageHeader>

      {!sizes && !analyzing ? (
        <Panel><Empty icon={<Broom size={20} />} title="Measure first, then choose" action={<Button variant="primary" onClick={analyze}>Analyze now</Button>}>Tickrate measures every location before deleting anything, so you can see exactly what will be removed.</Empty></Panel>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <Panel className="col-span-8">
            <ul className="divide-y divide-white/[0.05] px-5 py-2">
              {catalog?.cleanupTargets.map((t) => {
                const s = sizes?.[t.id];
                const f = freed?.[t.id];
                return (
                  <li key={t.id} className="flex items-center gap-3.5 py-3">
                    <Checkbox checked={sel.has(t.id)} disabled={!s?.bytes} label={t.label} onChange={(v) => setSel((x) => { const n = new Set(x); v ? n.add(t.id) : n.delete(t.id); return n; })} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[13.5px]">{t.label}{!t.recommended && <Chip>Optional</Chip>}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">{t.detail}</p>
                    </div>
                    <div className="w-[110px] text-right">
                      {analyzing && !s ? <Skeleton className="ml-auto h-4 w-16" /> : (
                        <>
                          <p className={cx('num text-[13px]', s?.bytes ? 'text-fg' : 'text-fg-faint')}>{formatBytes(s?.bytes)}</p>
                          <p className="num text-[11px] text-fg-faint">{f ? `freed ${formatBytes(f.freed)}` : s ? `${s.files.toLocaleString()} files` : ''}</p>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <div className="col-span-4">
            <Panel className="sticky top-0">
              <div className="p-6">
                <p className="text-[12px] text-fg-muted">Selected</p>
                <motion.p key={total} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="num mt-1 text-[40px] font-medium leading-none tracking-tighter">{formatBytes(total)}</motion.p>
                <p className="num mt-2 text-[12px] text-fg-faint">of {formatBytes(all)} found · {sel.size} locations</p>
                <Button variant="primary" className="mt-6 w-full" disabled={!sel.size || analyzing} busy={cleaning} onClick={clean}>Clean selected</Button>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
