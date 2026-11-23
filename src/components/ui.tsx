import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Impact, Risk, Evidence, Severity, TweakState } from '../lib/types';

export const spring = { type: 'spring' as const, stiffness: 120, damping: 20 };

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  busy?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', icon, busy, className, children, disabled, ...rest }: ButtonProps) {
  const base = 'no-drag inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0';
  const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm' };
  const variants = {
    primary: 'bg-accent text-accent-ink hover:bg-[#74dcb2]',
    secondary: 'bg-ink-750 text-fg border border-white/[0.07] hover:bg-ink-700 hover:border-white/[0.12]',
    ghost: 'text-fg-muted hover:text-fg hover:bg-white/[0.04]',
    danger: 'bg-bad/10 text-bad border border-bad/25 hover:bg-bad/15',
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} disabled={disabled || busy} {...rest}>
      {busy ? <TickLoader className={variant === 'primary' ? 'text-accent-ink' : 'text-accent'} /> : icon}
      {children}
    </button>
  );
}

/** Three bars that pulse like a tick meter: the app's loading glyph. */
export function TickLoader({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex h-3.5 items-end gap-[2px]', className)} aria-label="Working">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-full w-[3px] rounded-[1px] bg-current" style={{ animation: `tick 0.9s ${i * 0.15}s ease-in-out infinite`, transformOrigin: 'bottom' }} />
      ))}
    </span>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('no-drag relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-300 disabled:opacity-40', checked ? 'border-accent/40 bg-accent/90' : 'border-white/10 bg-ink-700')}
    >
      <motion.span layout transition={spring} className={cx('absolute top-[3px] h-4 w-4 rounded-full shadow-sm', checked ? 'right-[3px] bg-accent-ink' : 'left-[3px] bg-fg-muted')} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cx('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors disabled:opacity-30', checked ? 'border-accent bg-accent' : 'border-white/20 bg-transparent hover:border-white/40')}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-accent-ink"><path d="M2.5 6.2 5 8.6l4.6-5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}

const chipTone = {
  neutral: 'text-fg-muted bg-white/[0.04] border-white/[0.06]',
  accent: 'text-accent bg-accent-soft border-accent/20',
  warn: 'text-warn bg-warn/10 border-warn/20',
  bad: 'text-bad bg-bad/10 border-bad/20',
  info: 'text-info bg-info/10 border-info/20',
};
export type ChipTone = keyof typeof chipTone;

export function Chip({ tone = 'neutral', children, className, title }: { tone?: ChipTone; children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cx('inline-flex h-[22px] items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium tracking-wide', chipTone[tone], className)}>{children}</span>;
}

export const impactTone: Record<Impact, ChipTone> = { high: 'accent', medium: 'info', low: 'neutral' };
export const riskTone: Record<Risk, ChipTone> = { safe: 'neutral', moderate: 'warn', advanced: 'bad' };
export const evidenceLabel: Record<Evidence, string> = { proven: 'Measurable', situational: 'Situational', minor: 'Quality of life' };
export const severityTone: Record<Severity, ChipTone> = { good: 'accent', info: 'info', warn: 'warn', bad: 'bad' };

export function StatusDot({ tone, pulse }: { tone: 'accent' | 'warn' | 'bad' | 'info' | 'neutral'; pulse?: boolean }) {
  const color = { accent: 'bg-accent', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info', neutral: 'bg-fg-faint' }[tone];
  return <span className={cx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', color)} style={pulse ? { animation: 'breathe 2.4s ease-in-out infinite' } : undefined} />;
}

export function TweakStatePill({ state }: { state: TweakState | undefined }) {
  const map: Record<TweakState, [string, 'accent' | 'warn' | 'neutral' | 'info']> = {
    applied: ['Applied', 'accent'], partial: ['Partial', 'warn'], default: ['Windows default', 'neutral'], na: ['Not applicable', 'neutral'], unknown: ['Checking', 'neutral'],
  };
  const [label, tone] = map[state ?? 'unknown'];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
      <StatusDot tone={tone} pulse={state === 'applied'} />
      {label}
    </span>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-8 pb-7">
      <div className="max-w-[68ch]">
        <p className="num mb-2 text-[11px] uppercase tracking-[0.18em] text-fg-faint">{eyebrow}</p>
        <h1 className="text-[28px] font-semibold leading-none tracking-tight">{title}</h1>
        {children && <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">{children}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ className, children, title, aside }: { className?: string; children: ReactNode; title?: ReactNode; aside?: ReactNode }) {
  return (
    <section className={cx('surface rounded-2xl', className)}>
      {title && (
        <div className="flex items-center justify-between gap-4 px-5 pb-1 pt-4">
          <h2 className="text-[13px] font-medium text-fg-muted">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('shimmer rounded-md', className)} />;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-10">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] bg-ink-800 text-fg-muted">{icon}</div>
      <div>
        <p className="text-[15px] font-medium">{title}</p>
        {children && <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-fg-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};
export const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring },
};
