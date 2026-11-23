'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const catalog = require('../electron/catalog/index.cjs');

const IMPACT = new Set(['high', 'medium', 'low']);
const RISK = new Set(['safe', 'moderate', 'advanced']);
const EVIDENCE = new Set(['proven', 'situational', 'minor']);
const REBOOT = new Set(['none', 'signout', 'restart']);
const CPU = new Set(['x3d-dual', 'x3d-single', 'ryzen', 'other']);
const REG_KINDS = new Set(['DWord', 'QWord', 'String', 'ExpandString', 'MultiString', 'Binary']);

test('tweak ids are unique and well-formed', () => {
  const seen = new Set();
  for (const t of catalog.tweaks) {
    assert.match(t.id, /^[a-z0-9]+\.[a-z0-9-]+$/, t.id);
    assert.ok(!seen.has(t.id), `duplicate id ${t.id}`);
    seen.add(t.id);
  }
});

test('every tweak has metadata and a real description', () => {
  const cats = new Set(catalog.categories.map((c) => c.id));
  const presets = new Set(catalog.presets.map((p) => p.id));
  for (const t of catalog.tweaks) {
    assert.ok(cats.has(t.category), `${t.id}: unknown category ${t.category}`);
    assert.ok(IMPACT.has(t.impact), `${t.id}: impact`);
    assert.ok(RISK.has(t.risk), `${t.id}: risk`);
    assert.ok(EVIDENCE.has(t.evidence), `${t.id}: evidence`);
    assert.ok(REBOOT.has(t.reboot), `${t.id}: reboot`);
    assert.ok(t.title && t.title.length <= 70, `${t.id}: title`);
    assert.ok(t.summary && t.summary.length >= 30, `${t.id}: summary too short`);
    assert.ok(t.description && t.description.length >= 150, `${t.id}: description too short`);
    assert.ok(Array.isArray(t.presets), `${t.id}: presets`);
    for (const p of t.presets) assert.ok(presets.has(p), `${t.id}: preset ${p}`);
    if (t.cpu) for (const c of t.cpu) assert.ok(CPU.has(c), `${t.id}: cpu ${c}`);
    // presets must be cumulative: essential => competitive => extreme
    if (t.presets.includes('essential')) assert.ok(t.presets.includes('competitive') && t.presets.includes('extreme'), `${t.id}: essential must be in all presets`);
    if (t.presets.includes('competitive')) assert.ok(t.presets.includes('extreme'), `${t.id}: competitive must be in extreme`);
    // advanced tweaks never go into the essential preset
    if (t.risk !== 'safe') assert.ok(!t.presets.includes('essential'), `${t.id}: non-safe tweak in essential`);
    assert.ok(t.ops.length > 0, `${t.id}: no ops`);
  }
});

test('operations are valid', () => {
  for (const t of catalog.tweaks) {
    for (const op of t.ops) {
      switch (op.op) {
        case 'reg':
          assert.match(op.path, /^(HKLM|HKCU)\\/, `${t.id}: reg path`);
          assert.ok(op.name !== undefined, `${t.id}: reg name`);
          if (!op.delete) {
            assert.ok(REG_KINDS.has(op.type), `${t.id}: reg type ${op.type}`);
            assert.ok(op.value !== undefined && op.value !== null, `${t.id}: reg value`);
            if (op.type === 'DWord') assert.ok(Number.isInteger(op.value) && op.value >= 0 && op.value <= 0xffffffff, `${t.id}: dword range`);
            if (op.type === 'String') assert.equal(typeof op.value, 'string', `${t.id}: string value`);
          }
          break;
        case 'service':
          assert.ok(['Automatic', 'Manual', 'Disabled'].includes(op.start), `${t.id}: service start`);
          break;
        case 'task':
          assert.match(op.path, /^\\.*\\$/, `${t.id}: task path must start and end with \\`);
          break;
        case 'bcd':
          assert.match(op.key, /^[a-z]+$/, `${t.id}: bcd key`);
          break;
        case 'ps':
          assert.ok(op.apply !== undefined && op.revert !== undefined, `${t.id}: ps needs apply and revert`);
          break;
        default:
          assert.fail(`${t.id}: unknown op ${op.op}`);
      }
    }
  }
});

test('every preset has a sensible size', () => {
  for (const p of catalog.presets) {
    const n = catalog.tweaks.filter((t) => t.presets.includes(p.id)).length;
    assert.ok(n >= 10, `${p.id} has only ${n} tweaks`);
  }
});

test('nvidia settings have unique ids and valid defaults', () => {
  const ids = new Set();
  for (const s of catalog.nvidiaSettings) {
    assert.ok(!ids.has(s.id), `duplicate ${s.name}`);
    ids.add(s.id);
    assert.ok(s.options.some((o) => o.value === s.recommended), `${s.key}: recommended not an option`);
    assert.ok(s.id > 0 && s.id <= 0xffffffff);
    assert.ok(s.description.length > 60, `${s.key}: description`);
  }
});

function findPwsh() {
  const candidates = [process.env.PWSH, 'pwsh', 'powershell.exe'].filter(Boolean);
  for (const c of candidates) {
    const r = spawnSync(c, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  return null;
}

test('embedded PowerShell snippets parse', { skip: !findPwsh() && 'PowerShell not available' }, () => {
  const pwsh = findPwsh();
  const snippets = [];
  for (const t of catalog.tweaks) {
    if (t.guard) snippets.push({ where: `${t.id}.guard`, code: t.guard });
    t.ops.forEach((op, i) => {
      if (op.op !== 'ps') return;
      for (const k of ['apply', 'revert', 'detect']) if (op[k]) snippets.push({ where: `${t.id}.ops[${i}].${k}`, code: op[k] });
    });
  }
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tr-')), 'snippets.json');
  fs.writeFileSync(file, JSON.stringify(snippets));
  const script = `
$items = Get-Content -Raw '${file}' | ConvertFrom-Json
$bad = @()
foreach ($s in $items) {
  $t = $null; $e = $null
  [void][System.Management.Automation.Language.Parser]::ParseInput($s.code, [ref]$t, [ref]$e)
  foreach ($x in $e) { $bad += "$($s.where): line $($x.Extent.StartLineNumber): $($x.Message)" }
}
$bad -join [Environment]::NewLine`;
  const r = spawnSync(pwsh, ['-NoProfile', '-Command', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '', `PowerShell parse errors:\n${r.stdout}`);
  assert.ok(snippets.length > 20);
});
