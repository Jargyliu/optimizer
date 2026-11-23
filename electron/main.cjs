'use strict';
const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const catalog = require('./catalog/index.cjs');
const { Engine, MUTATING } = require('./engine.cjs');

const isWindows = process.platform === 'win32';
const devUrl = process.env.VITE_DEV_SERVER_URL;
const engineDir = app.isPackaged ? path.join(process.resourcesPath, 'engine') : path.join(__dirname, '..', 'engine');
const dataRoot = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Tickrate');

let win = null;
let ctx = { games: {}, cpuClass: 'other' };
let restorePointThisSession = false;
let ctxLoaded = false;

// ---------------- settings ----------------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaultSettings = { autoRestorePoint: true, monitorType: null };
function readSettings() {
  try { return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { return { ...defaultSettings }; }
}
function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  return next;
}

// ---------------- logging ----------------
function log(entry) {
  const line = { time: new Date().toISOString(), ...entry };
  if (win && !win.isDestroyed()) win.webContents.send('engine:log', line);
  try {
    const dir = path.join(dataRoot, 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `${line.time.slice(0, 10)}.log`), `${line.time} [${line.level}] ${line.action || ''} ${line.message}\n`);
  } catch { /* logging must never break the app */ }
}

const engine = new Engine({ engineDir, onLog: log });

// ---------------- engine bridge ----------------
const ALLOWED = new Set([
  'ping', 'tweaks.detect', 'tweaks.apply', 'tweaks.revert', 'state.get', 'scan', 'games.detect',
  'cleanup.analyze', 'cleanup.run', 'restore.status', 'restore.create', 'restore.open',
  'startup.list', 'startup.set', 'apps.list', 'apps.remove', 'maint.run', 'power.list', 'power.activate',
  'nvidia.status', 'nvidia.install', 'nvidia.read', 'nvidia.apply', 'nvidia.revert',
]);
const NEEDS_RESTORE_POINT = new Set(['tweaks.apply', 'apps.remove', 'nvidia.apply']);
const tweakById = new Map(catalog.tweaks.map((t) => [t.id, t]));

async function ensureRestorePoint(reason) {
  if (restorePointThisSession || !readSettings().autoRestorePoint) return;
  log({ action: 'restore.create', level: 'info', message: `Creating a restore point before: ${reason}` });
  try {
    await engine.call('restore.create', { description: `Tickrate - before ${reason}`, enableIfOff: true });
    restorePointThisSession = true;
  } catch (err) {
    // Do not block the change, but make the failure loud.
    log({ action: 'restore.create', level: 'error', message: `Restore point failed: ${err.message}. Tickrate's own per-tweak backups still allow reverting.` });
  }
}

async function callEngine(action, payload = {}) {
  if (!ALLOWED.has(action)) throw new Error(`Action '${action}' is not allowed.`);
  if (!isWindows) throw new Error('Tickrate only runs on Windows.');

  let body = payload;
  if (action.startsWith('tweaks.')) {
    // Game paths are needed by per-game tweaks; detect them once if no scan has run yet.
    if (!ctxLoaded) {
      try { ctx = { ...ctx, games: await engine.call('games.detect', {}) }; ctxLoaded = true; } catch { /* per-game tweaks report n/a */ }
    }
    // The renderer only sends ids; operations always come from the bundled catalog.
    const ids = Array.isArray(payload.ids) ? payload.ids : catalog.tweaks.map((t) => t.id);
    const tweaks = ids.map((id) => tweakById.get(id)).filter(Boolean);
    body = { tweaks, ctx };
  }
  if (action === 'nvidia.apply') {
    const byKey = new Map(catalog.nvidiaSettings.map((s) => [s.key, s]));
    body = {
      settings: (payload.settings || []).filter((s) => byKey.has(s.key)).map((s) => {
        const def = byKey.get(s.key);
        if (!def.options.some((o) => o.value === s.value)) throw new Error(`Invalid value for ${def.label}`);
        return { id: def.id, name: def.name, value: s.value, default: def.default };
      }),
    };
  }
  if (NEEDS_RESTORE_POINT.has(action)) await ensureRestorePoint(action === 'tweaks.apply' ? 'applying tweaks' : action === 'apps.remove' ? 'removing apps' : 'changing NVIDIA profile');

  const data = await engine.call(action, body);
  if (action === 'scan') {
    ctx = { games: data.games || {}, cpuClass: data.cpu?.class || 'other' };
    ctxLoaded = true;
  } else if (action === 'games.detect') {
    ctx = { ...ctx, games: data };
    ctxLoaded = true;
  } else if (action === 'restore.create') {
    restorePointThisSession = true;
  }
  return data;
}

// ---------------- IPC ----------------
function registerIpc() {
  ipcMain.handle('catalog:get', () => ({ ...catalog, version: app.getVersion() }));
  ipcMain.handle('engine:call', async (_e, action, payload) => {
    try {
      return { ok: true, data: await callEngine(action, payload) };
    } catch (err) {
      log({ action, level: 'error', message: err.message });
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_e, patch) => writeSettings(patch || {}));
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dataRoot, mutating: [...MUTATING] }));
  ipcMain.handle('shell:openExternal', (_e, url) => {
    if (typeof url === 'string' && /^(https:|ms-settings:|ms-windows-store:)/.test(url)) return shell.openExternal(url);
    return false;
  });
  ipcMain.handle('shell:openDataFolder', () => shell.openPath(dataRoot));
}

function createWindow() {
  nativeTheme.themeSource = 'dark';
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0c0d0f',
    show: false,
    title: 'Tickrate',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0c0d0f', symbolColor: '#a1a1aa', height: 40 },
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  // Renderer errors and crashes go to the log file so problems can be diagnosed after the fact.
  win.webContents.on('console-message', (event, level, message) => {
    const lvl = typeof event === 'object' && event && 'level' in event ? event.level : level;
    const msg = typeof event === 'object' && event && 'message' in event ? event.message : message;
    if (lvl === 3 || lvl === 'error') log({ action: 'ui', level: 'error', message: String(msg) });
  });
  win.webContents.on('render-process-gone', (_e, details) => log({ action: 'ui', level: 'error', message: `Renderer process gone: ${details.reason} (exit ${details.exitCode})` }));
  win.webContents.on('did-fail-load', (_e, code, desc) => log({ action: 'ui', level: 'error', message: `Failed to load UI: ${desc} (${code})` }));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
