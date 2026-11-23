import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Warning } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import { isApplicable } from '../lib/findings';
import { Dialog } from './Shell';
import { Button, Chip, cx, impactTone, spring } from './ui';

export function PresetDialog({ open, onClose, initial = 'essential' }: { open: boolean; onClose: () => void; initial?: string }) {
  const { catalog, statuses, scan, settings, applyTweaks, updateSettings } = useStore();
  const [preset, setPreset] = useState(initial);
  const cpuClass = scan?.cpu?.class;

  const plan = useMemo(() => {
    if (!catalog) return { todo: [], already: 0, skipped: 0 };
    const inPreset = catalog.tweaks.filter((t) => t.presets.includes(preset));
    const applicable = inPreset.filter((t) => isApplicable(t, cpuClass) && statuses[t.id]?.status !== 'na');
    const todo = applicable.filter((t) => statuses[t.id]?.status !== 'applied');
    return { todo, already: applicable.length - todo.length, skipped: inPreset.length - applicable.length };
  }, [catalog, preset, statuses, cpuClass]);

  const needsRestart = plan.todo.some((t) => t.reboot === 'restart');
  const warnings = [...new Set(plan.todo.map((t) => t.warning).filter(Boolean) as string[])];

  return (
    <Dialog open={open} onClose={onClose} title="Optimize this PC" wide
      actions={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!plan.todo.length} onClick={() => { onClose(); applyTweaks(plan.todo.map((t) => t.id)); }}>
          Apply {plan.todo.length} tweak{plan.todo.length === 1 ? '' : 's'}
        </Button>
      </>}>
      <div className="grid gap-1.5 pb-4 pt-1">
        {catalog?.presets.map((p) => {
          const n = catalog.tweaks.filter((t) => t.presets.includes(p.id) && isApplicable(t, cpuClass) && statuses[t.id]?.status !== 'na').length;
          const active = preset === p.id;
          return (
            <button key={p.id} onClick={() => setPreset(p.id)} className={cx('relative flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors', active ? 'border-accent/30' : 'border-white/[0.06] hover:border-white/[0.12]')}>
              {active && <motion.span layoutId="preset-active" transition={spring} className="absolute inset-0 rounded-xl bg-accent/[0.06]" />}
              <span className={cx('relative mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border', active ? 'border-accent' : 'border-white/25')}>
                {active && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-fg">{p.label}</span>
                  <span className="num text-[12px] text-fg-faint">{n} tweaks</span>
                </span>
                <span className="mt-0.5 block text-[12.5px] text-fg-muted">{p.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t hairline pt-4">
        <p className="mb-2 text-[12px] text-fg-faint">
          <span className="num text-fg">{plan.todo.length}</span> to apply · <span className="num">{plan.already}</span> already applied
          {plan.skipped > 0 && <> · <span className="num">{plan.skipped}</span> skipped (not for your {cpuClass === 'x3d-dual' ? 'dual-CCD X3D' : 'CPU'})</>}
        </p>
        <ul className="max-h-[200px] divide-y divide-white/[0.05] overflow-y-auto rounded-xl border border-white/[0.06]">
          {plan.todo.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
              <span className="truncate text-[13px] text-fg">{t.title}</span>
              <Chip tone={impactTone[t.impact]}>{t.impact}</Chip>
            </li>
          ))}
          {!plan.todo.length && <li className="px-3.5 py-4 text-[13px]">Everything in this preset is already applied.</li>}
        </ul>
        {warnings.map((w) => (
          <p key={w} className="mt-3 flex gap-2 text-[12.5px] text-warn"><Warning size={15} className="mt-0.5 shrink-0" />{w}</p>
        ))}
        <label className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-ink-850 px-4 py-3">
          <span>
            <span className="block text-[13px] text-fg">Create a System Restore point first</span>
            <span className="block text-[12px] text-fg-faint">Once per session. Every tweak is also backed up individually and can be reverted on its own.</span>
          </span>
          <input type="checkbox" className="h-4 w-4 accent-[#62d4a6]" checked={settings.autoRestorePoint} onChange={(e) => updateSettings({ autoRestorePoint: e.target.checked })} />
        </label>
        {needsRestart && <p className="mt-3 text-[12.5px] text-fg-faint">Some of these take effect after a restart.</p>}
      </div>
    </Dialog>
  );
}
