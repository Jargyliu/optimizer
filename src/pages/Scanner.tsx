import { ArrowsClockwise } from '@phosphor-icons/react';
import { useStore } from '../lib/store';
import { cpuLabel } from '../lib/findings';
import { timeAgo } from '../lib/format';
import { Button, Chip, PageHeader, Panel, Skeleton, cx } from '../components/ui';
import { FindingList } from './Dashboard';

export function Scanner() {
  const { scan, findings, runScan, scanning } = useStore();
  const bad = findings.filter((f) => f.severity === 'bad').length;
  const warn = findings.filter((f) => f.severity === 'warn').length;
  const good = findings.filter((f) => f.severity === 'good');

  return (
    <>
      <PageHeader eyebrow={scan ? `Last scan ${timeAgo(scan.scannedAt)}` : 'Scanning'} title="PC scan"
        actions={<Button variant="primary" icon={<ArrowsClockwise size={15} />} busy={scanning} onClick={runScan}>Scan again</Button>}>
        Checks the things that decide input latency and frame pacing in Fortnite and VALORANT: CPU scheduling, memory speed, refresh rate, GPU link and drivers, anti-cheat requirements and background load.
      </PageHeader>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 flex flex-col gap-4">
          <Panel title={<span>Findings {scan && <span className="num ml-1 text-fg-faint">{bad} critical · {warn} warnings</span>}</span>}>
            <FindingList findings={findings.filter((f) => f.severity !== 'good')} loading={!scan} />
          </Panel>
          {good.length > 0 && (
            <Panel title="Looks good">
              <FindingList findings={good} />
            </Panel>
          )}
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          <Panel title="Hardware">
            {!scan ? <div className="space-y-2 p-5">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-5" />)}</div> : (
              <dl className="divide-y divide-white/[0.05] px-5 pb-3 text-[12.5px]">
                <Row k="CPU" v={scan.cpu.name} />
                <Row k="Profile" v={<Chip tone="accent">{cpuLabel(scan.cpu.class)}</Chip>} />
                {scan.cpu.class === 'x3d-dual' && <Row k="V-Cache driver" v={scan.cpu.vcacheDriver ? 'Installed' : 'Missing'} warn={!scan.cpu.vcacheDriver} />}
                {scan.gpus.map((g) => <Row key={g.name} k="GPU" v={g.name} sub={`${g.driver}${g.driverDate ? ` · ${g.driverDate}` : ''}`} />)}
                {scan.nvidia && <Row k="PCIe link" v={`Gen ${scan.nvidia.pcieGenMax} x${scan.nvidia.pcieWidthMax}`} sub="maximum negotiated, idles lower" warn={Number(scan.nvidia.pcieWidthMax) < 16} />}
                {scan.nvidia && <Row k="Resizable BAR" v={scan.nvidia.rebar === null ? 'Unknown' : scan.nvidia.rebar ? 'On' : 'Off'} warn={scan.nvidia.rebar === false} />}
                <Row k="Memory" v={`${scan.memory.totalGB} GB ${scan.memory.type ?? ''} · ${scan.memory.modules} DIMM`} sub={`${scan.memory.configuredMTs} MT/s running · ${scan.memory.ratedMTs} MT/s rated`} />
                {scan.displays.map((d) => <Row key={d.device} k={d.primary ? 'Main display' : 'Display'} v={`${d.width}×${d.height} @ ${d.refresh} Hz`} sub={`max ${d.maxRefresh} Hz`} warn={d.maxRefresh > d.refresh + 1} />)}
                {scan.storage.disks?.map((d) => <Row key={d.name} k="Drive" v={d.name} sub={`${d.bus} ${d.media} · ${d.sizeGB} GB`} />)}
              </dl>
            )}
          </Panel>
          <Panel title="Windows">
            {!scan ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5" />)}</div> : (
              <dl className="divide-y divide-white/[0.05] px-5 pb-3 text-[12.5px]">
                <Row k="Version" v={`${scan.os.caption?.replace('Microsoft ', '')} ${scan.os.displayVersion ?? ''}`} sub={`Build ${scan.os.build}.${scan.os.ubr}`} />
                <Row k="Power plan" v={scan.settings.powerSchemeName || 'Unknown'} />
                <Row k="Game Mode" v={scan.settings.gameMode === 0 ? 'Off' : 'On'} warn={scan.settings.gameMode === 0} />
                <Row k="HAGS" v={scan.settings.hags === 2 ? 'On' : 'Off'} />
                <Row k="System drive" v={`${scan.storage.systemFreeGB} GB free`} sub={`of ${scan.storage.systemTotalGB} GB`} />
                <Row k="Startup apps" v={String(scan.software.startupCount ?? '?')} warn={(scan.software.startupCount ?? 0) > 8} />
                <Row k="Processes" v={String(scan.software.processCount ?? '?')} />
                <Row k="Uptime" v={`${scan.os.uptimeHours} h`} />
              </dl>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ k, v, sub, warn }: { k: string; v: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-fg-faint">{k}</dt>
      <dd className="min-w-0 text-right">
        <span className={cx('block truncate', warn && 'text-warn')}>{v}</span>
        {sub && <span className="num block text-[11px] text-fg-faint">{sub}</span>}
      </dd>
    </div>
  );
}
