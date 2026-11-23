import { useEffect, useState } from 'react';
import { ArrowCounterClockwise, ClockCounterClockwise, FolderOpen, ShieldCheck } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import { formatDate, timeAgo } from '../lib/format';
import type { RestoreStatus } from '../lib/types';
import { Button, Empty, PageHeader, Panel, Skeleton, StatusDot, Toggle } from '../components/ui';
import { Dialog, useDialog } from '../components/Shell';

export function Restore() {
  const { call, toast, engineState, refreshEngineState, revertTweaks, tasks, catalog, settings, updateSettings, bridge, go } = useStore();
  const [rs, setRs] = useState<RestoreStatus | null>(null);
  const [desc, setDesc] = useState('Tickrate manual restore point');
  const [creating, setCreating] = useState(false);
  const revertAll = useDialog();
  const busy = tasks.length > 0;

  const load = async () => { try { setRs(await call<RestoreStatus>('restore.status')); } catch (e: any) { toast({ kind: 'error', title: 'Could not read restore points', detail: e.message }); } };
  useEffect(() => { load(); refreshEngineState(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setCreating(true);
    try {
      setRs(await call<RestoreStatus>('restore.create', { description: desc.trim() || 'Tickrate restore point', enableIfOff: true }, 'Creating restore point'));
      toast({ kind: 'success', title: 'Restore point created' });
    } catch (e: any) { toast({ kind: 'error', title: 'Restore point failed', detail: e.message }); }
    finally { setCreating(false); }
  };

  const applied = Object.entries(engineState?.tweaks || {}).sort((a, b) => b[1].appliedAt.localeCompare(a[1].appliedAt));
  const known = applied.filter(([id]) => catalog?.tweaks.some((t) => t.id === id));

  return (
    <>
      <PageHeader eyebrow="Safety net" title="Restore & revert">
        Two layers of protection. Tickrate saves the original value of everything it changes and can put each one back individually. Windows System Restore points cover the whole system on top of that.
      </PageHeader>

      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-7" title={<span>Changed by Tickrate <span className="num ml-1 text-fg-faint">{known.length}</span></span>}
          aside={known.length > 0 && <Button size="sm" variant="danger" icon={<ArrowCounterClockwise size={13} />} disabled={busy} onClick={() => revertAll.show(true)}>Revert everything</Button>}>
          {!engineState ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            : known.length === 0 && !engineState.nvidia ? <Empty icon={<ClockCounterClockwise size={20} />} title="Nothing changed yet">Tweaks you apply show up here with the time they were applied and a one-click revert.</Empty>
            : (
              <ul className="divide-y divide-white/[0.05] px-5 pb-2">
                {engineState.nvidia && (
                  <li className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1"><p className="text-[13.5px]">NVIDIA driver profile</p><p className="text-[11.5px] text-fg-faint">Original exported {formatDate(engineState.nvidia.firstAppliedAt)}</p></div>
                    <Button size="sm" onClick={() => go('nvidia')}>Manage</Button>
                  </li>
                )}
                {known.map(([id, e]) => (
                  <li key={id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px]">{catalog?.tweaks.find((t) => t.id === id)?.title ?? e.title}</p>
                      <p className="text-[11.5px] text-fg-faint">Applied {timeAgo(e.appliedAt)} · original values saved</p>
                    </div>
                    <Button size="sm" disabled={busy} onClick={() => revertTweaks([id])}>Revert</Button>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <div className="col-span-5 flex flex-col gap-4">
          <Panel title={<span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> System Restore</span>}
            aside={rs && <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted"><StatusDot tone={rs.enabled ? 'accent' : 'warn'} />{rs.enabled ? 'Protection on' : 'Protection off'}</span>}>
            <div className="px-5 pb-5 pt-2">
              <label className="text-[12px] text-fg-muted" htmlFor="rp-desc">Description</label>
              <div className="mt-1.5 flex gap-2">
                <input id="rp-desc" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-ink-850 px-3 text-[13px] outline-none focus:border-accent/40" />
                <Button variant="primary" busy={creating} onClick={create}>Create</Button>
              </div>
              {rs && !rs.enabled && <p className="mt-2 text-[12px] text-warn">System Protection is off for the system drive. Creating a point turns it on with 5% of the drive reserved.</p>}
              <ul className="mt-4 max-h-[210px] divide-y divide-white/[0.05] overflow-y-auto">
                {!rs ? <Skeleton className="h-16" /> : rs.points.length === 0 ? <li className="py-3 text-[12.5px] text-fg-faint">No restore points yet.</li>
                  : [...rs.points].reverse().map((p) => (
                    <li key={p.seq} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="truncate text-[12.5px]">{p.description}</span>
                      <span className="num shrink-0 text-[11px] text-fg-faint">{formatDate(p.created)}</span>
                    </li>
                  ))}
              </ul>
              <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => call('restore.open')}>Open System Restore to roll back</Button>
            </div>
          </Panel>

          <Panel title="Removed apps">
            <ul className="divide-y divide-white/[0.05] px-5 pb-3">
              {(engineState?.apps || []).length === 0 ? <li className="py-2 text-[12.5px] text-fg-faint">None.</li> : engineState!.apps.map((a) => (
                <li key={a.name + a.removedAt} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-[12.5px]">{a.name}</span>
                  <button className="shrink-0 text-[12px] text-fg-muted underline underline-offset-2 hover:text-fg" onClick={() => bridge.openExternal(`ms-windows-store://search/?query=${encodeURIComponent(a.name.replace(/^Microsoft\./, ''))}`)}>Reinstall</button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div><p className="text-[13px]">Restore point before changes</p><p className="text-[12px] text-fg-faint">Automatic, once per session</p></div>
              <Toggle checked={settings.autoRestorePoint} onChange={(v) => updateSettings({ autoRestorePoint: v })} label="Automatic restore point" />
            </div>
            <div className="flex items-center justify-between gap-4 border-t hairline px-5 py-3">
              <p className="text-[12px] text-fg-faint">Backups, state and logs live in %ProgramData%\Tickrate</p>
              <Button size="sm" variant="ghost" icon={<FolderOpen size={14} />} onClick={() => bridge.openDataFolder()}>Open</Button>
            </div>
          </Panel>
        </div>
      </div>

      <Dialog open={revertAll.open} onClose={revertAll.close} title={`Revert all ${known.length} tweaks?`}
        actions={<><Button variant="ghost" onClick={revertAll.close}>Cancel</Button><Button variant="danger" onClick={() => { revertAll.close(); revertTweaks(known.map(([id]) => id)); }}>Revert everything</Button></>}>
        Every registry value, service, scheduled task, boot setting and power plan Tickrate changed goes back to exactly what it was before. The NVIDIA profile is restored separately from its own page. Some changes need a restart to take full effect.
      </Dialog>
    </>
  );
}
