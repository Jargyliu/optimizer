import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Package, RocketLaunch } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import type { StartupItem } from '../lib/types';
import { Button, Checkbox, Chip, Empty, PageHeader, Panel, Skeleton, Toggle, cx, spring } from '../components/ui';
import { Dialog, useDialog } from '../components/Shell';

export function Debloat() {
  const [tab, setTab] = useState<'apps' | 'startup'>('apps');
  return (
    <>
      <PageHeader eyebrow="Debloat" title={tab === 'apps' ? 'Preinstalled apps' : 'Startup apps'}
        actions={
          <div className="flex h-9 items-center rounded-lg border border-white/[0.07] bg-ink-900 p-0.5 text-[12.5px]">
            {([['apps', 'Store apps'], ['startup', 'Startup apps']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={cx('relative h-full rounded-md px-3', tab === k ? 'text-fg' : 'text-fg-muted')}>
                {tab === k && <motion.span layoutId="debloat-tab" transition={spring} className="absolute inset-0 rounded-md bg-ink-750" />}
                <span className="relative">{l}</span>
              </button>
            ))}
          </div>
        }>
        {tab === 'apps'
          ? 'Remove the promotional and rarely used Store apps Windows ships with. Fewer apps means fewer background tasks, update downloads and notification hooks. Anything Windows, Xbox Game Bar or your games need is protected.'
          : 'Everything that launches when you sign in. Disabling an entry works like Task Manager\'s Startup tab: the app stays installed and you can turn it back on any time.'}
      </PageHeader>
      {tab === 'apps' ? <Apps /> : <Startup />}
    </>
  );
}

function Apps() {
  const { catalog, call, toast, bridge, refreshEngineState } = useStore();
  const [installed, setInstalled] = useState<Record<string, { name: string; version: string }> | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [deprovision, setDeprovision] = useState(true);
  const confirm = useDialog();

  const load = async () => {
    if (!catalog) return;
    try {
      const r = await call<Record<string, any>>('apps.list', { patterns: catalog.apps.map((a) => a.pattern) });
      setInstalled(r);
      setSel(new Set(catalog.apps.filter((a) => a.recommended && r[a.pattern]).map((a) => a.pattern)));
    } catch (e: any) { toast({ kind: 'error', title: 'Could not list apps', detail: e.message }); }
  };
  useEffect(() => { load(); }, [catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => [...new Set(catalog?.apps.map((a) => a.group))], [catalog]);
  const remove = async () => {
    confirm.close();
    try {
      const r = await call<{ removed: string[]; failed: string[] }>('apps.remove', { patterns: [...sel], deprovision }, `Removing ${sel.size} apps`);
      toast(r.failed.length ? { kind: 'error', title: `${r.removed.length} removed, ${r.failed.length} failed`, detail: r.failed.join('\n') } : { kind: 'success', title: `${r.removed.length} apps removed` });
      await Promise.all([load(), refreshEngineState()]);
    } catch (e: any) { toast({ kind: 'error', title: 'Removal failed', detail: e.message }); }
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <Panel className="col-span-8" title={<span>Installed bloat <span className="num ml-1 text-fg-faint">{installed ? Object.keys(installed).length : ''}</span></span>}
        aside={<Button size="sm" variant="danger" disabled={!sel.size} onClick={() => confirm.show(true)}>Remove {sel.size || ''}</Button>}>
        {!installed ? <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}</div> : (
          <div className="px-5 pb-4">
            {groups.map((g) => {
              const items = catalog!.apps.filter((a) => a.group === g && installed[a.pattern]);
              if (!items.length) return null;
              return (
                <div key={g} className="mt-3">
                  <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-fg-faint">{g}</p>
                  <ul className="divide-y divide-white/[0.05]">
                    {items.map((a) => (
                      <li key={a.pattern} className="flex items-center gap-3 py-2.5">
                        <Checkbox checked={sel.has(a.pattern)} label={a.label} onChange={(v) => setSel((s) => { const n = new Set(s); v ? n.add(a.pattern) : n.delete(a.pattern); return n; })} />
                        <span className="flex-1 text-[13px]">{a.label}</span>
                        {a.recommended && <Chip>Suggested</Chip>}
                        <span className="num w-[220px] truncate text-right text-[11px] text-fg-faint">{installed[a.pattern].name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {Object.keys(installed).length === 0 && <Empty icon={<Package size={20} />} title="Nothing to remove">None of the known bloat apps are installed.</Empty>}
          </div>
        )}
      </Panel>
      <Panel className="col-span-4" title={<span className="inline-flex items-center gap-1.5"><Lock size={13} /> Kept on purpose</span>}>
        <ul className="space-y-3 px-5 pb-5 pt-1">
          {catalog?.protectedApps.map((p) => (
            <li key={p.label}><p className="text-[13px] font-medium">{p.label}</p><p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">{p.reason}</p></li>
          ))}
        </ul>
      </Panel>

      <Dialog open={confirm.open} onClose={confirm.close} title={`Remove ${sel.size} apps?`}
        actions={<><Button variant="ghost" onClick={confirm.close}>Cancel</Button><Button variant="danger" onClick={remove}>Remove</Button></>}>
        <p>App removal cannot be reverted automatically. A restore point does not bring Store apps back. Each app can be reinstalled from the Microsoft Store, and the Restore & revert page lists everything removed here with a Store link.</p>
        <label className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-ink-850 px-4 py-3">
          <span><span className="block text-[13px] text-fg">Also remove for new user accounts</span><span className="block text-[12px] text-fg-faint">Stops Windows reinstalling them for new users and after some feature updates.</span></span>
          <input type="checkbox" className="h-4 w-4 accent-[#62d4a6]" checked={deprovision} onChange={(e) => setDeprovision(e.target.checked)} />
        </label>
        <button className="mt-3 text-[12px] text-fg-faint underline underline-offset-2" onClick={() => bridge.openExternal('ms-windows-store://home')}>Open Microsoft Store</button>
      </Dialog>
    </div>
  );
}

function Startup() {
  const { call, toast } = useStore();
  const [items, setItems] = useState<StartupItem[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { call<StartupItem[]>('startup.list').then(setItems).catch((e) => toast({ kind: 'error', title: 'Could not list startup apps', detail: e.message })); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = async (it: StartupItem, enabled: boolean) => {
    setPending(it.id);
    try { setItems(await call<StartupItem[]>('startup.set', { id: it.id, enabled })); }
    catch (e: any) { toast({ kind: 'error', title: `Could not change ${it.name}`, detail: e.message }); }
    finally { setPending(null); }
  };

  const enabledCount = items?.filter((i) => i.enabled).length ?? 0;
  return (
    <Panel title={<span>Starts with Windows <span className="num ml-1 text-fg-faint">{items ? `${enabledCount} of ${items.length} enabled` : ''}</span></span>}>
      {!items ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        : items.length === 0 ? <Empty icon={<RocketLaunch size={20} />} title="No startup apps">Nothing launches at sign-in.</Empty>
        : (
          <ul className="divide-y divide-white/[0.05] px-5 pb-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cx('text-[13.5px]', !it.enabled && 'text-fg-muted')}>{it.name} <span className="ml-1.5 text-[11px] text-fg-faint">{it.source}</span></p>
                  <p className="num mt-0.5 truncate text-[11px] text-fg-faint" title={it.command}>{it.command}</p>
                </div>
                <Toggle checked={it.enabled} disabled={pending === it.id} onChange={(v) => set(it, v)} label={`${it.enabled ? 'Disable' : 'Enable'} ${it.name}`} />
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}
