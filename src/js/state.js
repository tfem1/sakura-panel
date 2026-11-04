/* SAKURA PANEL — settings state: applied values, a working draft, and the apply cycle. */
(function () {
  const SP = window.SP;

  const DEFAULTS = {
    color: {
      display: 'd1', source: 'custom', channel: 'all',
      brightness: 50, contrast: 50, gamma: 1.0, vibrance: 50, hue: 0,
      gammaR: 1.0, gammaG: 1.0, gammaB: 1.0,
      depth: '10', format: 'RGB', range: 'full',
    },
    display: {
      active: 'd1', resolution: '2560x1440', refresh: '165', scaling: 'gpu', scaleMode: 'aspect',
      vrr: true, vrrWindowed: false, hdr: false, rotation: '0', overscan: 0,
    },
    graphics: {
      lowLatency: 'on', power: 'performance', textureQuality: 'high', aniso: 'app', aa: 'app',
      fxaa: false, vsync: 'app', fpsCap: false, fpsLimit: 144, tripleBuffer: false,
      shaderCache: '10', threaded: 'auto', lodBias: 'clamp', ao: 'off', sharpen: 0,
    },
    performance: { powerLimit: 100, tempTarget: 83, fanMode: 'auto', fanSpeed: 55, coreOffset: 0, memOffset: 0 },
    profiles: [
      { id: 'p1', name: 'Competitive Shooter', exe: 'C:\\Games\\Arena\\arena.exe', preset: 'competitive', lowLatency: 'ultra', fpsLimit: 240, vsync: 'off', power: 'performance', colorOverride: true, vibrance: 70 },
      { id: 'p2', name: 'Open World RPG', exe: 'C:\\Games\\Frontier\\frontier.exe', preset: 'cinema', lowLatency: 'on', fpsLimit: 120, vsync: 'app', power: 'balanced', colorOverride: false, vibrance: 50 },
      { id: 'p3', name: 'Racing Simulator', exe: 'D:\\Sim\\apex-sim.exe', preset: 'vivid', lowLatency: 'on', fpsLimit: 165, vsync: 'fast', power: 'performance', colorOverride: true, vibrance: 62 },
      { id: 'p4', name: 'Strategy', exe: 'D:\\Games\\Empire\\empire.exe', preset: 'none', lowLatency: 'off', fpsLimit: 90, vsync: 'on', power: 'quiet', colorOverride: false, vibrance: 50 },
    ],
    userPresets: [],
    system: {
      startWithWindows: true, tray: true, updates: true, notifications: true,
      motion: 'full', scale: 100, startPage: 'dashboard', view: 'simple', confirmApply: false,
    },
  };

  // Sections that are pure UI preference: they take effect instantly, no Apply needed.
  const INSTANT = new Set(['system']);

  const clone = (o) => JSON.parse(JSON.stringify(o));
  function merge(base, saved) {
    if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
    if (!base || typeof base !== 'object') return saved === undefined || typeof saved !== typeof base ? base : saved;
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], saved ? saved[k] : undefined);
    return out;
  }

  let applied = merge(clone(DEFAULTS), SP.store.get('settings.applied', null));
  let draft = clone(applied);
  const listeners = new Set();
  const emit = (type, detail) => listeners.forEach((fn) => fn(type, detail));

  function walk(obj, path) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    return [o, parts[parts.length - 1]];
  }
  function get(path, from) { const [o, k] = walk(from || draft, path); return o[k]; }

  function set(path, value) {
    const [o, k] = walk(draft, path);
    if (o[k] === value) return;
    o[k] = value;
    if (INSTANT.has(path.split('.')[0])) {
      const [a, ak] = walk(applied, path); a[ak] = value;
      SP.store.set('settings.applied', applied);
    }
    emit('change', { path, value });
  }

  /** Replace a whole subtree in the draft (used for profile lists, preset application). */
  function replace(path, value) {
    const [o, k] = walk(draft, path);
    o[k] = clone(value);
    emit('change', { path, value });
  }

  function diffCount(a, b) {
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return a === b ? 0 : 1;
    if (Array.isArray(a) !== Array.isArray(b)) return 1;
    if (Array.isArray(a) && a.length !== b.length) return Math.abs(a.length - b.length) + diffCount(a.slice(0, b.length), b.slice(0, a.length));
    let n = 0;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) n += diffCount(a[k], b[k]);
    return n;
  }
  const changes = () => diffCount(applied, draft);

  function apply() {
    return new Promise((resolve) => {
      // Simulated driver round-trip so feedback is visible; a real backend would await the driver call here.
      setTimeout(() => {
        applied = clone(draft);
        SP.store.set('settings.applied', applied);
        emit('applied');
        resolve();
      }, 650);
    });
  }
  function discard() { draft = clone(applied); emit('discarded'); }
  function resetSection(section) { draft[section] = clone(DEFAULTS[section]); emit('change', { path: section }); }
  function resetAll() {
    applied = clone(DEFAULTS); draft = clone(DEFAULTS);
    SP.store.set('settings.applied', applied);
    emit('applied'); emit('discarded');
  }
  function exportAll() {
    return { format: 'sakura-panel-settings', version: 1, settings: applied, theme: SP.theme.activeId };
  }

  SP.state = {
    DEFAULTS, get, set, replace, changes, apply, discard, resetSection, resetAll, exportAll,
    get draft() { return draft; },
    get applied() { return applied; },
    getApplied: (path) => get(path, applied),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
