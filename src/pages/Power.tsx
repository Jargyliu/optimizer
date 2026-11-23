import { useEffect, useState } from 'react';
import { Lightning, CheckCircle } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import type { PowerPlan } from '../lib/types';
import { Button, Chip, PageHeader, Panel, Skeleton, TweakStatePill, cx } from '../components/ui';

export function Power() {
  const { scan, call, catalog, statuses, applyTweaks, revertTweaks, tasks, toast } = useStore();
  const [plans, setPlans] = useState<PowerPlan[] | null>(null);
  const dual = scan?.cpu?.class === 'x3d-dual';
  const tweakId = dual ? 'x3d.dual-ccd-balanced-plan' : 'power.low-latency-plan';
  const tweak = catalog?.tweaks.find((t) => t.id === tweakId);
  const st = statuses[tweakId]?.status;
  const busy = tasks.length > 0;

  const load = async () => { try { setPlans(await call<PowerPlan[]>('power.list')); } catch (e: any) { toast({ kind: 'error', title: 'Could not list power plans', detail: e.message }); } };
  useEffect(() => { load(); }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async (p: PowerPlan) => {
    try { await call('power.activate', { guid: p.guid }, `Activating ${p.name}`); await load(); } catch (e: any) { toast({ kind: 'error', title: 'Could not switch plan', detail: e.message }); }
  };

  return (
    <>
      <PageHeader eyebrow={scan ? (dual ? 'Dual-CCD X3D detected' : 'Single-CCD / standard CPU') : 'Detecting CPU'} title="Power plans">
        {dual
          ? 'Your CPU has two CCDs and only one has the 3D V-Cache. AMD parks the other CCD while you game, and that only works on the Balanced plan. Tickrate tunes Balanced instead of replacing it.'
          : 'Your CPU benefits from a plan that keeps every core unparked and stops USB and PCIe devices from power-saving between inputs.'}
      </PageHeader>

      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-7">
          <div className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <Chip tone="accent">Recommended for your CPU</Chip>
                <h2 className="mt-3 text-[20px] font-semibold tracking-tight">{tweak?.title ?? <Skeleton className="h-6 w-64" />}</h2>
              </div>
              <TweakStatePill state={st} />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{tweak?.description}</p>
            <div className="mt-5 flex gap-2">
              {st === 'applied'
                ? <Button onClick={() => revertTweaks([tweakId])} disabled={busy}>Revert to previous plan</Button>
                : <Button variant="primary" icon={<Lightning size={15} weight="fill" />} onClick={() => applyTweaks([tweakId])} disabled={busy || !tweak}>Apply plan</Button>}
            </div>
          </div>
        </Panel>

        <Panel className="col-span-5" title="Installed plans">
          <ul className="divide-y divide-white/[0.05] px-5 pb-3">
            {!plans ? [0, 1, 2].map((i) => <li key={i} className="py-3"><Skeleton className="h-5" /></li>) : plans.map((p) => (
              <li key={p.guid} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={cx('flex items-center gap-2 text-[13px]', p.active && 'text-accent')}>{p.active && <CheckCircle size={14} weight="fill" />}{p.name}</p>
                  <p className="num truncate text-[10.5px] text-fg-faint">{p.guid}</p>
                </div>
                {!p.active && <Button size="sm" variant="ghost" disabled={busy} onClick={() => activate(p)}>Activate</Button>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="col-span-12" title="What the plan changes and why">
          <div className="grid grid-cols-2 gap-x-10 gap-y-4 px-5 pb-5 pt-2 text-[12.5px] leading-relaxed text-fg-muted">
            {(dual ? DUAL : SINGLE).map(([k, v]) => (
              <div key={k}><p className="text-[13px] font-medium text-fg">{k}</p><p className="mt-0.5">{v}</p></div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

const SINGLE: [string, string][] = [
  ['Minimum processor state 100%, EPP 0', 'CPPC requests full performance immediately instead of ramping when a frame starts. C-states still work, so idle temperatures stay sane.'],
  ['Core parking off', 'A game or driver thread that wakes up never has to wait for a parked core to come back online.'],
  ['Aggressive boost', 'Boost clocks engage on the first sign of load.'],
  ['USB selective suspend off', 'Your mouse, keyboard and headset hub never enter a low-power state between inputs.'],
  ['PCIe link state power management off', 'The GPU and NVMe links stay at full speed, with no exit latency from L0s/L1 states.'],
  ['C-states left on', 'Disabling idle states makes X3D chips hotter, and hotter means lower boost. It is not worth it.'],
];
const DUAL: [string, string][] = [
  ['Stock Balanced plan kept', 'AMD\'s 3D V-Cache driver uses Balanced\'s core-parking policy to park the frequency CCD while Game Mode is active.'],
  ['Processor settings untouched', 'Editing minimum state, parking or EPP on a dual-CCD X3D has been shown to break CCD parking.'],
  ['USB selective suspend off', 'Your mouse, keyboard and headset hub never enter a low-power state between inputs.'],
  ['PCIe link state power management off', 'The GPU and NVMe links stay at full speed, with no exit latency from L0s/L1 states.'],
  ['Disk sleep: never', 'Avoids a spin-up or NVMe power-state exit when a game streams assets.'],
  ['Wi-Fi: maximum performance', 'Stops the wireless adapter power-saving between packets if you play on Wi-Fi.'],
];
