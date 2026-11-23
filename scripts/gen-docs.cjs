'use strict';
// Generates docs/TWEAKS.md from the catalog so the documentation can never drift from the code.
const fs = require('node:fs');
const path = require('node:path');
const c = require('../electron/catalog/index.cjs');

const CPU = { 'x3d-dual': 'dual-CCD X3D', 'x3d-single': 'single-CCD X3D', ryzen: 'other Ryzen', other: 'non-AMD' };
const REBOOT = { none: 'none', signout: 'sign out', restart: 'restart' };
const EVIDENCE = { proven: 'measurable', situational: 'situational', minor: 'quality of life' };

function op(o) {
  switch (o.op) {
    case 'reg': return o.delete ? `- Registry \`${o.path}\` → \`${o.name}\` removed` : `- Registry \`${o.path}\` → \`${o.name}\` = \`${typeof o.value === 'number' && o.value > 9 ? `0x${o.value.toString(16)}` : JSON.stringify(o.value)}\` (${o.type})`;
    case 'service': return `- Service \`${o.name}\` → ${o.start}`;
    case 'task': return `- Scheduled task \`${o.path}${o.name}\` → ${o.state}`;
    case 'bcd': return `- Boot config \`${o.key}\` → ${o.value === null ? 'removed' : `\`${o.value}\``}`;
    case 'ps': return o.apply.trim() || o.detect.trim() ? '- PowerShell (see `electron/catalog/` for the exact script, with apply / revert / detect)' : '- Restarts the related service on revert';
    default: return '';
  }
}

let md = `# Tweak reference\n\n> Generated from \`electron/catalog/\` by \`npm run docs\`. Do not edit by hand.\n\n`;
md += `${c.tweaks.length} tweaks in ${c.categories.length} categories. Every change is backed up before it is made and can be reverted individually.\n\n`;
md += `**Impact** is the expected effect on input latency or frame pacing. **Risk** describes the trade-off: *safe* has none worth mentioning, *moderate* has a documented trade-off, *advanced* needs care. **Evidence** says how solid the case for the tweak is.\n\n`;
md += `| Preset | Tweaks |\n|---|---|\n` + c.presets.map((p) => `| ${p.label} | ${c.tweaks.filter((t) => t.presets.includes(p.id)).length} |`).join('\n') + '\n\n';
md += `## Contents\n\n` + c.categories.map((k) => `- [${k.label}](#${k.label.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-')})`).join('\n') + `\n- [Left out on purpose](#left-out-on-purpose)\n\n`;

for (const k of c.categories) {
  const list = c.tweaks.filter((t) => t.category === k.id);
  if (!list.length) continue;
  md += `## ${k.label}\n\n${k.blurb}\n\n`;
  for (const t of list) {
    md += `### ${t.title}\n\n`;
    md += `\`${t.id}\` · impact **${t.impact}** · risk **${t.risk}** · evidence *${EVIDENCE[t.evidence]}* · after applying: ${REBOOT[t.reboot]}`;
    md += ` · presets: ${t.presets.length ? t.presets.map((p) => c.presets.find((x) => x.id === p).label).join(', ') : 'none (manual only)'}`;
    if (t.cpu) md += ` · CPUs: ${t.cpu.map((x) => CPU[x]).join(', ')}`;
    md += `\n\n${t.description}\n\n`;
    if (t.warning) md += `> **Note:** ${t.warning}\n\n`;
    md += `What changes:\n\n${t.ops.map(op).join('\n')}\n\n`;
  }
}
md += `## Left out on purpose\n\nThese show up in other optimizers. Tickrate does not apply them, for the reasons below.\n\n`;
md += c.excluded.map((e) => `- **${e.title}**: ${e.reason}`).join('\n') + '\n\n';
md += `## NVIDIA driver profile settings\n\nApplied to the Base Profile through NVIDIA Profile Inspector from the NVIDIA page.\n\n| Setting | Setting ID | Tickrate default | Why |\n|---|---|---|---|\n`;
md += c.nvidiaSettings.map((s) => `| ${s.label} | \`0x${s.id.toString(16).padStart(8, '0')}\` | ${s.options.find((o) => o.value === s.recommended).label} | ${s.description} |`).join('\n') + '\n';

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'TWEAKS.md'), md);
console.log(`docs/TWEAKS.md: ${c.tweaks.length} tweaks`);
