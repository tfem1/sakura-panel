/* SAKURA PANEL — Electron main process (Windows shell integration). */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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

if (!app.requestSingleInstanceLock()) {
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
  app.whenReady().then(() => {
    createWindow();
    if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
