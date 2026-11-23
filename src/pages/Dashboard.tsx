import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { memo, useEffect, useState } from 'react';
import { ArrowRight, ArrowsClockwise, Lightning, ShieldCheck, GameController } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import { cpuLabel } from '../lib/findings';
import type { Finding } from '../lib/types';
import { Button, Chip, Panel, Skeleton, StatusDot, cx, itemVariants, listVariants, severityTone, spring } from '../components/ui';
import { PresetDialog } from '../components/PresetDialog';

export function Dashboard() {
  const { scan, score, findings, runScan, scanning, catalog } = useStore();
  const [presetOpen, setPresetOpen] = useState(false);
  const issues = findings.filter((f) => f.severity !== 'good');

  return (
    <>
      <div className="grid grid-cols-12 gap-4">
        {/* Readiness */}
        <Panel className="col-span-7 overflow-hidden">
          <div className="flex items-center gap-8 p-7">
            <ScoreRing value={scan && catalog ? score.score : null} />
            <div className="min-w-0 flex-1">
              <p className="num text-[11px] uppercase tracking-[0.18em] text-fg-faint">Latency readiness</p>
              <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight">
                {scan ? headline(score.score, issues.length) : 'Scanning your PC'}
              </h1>
              <div className="mt-5 grid grid-cols-2 gap-5">
                <Meter label="System health" value={score.health} />
                <Meter label="Competitive tweaks" value={score.coverage} suffix={`${score.done}/${score.total}`} />
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="primary" icon={<Lightning size={16} weight="fill" />} onClick={() => setPresetOpen(true)} disabled={!catalog}>Optimize</Button>
                <Button icon={<ArrowsClockwise size={15} />} onClick={runScan} busy={scanning}>Rescan</Button>
              </div>
            </div>
          </div>
        </Panel>

        {/* Hardware */}
        <Panel className="col-span-5" title="Detected hardware" aside={scan && <Chip tone="accent">{cpuLabel(scan.cpu.class)}</Chip>}>
          <dl className="divide-y divide-white/[0.05] px-5 pb-2">
            {scan ? (
              <>
                <Spec k="CPU" v={scan.cpu.name?.replace(/ \d+-Core Processor/, '')} sub={`${scan.cpu.cores}C / ${scan.cpu.threads}T`} />
                <Spec k="GPU" v={scan.nvidia?.name || scan.gpus[0]?.name} sub={scan.nvidia ? `Driver ${scan.nvidia.driver}` : scan.gpus[0]?.driver} />
                <Spec k="Memory" v={`${scan.memory.totalGB ?? '?'} GB ${scan.memory.type ?? ''}`} sub={scan.memory.configuredMTs ? `${scan.memory.configuredMTs} MT/s` : undefined} />
                <Spec k="Display" v={scan.displays.find((d) => d.primary) ? `${scan.displays.find((d) => d.primary)!.width}×${scan.displays.find((d) => d.primary)!.height}` : 'Unknown'} sub={scan.displays.find((d) => d.primary) ? `${scan.displays.find((d) => d.primary)!.refresh} Hz` : undefined} />
                <Spec k="Windows" v={scan.os.displayVersion ? `11 ${scan.os.displayVersion}` : scan.os.caption} sub={scan.os.build ? `Build ${scan.os.build}.${scan.os.ubr}` : undefined} />
              </>
            ) : (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex justify-between py-3"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-40" /></div>)
            )}
          </dl>
        </Panel>

        {/* Findings */}
        <Panel className="col-span-8" title={<span>Needs attention <span className="num ml-1 text-fg-faint">{scan ? issues.length : ''}</span></span>} aside={<SeeAll />}>
          <FindingList findings={issues.slice(0, 6)} loading={!scan} />
        </Panel>

        {/* Anti-cheat + games */}
        <div className="col-span-4 flex flex-col gap-4">
          <AntiCheat />
          <Games />
        </div>
      </div>
      <PresetDialog open={presetOpen} onClose={() => setPresetOpen(false)} />
    </>
  );
}

function headline(score: number, issues: number) {
  if (score >= 85) return issues ? `Dialed in. ${issues} small thing${issues > 1 ? 's' : ''} left to check.` : 'Dialed in.';
  if (score >= 60) return `Good base. ${issues} item${issues === 1 ? '' : 's'} holding you back.`;
  return `Lots of latency left on the table: ${issues} item${issues === 1 ? '' : 's'} found.`;
}

function SeeAll() {
  const { go } = useStore();
  return <button onClick={() => go('scan')} className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg">Full report <ArrowRight size={12} /></button>;
}

const ScoreRing = memo(function ScoreRing({ value }: { value: number | null }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.round(v).toString());
  const dash = useTransform(mv, (v) => `${(v / 100) * C} ${C}`);
  useEffect(() => {
    if (value === null) return;
    const c = animate(mv, value, { type: 'spring', stiffness: 40, damping: 18 });
    return () => c.stop();
  }, [value, mv]);
  const tone = value === null ? '#4b4c57' : value >= 80 ? '#62d4a6' : value >= 55 ? '#e3b562' : '#e9806f';
  return (
    <div className="relative h-[164px] w-[164px] shrink-0">
      <svg viewBox="0 0 164 164" className="h-full w-full -rotate-90">
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = 78, r2 = i % 5 === 0 ? 74 : 76;
          return <line key={i} x1={82 + r1 * Math.cos(a)} y1={82 + r1 * Math.sin(a)} x2={82 + r2 * Math.cos(a)} y2={82 + r2 * Math.sin(a)} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.16 : 0.07} strokeWidth="1" />;
        })}
        <circle cx="82" cy="82" r={R} fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="9" />
        <motion.circle cx="82" cy="82" r={R} fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round" style={{ strokeDasharray: dash }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {value === null ? <Skeleton className="h-10 w-16" /> : (
          <div className="text-center">
            <motion.span className="num block text-[44px] font-medium leading-none tracking-tighter">{display}</motion.span>
            <span className="num mt-1 block text-[11px] text-fg-faint">/ 100</span>
          </div>
        )}
      </div>
    </div>
  );
});

function Meter({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-fg-muted">{label}</span>
        <span className="num text-fg">{suffix ?? `${Math.round(value)}%`}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div className="h-full rounded-full bg-fg/80" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={spring} />
      </div>
    </div>
  );
}

function Spec({ k, v, sub }: { k: string; v?: string | null; sub?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[11px]">
      <dt className="text-[12px] text-fg-faint">{k}</dt>
      <dd className="min-w-0 text-right">
        <span className="block truncate text-[13px]">{v || 'Unknown'}</span>
        {sub && <span className="num block text-[11.5px] text-fg-faint">{sub}</span>}
      </dd>
    </div>
  );
}

export function FindingList({ findings, loading }: { findings: Finding[]; loading?: boolean }) {
  const { go, applyTweaks, bridge, tasks } = useStore();
  if (loading) return <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!findings.length) return <p className="px-5 pb-6 pt-3 text-[13px] text-fg-muted">Nothing to fix. Your system checks out.</p>;
  return (
    <motion.ul variants={listVariants} initial="hidden" animate="show" className="divide-y divide-white/[0.05] px-2 pb-2">
      {findings.map((f) => (
        <motion.li key={f.id} variants={itemVariants} className="flex items-start gap-3 rounded-lg px-3 py-3">
          <span className="mt-[7px]"><StatusDot tone={severityTone[f.severity] as any} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">{f.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{f.detail}</p>
          </div>
          {f.fix && (
            <Button size="sm" className="mt-0.5 shrink-0" disabled={tasks.length > 0 && !!f.fix.tweakIds}
              onClick={() => {
                if (f.fix!.tweakIds) applyTweaks(f.fix!.tweakIds);
                else if (f.fix!.page) go(f.fix!.page);
                else if (f.fix!.url) bridge.openExternal(f.fix!.url);
              }}>
              {f.fix.label}
            </Button>
          )}
        </motion.li>
      ))}
    </motion.ul>
  );
}

function AntiCheat() {
  const { scan } = useStore();
  const s = scan?.security;
  const rows: [string, boolean | null | undefined, string][] = [
    ['Secure Boot', s?.secureBoot, 'Vanguard, FN tournaments'],
    ['TPM 2.0', s?.tpm ? s.tpm.ready : s?.tpm === null ? null : undefined, 'Vanguard, FN tournaments'],
    ['VBS', s?.vbsRunning, 'Vanguard On-Demand'],
    ['Memory Integrity', s?.hvciRunning, 'Vanguard On-Demand'],
  ];
  return (
    <Panel title={<span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> Anti-cheat readiness</span>}>
      <ul className="px-5 pb-4 pt-1">
        {rows.map(([label, ok, why]) => (
          <li key={label} className="flex items-center justify-between py-1.5 text-[13px]">
            <span className="flex items-center gap-2"><StatusDot tone={ok === undefined ? 'neutral' : ok ? 'accent' : ok === null ? 'neutral' : 'warn'} />{label}</span>
            <span className={cx('text-[11.5px]', ok ? 'text-fg-faint' : 'text-warn')}>{!scan ? '·' : ok ? 'On' : ok === false ? `Off · ${why}` : 'Unknown'}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Games() {
  const { scan } = useStore();
  const g = scan?.games;
  return (
    <Panel title={<span className="inline-flex items-center gap-1.5"><GameController size={14} /> Games</span>}>
      <ul className="px-5 pb-4 pt-1">
        {[['Fortnite', g?.fortnite], ['VALORANT', g?.valorant]].map(([name, info]: any) => (
          <li key={name} className="flex items-center justify-between py-1.5 text-[13px]">
            <span className="flex items-center gap-2"><StatusDot tone={info?.installed ? 'accent' : 'neutral'} />{name}</span>
            <span className="max-w-[60%] truncate text-[11.5px] text-fg-faint" title={info?.dir || ''}>{!scan ? '·' : info?.installed ? info.dir : 'Not found'}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
