import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowCounterClockwise, ArrowSquareOut, DownloadSimple, Eye, GraphicsCard } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import { asArray, formatDate } from '../lib/format';
import type { NvidiaSetting } from '../lib/types';
import { Button, Chip, Empty, PageHeader, Panel, Skeleton, StatusDot, cx, spring } from '../components/ui';
import { Dialog, useDialog } from '../components/Shell';

interface NvStatus { installed: boolean; exe: string | null; version: string | null; hasNvidiaGpu: boolean; applied: any }

const VSYNC = { app: 0x60925292, off: 0x08416747, on: 0x47814940 };

export function Nvidia() {
  const { catalog, call, settings, updateSettings, toast, scan, refreshEngineState, bridge } = useStore();
  const [status, setStatus] = useState<NvStatus | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const revertDlg = useDialog();
  const defs = catalog?.nvidiaSettings || [];

  const load = async () => {
    try { setStatus(await call<NvStatus>('nvidia.status')); } catch (e: any) { toast({ kind: 'error', title: 'Could not check NVIDIA tools', detail: e.message }); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // start from what was applied last time, otherwise from the recommendations
  useEffect(() => {
    if (!defs.length) return;
    const v: Record<string, number> = {};
    for (const d of defs) v[d.key] = d.recommended;
    v.vsync = settings.monitorType === 'vrr' ? VSYNC.on : settings.monitorType === 'fixed' ? VSYNC.off : VSYNC.app;
    for (const a of asArray<any>(status?.applied?.applied)) {
      const d = defs.find((x) => x.id === a.id);
      if (d) v[d.key] = Number(a.value);
    }
    setValues(v);
  }, [defs, status, settings.monitorType]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e: any) { toast({ kind: 'error', title: `${label} failed`, detail: e.message }); }
    finally { setBusy(null); }
  };

  const install = () => run('Download', async () => {
    setStatus(await call<NvStatus>('nvidia.install', {}, 'Downloading NVIDIA Profile Inspector'));
    toast({ kind: 'success', title: 'NVIDIA Profile Inspector ready', detail: 'Downloaded from the official Orbmu2k GitHub release.' });
  });
  const read = () => run('Read', async () => {
    setCurrent(await call<Record<string, string>>('nvidia.read', {}, 'Reading driver profile'));
  });
  const apply = () => run('Apply', async () => {
    const payload = defs.map((d) => ({ key: d.key, value: values[d.key] }));
    const r = await call<{ verified: boolean; mismatch: string[]; current: Record<string, string> }>('nvidia.apply', { settings: payload }, 'Writing NVIDIA driver profile');
    setCurrent(r.current);
    r.mismatch = asArray(r.mismatch);
    if (r.verified) toast({ kind: 'success', title: 'Driver profile updated', detail: 'Read back from the driver and verified. Your original profile is backed up.' });
    else toast({ kind: 'error', title: 'Some settings did not stick', detail: r.mismatch.join(', ') });
    await Promise.all([load(), refreshEngineState()]);
  });
  const revert = () => run('Restore', async () => {
    const r = await call<{ restored: number; current: Record<string, string> }>('nvidia.revert', {}, 'Restoring NVIDIA driver profile');
    setCurrent(r.current);
    toast({ kind: 'success', title: 'Original driver profile restored', detail: r.restored ? `${r.restored} of your own settings restored.` : 'Base Profile reset to NVIDIA defaults.' });
    await Promise.all([load(), refreshEngineState()]);
  });

  const changed = useMemo(() => defs.filter((d) => values[d.key] !== d.default).length, [defs, values]);
  const noNvidia = status && !status.hasNvidiaGpu;

  return (
    <>
      <PageHeader eyebrow="Global driver profile · via NVIDIA Profile Inspector" title="NVIDIA profile"
        actions={<>
          {status?.applied && <Button icon={<ArrowCounterClockwise size={15} />} onClick={() => revertDlg.show(true)} busy={busy === 'Restore'}>Restore original</Button>}
          <Button variant="primary" disabled={!status?.installed || !!busy || !!noNvidia} busy={busy === 'Apply'} onClick={apply}>Apply to driver</Button>
        </>}>
        Writes the settings below into the driver's Base Profile, the same place the NVIDIA Control Panel uses. Tickrate exports your current profile first, imports in merge mode so your other customizations stay, then reads the result back to verify it.
      </PageHeader>

      {noNvidia ? (
        <Panel><Empty icon={<GraphicsCard size={20} />} title="No NVIDIA GPU detected">This page only applies to GeForce and RTX cards. If you just installed one, install the NVIDIA driver and rescan.</Empty></Panel>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* tool status */}
          <Panel className="col-span-12">
            <div className="flex items-center gap-6 px-5 py-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-800 text-accent"><GraphicsCard size={20} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{scan?.nvidia?.name || 'NVIDIA GPU'} <span className="num ml-2 text-[12px] font-normal text-fg-faint">{scan?.nvidia ? `driver ${scan.nvidia.driver}` : ''}</span></p>
                <p className="mt-0.5 text-[12.5px] text-fg-muted">
                  {!status ? 'Checking for NVIDIA Profile Inspector' : status.installed ? <>NVIDIA Profile Inspector <span className="num">{status.version}</span> installed</> : 'NVIDIA Profile Inspector is downloaded from its official GitHub release on first use (about 1 MB).'}
                  {status?.applied && <> · original profile backed up {formatDate(status.applied.firstAppliedAt)}</>}
                </p>
              </div>
              {status && !status.installed && <Button variant="primary" icon={<DownloadSimple size={15} />} busy={busy === 'Download'} onClick={install}>Download</Button>}
              {status?.installed && <Button icon={<Eye size={15} />} busy={busy === 'Read'} onClick={read} disabled={!!busy}>Read current values</Button>}
              <Button variant="ghost" icon={<ArrowSquareOut size={14} />} onClick={() => bridge.openExternal('https://github.com/Orbmu2k/nvidiaProfileInspector')}>Source</Button>
            </div>
          </Panel>

          {/* monitor */}
          <Panel className="col-span-12">
            <div className="flex items-center justify-between gap-6 px-5 py-4">
              <div>
                <p className="text-[14px] font-medium">Your monitor</p>
                <p className="mt-0.5 max-w-[70ch] text-[12.5px] text-fg-muted">Decides the V-Sync setting. With G-SYNC: G-SYNC on, V-Sync on here, V-Sync off in-game, Reflex On + Boost. That gives tear-free output with Reflex capping FPS just under refresh. Without VRR: V-Sync forced off.</p>
              </div>
              <div className="flex h-9 shrink-0 items-center rounded-lg border border-white/[0.07] bg-ink-850 p-0.5 text-[12.5px]">
                {([['vrr', 'G-SYNC / VRR'], ['fixed', 'Fixed refresh']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => updateSettings({ monitorType: k })} className={cx('relative h-full rounded-md px-3', settings.monitorType === k ? 'text-fg' : 'text-fg-muted')}>
                    {settings.monitorType === k && <motion.span layoutId="mon" transition={spring} className="absolute inset-0 rounded-md bg-ink-700" />}
                    <span className="relative">{l}</span>
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="col-span-8" title={<span>Driver settings <span className="num ml-1 text-fg-faint">{changed} differ from default</span></span>}>
            <ul className="divide-y divide-white/[0.05] px-5 pb-2">
              {!defs.length ? [0, 1, 2].map((i) => <li key={i} className="py-4"><Skeleton className="h-10" /></li>) : defs.map((d) => (
                <SettingRow key={d.key} d={d} value={values[d.key]} current={current?.[String(d.id >>> 0)]} onChange={(v) => setValues((s) => ({ ...s, [d.key]: v }))} />
              ))}
            </ul>
          </Panel>

          <div className="col-span-4 flex flex-col gap-4">
            <Panel title="In-game: both titles">
              <ul className="space-y-2.5 px-5 pb-5 pt-1 text-[12.5px] leading-relaxed text-fg-muted">
                <li><span className="text-fg">NVIDIA Reflex: On + Boost.</span> It replaces the driver's low-latency mode and is the single largest latency reduction available.</li>
                <li><span className="text-fg">V-Sync off in-game.</span> On a G-SYNC display, V-Sync is handled by the driver setting above.</li>
                <li><span className="text-fg">Frame cap:</span> with Reflex + G-SYNC, leave it uncapped (Reflex caps automatically). Without G-SYNC, cap at a value your PC holds 99% of the time.</li>
                <li><span className="text-fg">Fortnite:</span> DirectX 12 or Performance mode. Performance mode has the lowest CPU cost on most X3D systems.</li>
              </ul>
            </Panel>
            <Panel title="Also check in the NVIDIA App">
              <ul className="space-y-2.5 px-5 pb-5 pt-1 text-[12.5px] leading-relaxed text-fg-muted">
                <li>Turn off Instant Replay and the in-game overlay if you do not use them. They run a background capture.</li>
                <li>Set your display to its maximum refresh rate and full RGB output dynamic range.</li>
                <li>After a driver update, clear the shader cache from the Cleanup page if you see stutter.</li>
              </ul>
            </Panel>
          </div>
        </div>
      )}

      <Dialog open={revertDlg.open} onClose={revertDlg.close} title="Restore your original driver profile?"
        actions={<><Button variant="ghost" onClick={revertDlg.close}>Cancel</Button><Button variant="primary" onClick={() => { revertDlg.close(); revert(); }}>Restore</Button></>}>
        Tickrate re-imports the Base Profile it exported before its first change. If your Base Profile had no custom settings back then, it is reset to NVIDIA's defaults. Game-specific profiles are not touched.
      </Dialog>
    </>
  );
}

function SettingRow({ d, value, current, onChange }: { d: NvidiaSetting; value: number | undefined; current?: string; onChange: (v: number) => void }) {
  const curLabel = current !== undefined ? d.options.find((o) => String(o.value >>> 0) === current)?.label ?? current : undefined;
  return (
    <li className="grid grid-cols-[1fr_230px] gap-6 py-4">
      <div>
        <p className="flex items-center gap-2 text-[13.5px] font-medium">
          {d.label}
          {value === d.recommended && !d.dependsOnVrr && <Chip tone="accent">Recommended</Chip>}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{d.description}</p>
        {curLabel !== undefined && <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-fg-faint"><StatusDot tone="neutral" /> Driver now: <span className="num text-fg-muted">{curLabel}</span></p>}
      </div>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="no-drag h-9 self-start rounded-lg border border-white/[0.08] bg-ink-800 px-2.5 text-[13px] text-fg outline-none focus:border-accent/40">
        {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </li>
  );
}
