/* SAKURA PANEL — minimal, validated bridge between the UI and the main process. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sakura', {
  /** Recolour the native caption buttons and remember the window background. */
  setChrome: (c) => ipcRenderer.send('sakura:chrome', { background: String(c.background), symbol: String(c.symbol) }),
  /** Tray / start-with-Windows preferences. */
  setPrefs: (p) => ipcRenderer.send('sakura:prefs', { tray: !!p.tray, startWithWindows: !!p.startWithWindows, colorOnExit: p.colorOnExit === 'keep' ? 'keep' : 'restore' }),
  window: (action) => ipcRenderer.send('sakura:window', String(action)),
  /** Real display colour engine (main process). Configs are re-validated there. */
  color: {
    status: () => ipcRenderer.invoke('color:status'),
    preview: (cfg) => ipcRenderer.invoke('color:preview', cfg),
    commit: (cfg) => ipcRenderer.invoke('color:commit', cfg),
    compare: (on) => ipcRenderer.invoke('color:compare', !!on),
    restoreOriginal: () => ipcRenderer.invoke('color:restore'),
    selfTest: () => ipcRenderer.invoke('color:selftest'),
    onResults: (cb) => { const h = (_e, r) => cb(r); ipcRenderer.on('color:results', h); return () => ipcRenderer.removeListener('color:results', h); },
    onSelfTestStep: (cb) => { const h = (_e, r) => cb(r); ipcRenderer.on('color:selftest-step', h); return () => ipcRenderer.removeListener('color:selftest-step', h); },
  },
});
