'use strict';
// Writes the tweak catalog as JSON (used by the Windows engine tests and for auditing).
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../electron/catalog/index.cjs');
const out = process.argv[2] || path.join(__dirname, '..', 'build', 'catalog.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(catalog, null, 2));
console.log(`catalog: ${catalog.tweaks.length} tweaks -> ${out}`);
