/* SAKURA PANEL — Electron main process (Windows shell integration). */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, screen, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { ColorEngine } = require('./color/engine');
const { runSelfTest } = require('./color/selftest');
const win32Backend = require('./color/win32');

const SELFTEST = process.argv.includes('--selftest');

const ROOT = path.join(__dirname, '..');
const ICON_APP = path.join(ROOT, 'assets/icons/sakura-panel.ico');
const ICON_TASKBAR = path.join(ROOT, 'assets/icons/taskbar.ico');
const ICON_TRAY = path.join(ROOT, 'assets/icons/taskbar-icon-32.png');
const TITLEBAR_H = 40;

const stateFile = (name) => path.join(app.getPath('userData'), name);
function readJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(stateFile(name), 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(name, data) {
  try { fs.writeFileSync(stateFile(name), JSON.stringify(data)); } catch (e) { /* non-fatal */ }
}

// Taskbar grouping + correct icon for pinned shortcuts.
app.setAppUserModelId('com.sakurapanel.app');

/* ---------------- display colour engine ---------------- */
let engine = null;
let exitPolicy = 'restore';
let shutDown = false;

function startWatchdog(dataDir) {
  // Same binary in Node mode: restores original colours if this process dies unexpectedly.
  try {
    const child = spawn(process.execPath, [path.join(__dirname, 'color', 'watchdog.js'), String(process.pid), dataDir], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, detached: true, stdio: 'ignore', windowsHide: true,
    });
    child.unref();
  } catch (e) { console.error('[color] watchdog failed to start:', e.message); }
}

function startColorEngine({ watchdog = true } = {}) {
  const dataDir = path.join(app.getPath('userData'), 'color');
  engine = new ColorEngine({ backend: win32Backend.create(), dataDir });
  const init = engine.init();
  if (!init.supported) { console.warn('[color]', init.reason); return engine; }
  if (watchdog) startWatchdog(dataDir);
  engine.apply(engine.loadConfig(), { verify: true, force: true }); // restore the saved adjustments at launch

  let t = null;
  const onDisplayChange = (why) => { clearTimeout(t); t = setTimeout(() => { const r = engine.handleDisplayChange(); if (r) console.log('[color] re-applied after', why); }, 400); };
  screen.on('display-added', () => onDisplayChange('display-added'));
  screen.on('display-removed', () => onDisplayChange('display-removed'));
  screen.on('display-metrics-changed', (_e, _d, changed) => { if (changed.some((c) => c === 'bounds' || c === 'rotation' || c === 'scaleFactor')) onDisplayChange('mode change'); });
  powerMonitor.on('resume', () => onDisplayChange('resume'));
  powerMonitor.on('unlock-screen', () => onDisplayChange('unlock'));
  return engine;
}

function shutdownColorEngine() {
  if (shutDown || !engine) return;
  shutDown = true;
  try { engine.shutdown(exitPolicy); } catch (e) { console.error('[color] shutdown failed:', e); }
}

ipcMain.handle('color:status', () => engine ? engine.status() : { supported: false, reason: 'Engine not started' });
ipcMain.handle('color:preview', (_e, cfg) => engine.preview(cfg));
ipcMain.handle('color:commit', (_e, cfg) => engine.commit(cfg));
ipcMain.handle('color:compare', (_e, on) => engine.compare(!!on));
ipcMain.handle('color:restore', () => engine.restoreOriginal());
ipcMain.handle('color:selftest', (e) => runSelfTest(engine, { onStep: (r) => { if (!e.sender.isDestroyed()) e.sender.send('color:selftest-step', r); } }));

/* ---------------- self-test CLI: electron . --selftest ---------------- */
if (SELFTEST) {
  if (!app.requestSingleInstanceLock()) {
    console.log('SAKURA PANEL is running. Quit it (tray > Quit) or use Color Control > Run self-test.');
    app.exit(3);
  }
  app.whenReady().then(async () => {
    startColorEngine({ watchdog: true });
    const report = await runSelfTest(engine, { stepMs: 300, onStep: (r) => console.log(`${r.status.toUpperCase().padEnd(11)} ${r.display} :: ${r.name}${r.detail ? ' -- ' + r.detail : ''}`) });
    console.log(`\n${report.displays} display(s): ${report.passed} passed, ${report.failed} failed, ${report.unavailable} unavailable`);
    try { fs.writeFileSync(path.join(app.getPath('userData'), 'selftest-result.json'), JSON.stringify(report, null, 2)); } catch (e) { /* ignore */ }
    shutdownColorEngine();
    app.exit(report.failed ? 1 : 0);
  });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  let tray = null;
  let quitting = false;
  let prefs = { tray: true, startWithWindows: true };

  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

  function createWindow() {
    // Last theme colours, so the very first frame already matches (no white flash).
    const chrome = readJSON('window-chrome.json', { background: '#0A090B', symbol: '#F5EEF2' });
    const bounds = readJSON('window-state.json', { width: 1360, height: 860 });

    win = new BrowserWindow({
      ...bounds,
      minWidth: 980,
      minHeight: 640,
      show: false,
      title: 'SAKURA PANEL',
      icon: ICON_TASKBAR,
      backgroundColor: chrome.background,
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: chrome.background, symbolColor: chrome.symbol, height: TITLEBAR_H },
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    if (bounds.maximized) win.maximize();

    win.loadFile(path.join(ROOT, 'src/index.html'));
    win.once('ready-to-show', () => win.show());

    // External links open in the browser, never inside the app.
    win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });

    const saveBounds = () => { if (!win.isMinimized()) writeJSON('window-state.json', { ...win.getNormalBounds(), maximized: win.isMaximized() }); };
    win.on('resize', saveBounds);
    win.on('move', saveBounds);

    win.on('close', (e) => {
      if (prefs.tray && !quitting) { e.preventDefault(); win.hide(); ensureTray(); }
    });
  }

  function ensureTray() {
    if (tray) return;
    tray = new Tray(nativeImage.createFromPath(ICON_TRAY));
    tray.setToolTip('SAKURA PANEL');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open SAKURA PANEL', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', () => { win.show(); win.focus(); });
  }

  ipcMain.on('sakura:chrome', (_e, c) => {
    if (!win || !c || typeof c.background !== 'string' || typeof c.symbol !== 'string') return;
    const hex = /^#[0-9a-fA-F]{6}$/;
    if (!hex.test(c.background) || !hex.test(c.symbol)) return;
    try { win.setTitleBarOverlay({ color: c.background, symbolColor: c.symbol, height: TITLEBAR_H }); } catch (e) { /* not supported on this OS */ }
    win.setBackgroundColor(c.background);
    writeJSON('window-chrome.json', c);
  });

  ipcMain.on('sakura:prefs', (_e, p) => {
    if (!p || typeof p !== 'object') return;
    prefs = { tray: !!p.tray, startWithWindows: !!p.startWithWindows };
    exitPolicy = p.colorOnExit === 'keep' ? 'keep' : 'restore';
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: prefs.startWithWindows, args: ['--hidden'] });
    if (prefs.tray) ensureTray(); else if (tray) { tray.destroy(); tray = null; }
  });

  ipcMain.on('sakura:window', (_e, action) => {
    if (!win) return;
    if (action === 'minimize') win.minimize();
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (action === 'close') win.close();
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', shutdownColorEngine);
  process.on('exit', shutdownColorEngine);
  app.whenReady().then(() => {
    startColorEngine();
    engine.on('results', (r) => { if (win && !win.isDestroyed()) win.webContents.send('color:results', r); });
    createWindow();
    if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
