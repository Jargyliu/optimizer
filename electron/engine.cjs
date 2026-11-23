'use strict';
// Runs engine/Engine.ps1 with Windows PowerShell 5.1 and returns its JSON result.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// Actions that change system state are serialized so state.json is never written concurrently.
const MUTATING = new Set([
  'tweaks.apply', 'tweaks.revert', 'cleanup.run', 'restore.create', 'startup.set', 'apps.remove',
  'maint.run', 'power.activate', 'nvidia.install', 'nvidia.apply', 'nvidia.revert', 'nvidia.read',
]);

class Engine {
  constructor({ engineDir, onLog }) {
    this.engineDir = engineDir;
    this.onLog = onLog || (() => {});
    this.queue = Promise.resolve();
    this.tmpDir = path.join(os.tmpdir(), 'tickrate');
    fs.mkdirSync(this.tmpDir, { recursive: true });
  }

  call(action, payload = {}) {
    if (!MUTATING.has(action)) return this.#run(action, payload);
    const next = this.queue.then(() => this.#run(action, payload));
    this.queue = next.catch(() => {});
    return next;
  }

  #run(action, payload) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const reqFile = path.join(this.tmpDir, `req-${id}.json`);
      const resFile = path.join(this.tmpDir, `res-${id}.json`);
      fs.writeFileSync(reqFile, JSON.stringify({ action, payload }), 'utf8');

      const script = path.join(this.engineDir, 'Engine.ps1');
      const child = spawn(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Request', reqFile, '-Response', resFile],
        { windowsHide: true },
      );

      let buffer = '';
      const flush = (chunk, isErr) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('@@LOG ')) this.onLog({ action, level: 'info', message: line.slice(6) });
          else this.onLog({ action, level: isErr ? 'error' : 'debug', message: line });
        }
      };
      child.stdout.on('data', (c) => flush(c, false));
      child.stderr.on('data', (c) => flush(c, true));

      child.on('error', (err) => {
        cleanup();
        reject(new Error(`Could not start PowerShell: ${err.message}`));
      });
      child.on('close', (code) => {
        if (buffer.trim()) flush('\n', false);
        let result;
        try {
          result = JSON.parse(fs.readFileSync(resFile, 'utf8').replace(/^﻿/, ''));
        } catch {
          cleanup();
          return reject(new Error(`Engine exited with code ${code} and no result for '${action}'.`));
        }
        cleanup();
        if (result.ok) resolve(result.data);
        else reject(new Error(result.error || `Engine action '${action}' failed.`));
      });

      function cleanup() {
        for (const f of [reqFile, resFile]) fs.rm(f, { force: true }, () => {});
      }
    });
  }
}

module.exports = { Engine, MUTATING };
