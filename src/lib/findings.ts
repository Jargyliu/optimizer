import type { Catalog, Finding, ScanFacts, TweakStatus } from './types';

const DAY = 86400e3;

export function cpuLabel(c: ScanFacts['cpu']['class'] | undefined) {
  switch (c) {
    case 'x3d-dual': return 'Dual-CCD X3D';
    case 'x3d-single': return 'Single-CCD X3D';
    case 'ryzen': return 'Ryzen';
    default: return 'CPU';
  }
}

/** Turns raw scan facts into actionable findings. Every rule is documented in docs/SCANNER.md. */
export function computeFindings(f: ScanFacts): Finding[] {
  const out: Finding[] = [];
  const add = (x: Finding) => out.push(x);
  const s = f.settings || {};
  const cls = f.cpu?.class;

  // ---------- CPU / X3D ----------
  if (cls === 'x3d-dual') {
    if (f.cpu.vcacheDriver === false) add({ id: 'x3d-driver', severity: 'bad', area: 'cpu', title: '3D V-Cache Performance Optimizer is missing', detail: 'Without AMD\'s amd3dvcache driver, a dual-CCD X3D CPU cannot steer games onto the V-Cache CCD. Install the latest AMD chipset driver from amd.com, then reboot.', fix: { label: 'Open guide', page: 'guide' } });
    const name = (s.powerSchemeName || '').toLowerCase();
    if (s.powerScheme && s.powerScheme.toLowerCase() !== '381b4222-f694-41f0-9685-ff5bb260df2e') add({ id: 'x3d-plan', severity: 'bad', area: 'cpu', title: `Power plan "${s.powerSchemeName}" breaks CCD parking`, detail: 'Dual-CCD X3D chips need the stock Balanced plan so AMD\'s driver can park the frequency CCD while you game. High and Ultimate Performance keep all cores unparked and the game spills off the V-Cache.', fix: { label: 'Use tuned Balanced', tweakIds: ['x3d.dual-ccd-balanced-plan'] } });
    else if (name) add({ id: 'x3d-plan-ok', severity: 'good', area: 'cpu', title: 'Balanced plan active: CCD parking can work', detail: 'This is the plan AMD requires for V-Cache scheduling on dual-CCD parts.' });
    if (s.gameBarInstalled === false) add({ id: 'x3d-gamebar', severity: 'bad', area: 'cpu', title: 'Xbox Game Bar is not installed', detail: 'Dual-CCD X3D CPUs rely on Game Bar to recognise games. Reinstall "Xbox Game Bar" from the Microsoft Store.' });
  } else if (cls === 'x3d-single' || cls === 'ryzen' || cls === 'other') {
    if (s.powerSchemeName && s.powerSchemeName !== 'Tickrate Low Latency') add({ id: 'plan', severity: 'warn', area: 'cpu', title: `Power plan: ${s.powerSchemeName}`, detail: 'A tuned plan keeps cores unparked and stops USB and PCIe power saving from adding wake-up latency.', fix: { label: 'Apply low-latency plan', tweakIds: ['power.low-latency-plan'] } });
  }
  if (s.gameMode === 0) add({ id: 'gamemode', severity: cls === 'x3d-dual' ? 'bad' : 'warn', area: 'windows', title: 'Game Mode is off', detail: cls === 'x3d-dual' ? 'Game Mode is the trigger for CCD parking on your CPU. With it off, games run across both CCDs.' : 'Game Mode stops Windows Update and driver installs from running while you play.', fix: { label: 'Turn on', tweakIds: ['gaming.game-mode-on'] } });

  // ---------- Windows settings ----------
  if (s.gameDvr !== 0 || s.appCapture === 1) add({ id: 'dvr', severity: 'warn', area: 'windows', title: 'Background recording is on', detail: 'Game Bar keeps a rolling capture buffer in every game, using encoder time and VRAM.', fix: { label: 'Disable', tweakIds: ['gaming.game-dvr-off'] } });
  if (s.mouseSpeed && s.mouseSpeed !== '0') add({ id: 'accel', severity: 'warn', area: 'windows', title: 'Mouse acceleration is on', detail: '"Enhance pointer precision" makes menu and launcher aim inconsistent.', fix: { label: 'Disable', tweakIds: ['input.mouse-acceleration-off'] } });
  if (s.useplatformclock && /yes|true/i.test(s.useplatformclock)) add({ id: 'hpet', severity: 'bad', area: 'windows', title: 'HPET is forced in boot configuration', detail: 'useplatformclock forces every timer read through the slow HPET. This is usually left over from an old "optimizer".', fix: { label: 'Remove flag', tweakIds: ['sched.no-forced-hpet'] } });
  if (s.hags !== 2 && f.nvidia) add({ id: 'hags', severity: 'info', area: 'gpu', title: 'Hardware-accelerated GPU scheduling is off', detail: 'Required for DLSS Frame Generation and neutral-to-better for frame pacing on RTX cards.', fix: { label: 'Enable', tweakIds: ['gaming.hags-on'] } });
  if (s.fastStartup !== 0) add({ id: 'faststartup', severity: 'info', area: 'windows', title: 'Fast Startup is on', detail: 'Drivers resume from a hibernated state instead of starting fresh, which can carry glitches between sessions.', fix: { label: 'Disable', tweakIds: ['gaming.fast-startup-off'] } });

  // ---------- GPU ----------
  if (f.nvidia) {
    const widthMax = Number(f.nvidia.pcieWidthMax);
    if (widthMax && widthMax < 16) add({ id: 'pcie-width', severity: 'warn', area: 'gpu', title: `GPU link is x${widthMax}`, detail: 'The GPU can only negotiate fewer than 16 lanes. Check it is in the top x16 slot and that an M.2 drive is not sharing its lanes (see your motherboard manual).' });
    if (f.nvidia.rebar === false) add({ id: 'rebar', severity: 'info', area: 'gpu', title: 'Resizable BAR is off', detail: 'Enable "Above 4G decoding" and "Re-Size BAR support" in BIOS (CSM off). Small gains in some titles.', fix: { label: 'BIOS guide', page: 'guide' } });
    else if (f.nvidia.rebar) add({ id: 'rebar-ok', severity: 'good', area: 'gpu', title: 'Resizable BAR is on', detail: `BAR1 aperture ${f.nvidia.bar1MiB} MiB.` });
  }
  const nv = f.gpus?.find((g) => g.vendor === 'nvidia');
  if (nv?.driverDate) {
    const age = (Date.now() - new Date(nv.driverDate).getTime()) / DAY;
    if (age > 120) add({ id: 'driver-age', severity: 'warn', area: 'gpu', title: `NVIDIA driver is ${Math.round(age)} days old`, detail: 'New drivers regularly include Fortnite and VALORANT fixes and Reflex improvements. Update through the NVIDIA App or nvidia.com (clean install).' });
  }
  if (f.gpuMsi?.some((g) => !g.msi)) add({ id: 'msi', severity: 'warn', area: 'gpu', title: 'GPU is using line-based interrupts', detail: 'MSI mode lowers interrupt latency and avoids IRQ sharing.', fix: { label: 'Enable MSI', tweakIds: ['gpu.msi-mode'] } });
  if (nv && f.gpus?.some((g) => g.vendor === 'amd' && /Radeon\(TM\) Graphics|Radeon Graphics/i.test(g.name))) add({ id: 'igpu', severity: 'info', area: 'gpu', title: 'Integrated Radeon graphics is enabled', detail: 'Make sure every monitor is plugged into the NVIDIA card and that games are pinned to it. You can also disable the iGPU in BIOS.', fix: { label: 'Pin games to NVIDIA', tweakIds: ['games.gpu-preference'] } });

  // ---------- Memory ----------
  const m = f.memory || {};
  if (m.type === 'DDR5' && m.configuredMTs && m.configuredMTs <= 4800) add({ id: 'expo', severity: 'bad', area: 'memory', title: `RAM running at ${m.configuredMTs} MT/s (EXPO is off)`, detail: `Your kit is rated for ${m.ratedMTs ?? 'more'} MT/s. Enable EXPO (or XMP) in BIOS. For Ryzen 7000/9000, DDR5-6000 with FCLK 2000 is the sweet spot.`, fix: { label: 'BIOS guide', page: 'guide' } });
  else if (m.type === 'DDR4' && m.configuredMTs && m.configuredMTs <= 2666) add({ id: 'xmp', severity: 'bad', area: 'memory', title: `RAM running at ${m.configuredMTs} MT/s (XMP is off)`, detail: 'Enable XMP/DOCP in BIOS. For Ryzen 5000, DDR4-3600 with FCLK 1800 is the sweet spot.', fix: { label: 'BIOS guide', page: 'guide' } });
  else if (m.configuredMTs) add({ id: 'ram-ok', severity: 'good', area: 'memory', title: `Memory at ${m.configuredMTs} MT/s`, detail: `${m.totalGB} GB ${m.type ?? ''} across ${m.modules} modules.` });
  if (m.modules === 1) add({ id: 'single-channel', severity: 'bad', area: 'memory', title: 'Single memory stick: single channel', detail: 'One DIMM halves memory bandwidth. Two matched sticks in the slots your manual marks as primary (usually A2/B2) make a large difference in 1% lows.' });
  if (m.totalGB && m.totalGB < 16) add({ id: 'ram-size', severity: 'warn', area: 'memory', title: `${m.totalGB} GB RAM`, detail: 'Fortnite alone can use 10+ GB. 32 GB is the comfortable target with Discord and a browser open.' });

  // ---------- Displays ----------
  for (const d of f.displays || []) {
    if (d.maxRefresh > d.refresh + 1) add({ id: `hz-${d.device}`, severity: d.primary ? 'bad' : 'info', area: 'display', title: `${d.primary ? 'Main display' : 'Second display'} runs at ${d.refresh} Hz but supports ${d.maxRefresh} Hz`, detail: `Settings > Display > Advanced display > Choose a refresh rate. Use DisplayPort for high refresh rates where possible. (${d.width}x${d.height})`, fix: { label: 'Open display settings', url: 'ms-settings:display-advanced' } });
  }

  // ---------- Anti-cheat readiness ----------
  const sec = f.security || {};
  if (sec.secureBoot === false) add({ id: 'secureboot', severity: 'warn', area: 'security', title: 'Secure Boot is off', detail: 'VALORANT on Windows 11 and Fortnite PC tournaments check for Secure Boot. Enable it in BIOS (UEFI mode, CSM off).' });
  if (sec.tpm && !sec.tpm.ready) add({ id: 'tpm', severity: 'warn', area: 'security', title: 'TPM 2.0 is not ready', detail: 'Enable AMD fTPM in BIOS. It is required by Vanguard on Windows 11 and checked by Fortnite tournaments.' });
  if (sec.hvciRunning === false) add({ id: 'hvci', severity: 'info', area: 'security', title: 'Memory Integrity (HVCI) is off', detail: 'VALORANT\'s Vanguard On-Demand mode needs VBS + HVCI. Without them, Vanguard runs in always-on mode.' });
  if (sec.bitlocker) add({ id: 'bitlocker', severity: 'info', area: 'security', title: 'BitLocker is on', detail: 'Boot-configuration tweaks (HPET flag, dynamic tick) can make Windows ask for your recovery key once. Have it ready (aka.ms/myrecoverykey).' });

  // ---------- Windows / storage / software ----------
  const os = f.os || {};
  if (os.build && os.build < 26100) add({ id: 'winver', severity: 'warn', area: 'windows', title: `Windows build ${os.build}`, detail: 'Windows 11 24H2 (26100) and later include scheduler and branch-prediction improvements for Zen 4/Zen 5 and better X3D handling.' });
  if (os.pendingReboot) add({ id: 'reboot', severity: 'warn', area: 'windows', title: 'A restart is pending', detail: 'Windows has updates or file operations waiting for a reboot. Pending updates can install in the background mid-session.' });
  if (os.uptimeHours && os.uptimeHours > 96) add({ id: 'uptime', severity: 'info', area: 'windows', title: `Up for ${Math.round(os.uptimeHours / 24)} days`, detail: 'A fresh boot before a session clears leaked memory and stuck background tasks.' });
  const st = f.storage || {};
  if (st.systemFreeGB !== undefined && st.systemTotalGB && (st.systemFreeGB < 30 || st.systemFreeGB / st.systemTotalGB < 0.1)) add({ id: 'disk', severity: 'warn', area: 'storage', title: `Only ${st.systemFreeGB} GB free on the system drive`, detail: 'SSDs slow down when nearly full, and Fortnite updates need tens of GB of scratch space.', fix: { label: 'Clean up', page: 'cleanup' } });
  if (st.disks?.some((d) => d.media === 'HDD')) add({ id: 'hdd', severity: 'info', area: 'storage', title: 'A hard drive is installed', detail: 'Keep Fortnite and VALORANT on an NVMe SSD. Texture streaming from an HDD causes pop-in and hitches.' });
  const sw = f.software || {};
  if ((sw.startupCount ?? 0) > 8) add({ id: 'startup', severity: 'warn', area: 'software', title: `${sw.startupCount} apps start with Windows`, detail: 'Every launcher and tray app competes for CPU and RAM. Disable what you do not need at boot.', fix: { label: 'Startup apps', page: 'debloat' } });
  if (sw.backgroundApps?.length) add({ id: 'bgapps', severity: 'info', area: 'software', title: `${sw.backgroundApps.length} known background apps running`, detail: `${sw.backgroundApps.join(', ')}. Close RGB and vendor control suites while playing. Several of them poll hardware and cause DPC spikes.` });
  const g = f.games || {};
  if (!g.fortnite?.installed && !g.valorant?.installed) add({ id: 'games', severity: 'info', area: 'software', title: 'Fortnite / VALORANT not found', detail: 'Per-game tweaks (GPU preference, scanning exclusions, compatibility flags) need the game installed in a standard location.' });

  const order = { bad: 0, warn: 1, info: 2, good: 3 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function isApplicable(t: { cpu?: string[] }, cpuClass: string | undefined) {
  return !t.cpu || !cpuClass || t.cpu.includes(cpuClass);
}

export function computeScore(findings: Finding[], catalog: Catalog | null, statuses: Record<string, TweakStatus>, cpuClass?: string) {
  let health = 100;
  for (const f of findings) health -= f.severity === 'bad' ? 12 : f.severity === 'warn' ? 5 : f.severity === 'info' ? 1 : 0;
  health = Math.max(0, Math.min(100, health));
  const target = (catalog?.tweaks || []).filter((t) => t.presets.includes('competitive') && isApplicable(t, cpuClass) && statuses[t.id]?.status !== 'na');
  const done = target.filter((t) => statuses[t.id]?.status === 'applied').length;
  const coverage = target.length ? (done / target.length) * 100 : 0;
  return { score: Math.round(health * 0.55 + coverage * 0.45), health, coverage: Math.round(coverage), done, total: target.length };
}
