/* SAKURA PANEL — minimal, validated bridge between the UI and the main process. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sakura', {
  /** Recolour the native caption buttons and remember the window background. */
  setChrome: (c) => ipcRenderer.send('sakura:chrome', { background: String(c.background), symbol: String(c.symbol) }),
  /** Tray / start-with-Windows preferences. */
  setPrefs: (p) => ipcRenderer.send('sakura:prefs', { tray: !!p.tray, startWithWindows: !!p.startWithWindows }),
  window: (action) => ipcRenderer.send('sakura:window', String(action)),
});
