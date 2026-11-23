import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { PageHeader, Panel, cx, spring } from '../components/ui';

type Row = [setting: string, value: string, why: string];
const SECTIONS: { id: string; label: string; intro: string; rows: Row[] }[] = [
  {
    id: 'bios', label: 'BIOS (AM5 / AM4)',
    intro: 'Settings Windows cannot change. Names vary by board vendor (ASUS, MSI, Gigabyte, ASRock), so use your manual. Update the BIOS first: AGESA updates regularly improve X3D scheduling and memory stability.',
    rows: [
      ['EXPO / XMP', 'Enabled (EXPO I)', 'Without it DDR5 runs at 4800 MT/s and DDR4 at 2133-2666. On AM5, DDR5-6000 CL30 with FCLK 2000 and UCLK = MCLK (1:1) is the sweet spot. On AM4, DDR4-3600 CL16 with FCLK 1800.'],
      ['CPPC & CPPC Preferred Cores', 'Enabled', 'Lets Windows place threads on the fastest cores. Dual-CCD X3D only: set "CPPC Dynamic Preferred Cores" to Driver (or Auto) so AMD\'s V-Cache driver can choose the CCD.'],
      ['Global C-state Control', 'Enabled / Auto', 'Do not disable it on X3D. Idle states keep temperatures down, and X3D boost clocks are temperature-limited.'],
      ['Curve Optimizer (PBO)', 'Negative offset, tested', 'Ryzen 9000X3D supports full PBO. 7000X3D and 5800X3D support Curve Optimizer only. A modest all-core negative offset (start around -15) lowers voltage and temperature, so the chip boosts higher for longer. Stress-test (OCCT, CoreCycler) before trusting it.'],
      ['Above 4G Decoding + Re-Size BAR', 'Enabled', 'Turns on Resizable BAR for the GPU. Requires CSM disabled (UEFI boot).'],
      ['CSM', 'Disabled', 'Needed for Resizable BAR and Secure Boot.'],
      ['Secure Boot + AMD fTPM', 'Enabled', 'VALORANT (Vanguard) on Windows 11 requires TPM 2.0 and Secure Boot, and Fortnite PC tournaments check for them.'],
      ['SVM (virtualization) & IOMMU', 'Enabled', 'Older guides say to disable these. In 2026 they are needed for VBS/HVCI, which Vanguard On-Demand and Fortnite tournament checks use, and the latency cost on Zen 4/5 is negligible.'],
      ['Integrated graphics', 'Disabled (if unused)', 'Frees system RAM reserved for the iGPU and stops Windows picking the wrong adapter. Leave it on if you use it for a second screen or for stream encoding.'],
    ],
  },
  {
    id: 'fortnite', label: 'Fortnite',
    intro: 'Settings > Video in Fortnite. Values aimed at the lowest input latency and most stable frame times in competitive play.',
    rows: [
      ['Window mode', 'Fullscreen', 'Lowest latency path with the fewest compositor surprises.'],
      ['Rendering mode', 'Performance (or DirectX 12)', 'Performance mode has the lowest CPU and GPU cost and the highest FPS. DX12 looks better. On a fast X3D + RTX system both reach very high FPS, so pick based on stability in your build.'],
      ['NVIDIA Reflex Low Latency', 'On + Boost', 'Keeps the render queue empty. The largest single latency reduction in the game.'],
      ['V-Sync', 'Off', 'With G-SYNC, V-Sync is set in the NVIDIA profile instead.'],
      ['Frame rate limit', 'Unlimited, or your refresh rate', 'With Reflex + G-SYNC, Reflex caps automatically just under refresh. Otherwise cap at a value your PC holds steadily.'],
      ['Motion blur', 'Off', 'Hides detail during flicks and edits.'],
      ['Multithreaded rendering (DX11)', 'On', 'Spreads draw-call work across cores.'],
      ['Shader compilation', 'Let it finish in the lobby', 'After an update or a shader-cache clear, wait for "Compiling shaders" to complete before queuing to avoid first-match stutter.'],
    ],
  },
  {
    id: 'valorant', label: 'VALORANT',
    intro: 'Settings > Video. VALORANT is extremely CPU-bound at high FPS, which is where X3D CPUs shine. These keep the CPU path short.',
    rows: [
      ['Display mode', 'Fullscreen', 'Lowest latency, and VALORANT behaves best in true fullscreen.'],
      ['NVIDIA Reflex Low Latency', 'On + Boost', 'Removes render-queue latency.'],
      ['Limit FPS', 'Off (Reflex) or a high, stable cap', 'With Reflex + G-SYNC Reflex caps automatically. Without G-SYNC an uncapped frame rate gives the lowest latency if frame times stay stable.'],
      ['Multithreaded rendering', 'On', 'Large CPU win on 8+ core CPUs.'],
      ['Material / Texture / Detail quality', 'Low / Low-Med / Low', 'Less clutter, higher FPS. Textures can be higher with enough VRAM.'],
      ['Vignette, Bloom, Distortion, Cast shadows', 'Off', 'Visual effects with a CPU and GPU cost and no competitive benefit.'],
      ['Raw input buffer', 'On', 'Reads the mouse directly from the raw input queue. Helps at 2-8 kHz polling. Turn it off if the mouse ever feels inconsistent.'],
      ['V-Sync', 'Off', 'With G-SYNC, V-Sync is set in the NVIDIA profile instead.'],
    ],
  },
  {
    id: 'gear', label: 'Mouse & monitor',
    intro: 'Hardware choices that often matter more than any registry tweak.',
    rows: [
      ['Mouse polling rate', '1000-4000 Hz', 'Higher is lower latency. 8000 Hz costs noticeable CPU time per frame. If VALORANT stutters at 8K, drop to 4K.'],
      ['Mouse USB port', 'Rear I/O, directly', 'Use a port on the motherboard (ideally CPU-connected), not a hub, front-panel header or monitor USB.'],
      ['Monitor cable', 'DisplayPort, into the GPU', 'Needed for high refresh rates and G-SYNC. Never plug the game monitor into the motherboard.'],
      ['Refresh rate', 'Maximum', 'Windows sometimes defaults to 60 Hz after driver updates. The scanner checks this.'],
      ['Overdrive', 'Fastest level without overshoot', 'The highest overdrive often adds inverse ghosting. Check with a UFO test.'],
      ['RGB & vendor suites', 'Close while playing', 'iCUE, Armoury Crate, Synapse and similar suites poll hardware constantly and are a common source of DPC spikes.'],
    ],
  },
  {
    id: 'measure', label: 'Measure it',
    intro: 'Change one thing at a time and measure, because "feels smoother" is easy to imagine. Free tools that give real numbers:',
    rows: [
      ['NVIDIA FrameView / overlay', 'PC Latency', 'Shows end-to-end system latency in Reflex games, including Fortnite and VALORANT.'],
      ['CapFrameX or PresentMon', 'Frame times, 1% / 0.1% lows', 'Average FPS hides stutter. Compare 1% lows before and after a change, over the same replay or route.'],
      ['LatencyMon', 'DPC / ISR latency', 'Finds drivers that stall the CPU (network, audio, RGB, storage). Run it for 10 minutes while idle and while playing.'],
      ['Same test, three runs', 'Average them', 'Run-to-run variance in Fortnite is often larger than the effect of a single tweak.'],
    ],
  },
];

export function Guide() {
  const { scan } = useStore();
  const [tab, setTab] = useState('bios');
  const s = SECTIONS.find((x) => x.id === tab)!;
  return (
    <>
      <PageHeader eyebrow={scan?.cpu?.name ? `Written for ${scan.cpu.name.replace(/ \d+-Core Processor/, '')}` : 'Reference'} title="BIOS & game guide">
        The settings Tickrate cannot change for you, and how to check that your changes actually helped.
      </PageHeader>
      <div className="mb-5 flex gap-1 border-b hairline">
        {SECTIONS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={cx('relative px-3.5 pb-3 pt-1 text-[13px]', tab === x.id ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
            {x.label}
            {tab === x.id && <motion.span layoutId="guide-tab" transition={spring} className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <p className="mb-4 max-w-[75ch] text-[13px] leading-relaxed text-fg-muted">{s.intro}</p>
        <Panel>
          <ul className="divide-y divide-white/[0.05]">
            {s.rows.map(([k, v, why]) => (
              <li key={k} className="grid grid-cols-[minmax(180px,1fr)_minmax(150px,0.8fr)_2.2fr] gap-6 px-5 py-3.5">
                <span className="text-[13px] font-medium">{k}</span>
                <span className="num text-[12.5px] text-accent">{v}</span>
                <span className="text-[12.5px] leading-relaxed text-fg-muted">{why}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </motion.div>
    </>
  );
}
