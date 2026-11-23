import { useEffect, useRef, useState } from 'react';
import { Play, Terminal } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import type { MaintenanceTask } from '../lib/types';
import { Button, Chip, PageHeader, Panel, TickLoader, cx } from '../components/ui';
import { Dialog, useDialog } from '../components/Shell';

export function Tools() {
  const { catalog, call, toast, logs, tasks } = useStore();
  const [running, setRunning] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const confirm = useDialog<MaintenanceTask>();
  const out = useRef<HTMLDivElement>(null);
  const lines = since ? logs.filter((l) => l.action === 'maint.run' && l.time >= since) : [];
  useEffect(() => { if (out.current) out.current.scrollTop = out.current.scrollHeight; }, [lines.length]);

  const run = async (t: MaintenanceTask) => {
    confirm.close();
    setRunning(t.id); setSince(new Date().toISOString());
    try {
      const r = await call<{ exitCode: number }>('maint.run', { task: t.id }, t.label);
      toast({ kind: r.exitCode === 0 ? 'success' : 'error', title: `${t.label} finished`, detail: r.exitCode === 0 ? undefined : `Exit code ${r.exitCode}. See the output for details.` });
    } catch (e: any) { toast({ kind: 'error', title: `${t.label} failed`, detail: e.message }); }
    finally { setRunning(null); }
  };

  return (
    <>
      <PageHeader eyebrow="Windows repair & upkeep" title="Maintenance">
        Built-in Windows tools, one click each, with their output shown live. Run "Repair Windows image" and then "System file check" if you get unexplained crashes after an update.
      </PageHeader>
      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-6">
          <ul className="divide-y divide-white/[0.05] px-5 py-2">
            {catalog?.maintenanceTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium">{t.label}<span className="num text-[11px] font-normal text-fg-faint">{t.minutes} min</span>{t.danger && <Chip tone="warn">Restart needed</Chip>}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{t.detail}</p>
                </div>
                <Button size="sm" icon={running === t.id ? undefined : <Play size={12} weight="fill" />} busy={running === t.id} disabled={!!running || (tasks.length > 0 && running !== t.id)}
                  onClick={() => (t.danger ? confirm.show(t) : run(t))}>Run</Button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="col-span-6 flex flex-col" title={<span className="inline-flex items-center gap-1.5"><Terminal size={13} /> Output</span>} aside={running && <TickLoader className="text-accent" />}>
          <div ref={out} className="num m-3 mt-2 h-[460px] overflow-y-auto rounded-xl bg-ink-950 p-4 text-[11.5px] leading-[1.75]">
            {!since && <p className="text-fg-faint">Run a task to see its output here.</p>}
            {lines.map((l, i) => <p key={i} className={cx('whitespace-pre-wrap break-all', l.level === 'error' ? 'text-bad' : 'text-fg-muted')}>{l.message}</p>)}
          </div>
        </Panel>
      </div>
      <Dialog open={confirm.open} onClose={confirm.close} title={confirm.value?.label ?? ''}
        actions={<><Button variant="ghost" onClick={confirm.close}>Cancel</Button><Button variant="primary" onClick={() => run(confirm.value!)}>Run</Button></>}>
        {confirm.value?.detail}
      </Dialog>
    </>
  );
}
