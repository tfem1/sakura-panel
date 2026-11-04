/* SAKURA PANEL — theme engine: apply, persist, customise, import/export. */
(function () {
  const SP = (window.SP = window.SP || {});

  /* ---------------- storage (never throws) ---------------- */
  SP.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('sakura-panel.' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('sakura-panel.' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
    remove(key) { try { localStorage.removeItem('sakura-panel.' + key); } catch (e) { /* ignore */ } },
  };

  /* ---------------- colour helpers ---------------- */
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  function normHex(v) {
    if (typeof v !== 'string' || !HEX.test(v.trim())) return null;
    let h = v.trim().slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return '#' + h.toUpperCase();
  }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex([r, g, b]) {
    return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return toHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`; }
  function luminance(hex) {
    const c = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  }
  SP.color = { normHex, rgb, mix, rgba, luminance, contrast };

  /* ---------------- token → CSS variables ---------------- */
  const allTokenDefs = () => SP.TOKEN_SCHEMA.flatMap((g) => g.tokens);

  function cssVars(theme) {
    const t = theme.tokens;
    const dark = theme.mode !== 'light';
    const v = {
      '--sp-primary': t.primary,
      '--sp-primary-rgb': rgb(t.primary).join(', '),
      '--sp-primary-soft': rgba(t.primary, dark ? 0.15 : 0.12),
      '--sp-primary-softer': rgba(t.primary, dark ? 0.08 : 0.06),
      '--sp-primary-line': rgba(t.primary, 0.42),
      '--sp-on-primary': contrast(t.primary, '#000000') > contrast(t.primary, '#FFFFFF') ? '#0B0B0B' : '#FFFFFF',
      '--sp-secondary': t.secondary,
      '--sp-secondary-soft': rgba(t.secondary, 0.16),
      '--sp-accent': t.accent,
      '--sp-accent-soft': rgba(t.accent, 0.16),
      '--sp-bg': t.background,
      '--sp-bg-alt': t.backgroundAlt,
      '--sp-sidebar': t.sidebar,
      '--sp-panel': rgba(t.panel, t.panelOpacity),
      '--sp-panel-solid': t.panel,
      '--sp-raised': t.panelRaised,
      '--sp-raised-hover': mix(t.panelRaised, t.text, 0.05),
      '--sp-text': t.text,
      '--sp-text-muted': t.textMuted,
      '--sp-text-faint': mix(t.textMuted, t.background, 0.35),
      '--sp-border': t.border,
      '--sp-border-strong': mix(t.border, t.text, 0.16),
      '--sp-btn': t.button,
      '--sp-btn-text': t.buttonText,
      '--sp-btn-hover': mix(t.button, dark ? '#FFFFFF' : '#000000', 0.1),
      '--sp-slider-track': t.sliderTrack,
      '--sp-slider-fill': t.sliderFill,
      '--sp-slider-thumb': t.sliderThumb,
      '--sp-hover': rgba(t.hover, t.hoverStrength),
      '--sp-hover-strong': rgba(t.hover, Math.min(1, t.hoverStrength * 1.8 + 0.01)),
      '--sp-anim': t.animation,
      '--sp-anim-soft': rgba(t.animation, 0.18),
      '--sp-glow': rgba(t.animation, t.glow * 0.45),
      '--sp-glow-faint': rgba(t.primary, t.glow * 0.12),
      '--sp-shadow': dark ? '0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 30px -12px rgba(0,0,0,0.6)' : '0 1px 2px rgba(40,20,30,0.04), 0 10px 28px -14px rgba(40,20,30,0.14)',
      '--sp-shadow-pop': dark ? '0 18px 50px -12px rgba(0,0,0,0.75)' : '0 18px 50px -14px rgba(40,20,30,0.25)',
      '--sp-success': dark ? '#5FD3A1' : '#1F9D6A',
      '--sp-warning': dark ? '#F3C26B' : '#B7791F',
      '--sp-danger': dark ? '#FF6B7D' : '#D23A4E',
      'color-scheme': dark ? 'dark' : 'light',
    };
    // Brand mark facets follow the theme so the blossom stays legible on every palette.
    const pale = luminance(t.primary) > 0.6;
    v['--sp-mark-a'] = pale ? t.primary : mix(t.primary, '#FFFFFF', 0.48);
    v['--sp-mark-b'] = pale ? mix(t.primary, t.background, 0.42) : t.primary;
    v['--sp-mark-core'] = dark ? mix('#FFFFFF', t.primary, 0.06) : v['--sp-mark-b'];
    return v;
  }

  function applyTokens(theme, el) {
    const vars = cssVars(theme);
    for (const k in vars) el.style.setProperty(k, vars[k]);
    el.dataset.mode = theme.mode;
  }

  /* ---------------- validation ---------------- */
  function sanitizeTokens(input, base) {
    const out = {};
    for (const def of allTokenDefs()) {
      const raw = input ? input[def.key] : undefined;
      if (def.type === 'range') {
        const n = Number(raw);
        out[def.key] = Number.isFinite(n) ? Math.min(def.max, Math.max(def.min, n)) : base[def.key];
      } else {
        out[def.key] = normHex(raw) || base[def.key];
      }
    }
    return out;
  }
  function sanitizeName(n, fallback) {
    const s = typeof n === 'string' ? n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : '';
    return s || fallback;
  }

  /* ---------------- state ---------------- */
  const KEY_ACTIVE = 'theme.active';
  const KEY_CUSTOM = 'theme.custom';
  const KEY_OVERRIDES = 'theme.overrides';
  const listeners = new Set();
  const builtInById = Object.fromEntries(SP.BUILT_IN_THEMES.map((t) => [t.id, t]));
  const fallbackTokens = builtInById[SP.DEFAULT_THEME_ID].tokens;

  let customs = (SP.store.get(KEY_CUSTOM, []) || []).filter((t) => t && typeof t.id === 'string').map((t) => ({
    id: t.id, name: sanitizeName(t.name, 'Custom theme'), tagline: sanitizeName(t.tagline, 'Personal theme'),
    mode: t.mode === 'light' ? 'light' : 'dark', builtIn: false, basedOn: t.basedOn || null,
    tokens: sanitizeTokens(t.tokens, fallbackTokens),
  }));
  let overrides = SP.store.get(KEY_OVERRIDES, {}) || {};
  let activeId = SP.store.get(KEY_ACTIVE, SP.DEFAULT_THEME_ID);

  const persist = () => { SP.store.set(KEY_CUSTOM, customs); SP.store.set(KEY_OVERRIDES, overrides); };
  const emit = (type, detail) => listeners.forEach((fn) => { try { fn(type, detail); } catch (e) { console.error(e); } });

  function resolveBuiltIn(t) {
    const o = overrides[t.id];
    if (!o) return { ...t, modified: false };
    return { ...t, mode: o.mode || t.mode, tokens: sanitizeTokens(o.tokens, t.tokens), modified: true };
  }

  function list() { return [...SP.BUILT_IN_THEMES.map(resolveBuiltIn), ...customs.map((c) => ({ ...c }))]; }
  function get(id) {
    if (builtInById[id]) return resolveBuiltIn(builtInById[id]);
    const c = customs.find((x) => x.id === id);
    return c ? { ...c } : null;
  }

  function pushChrome(theme) {
    // Electron: recolour native caption buttons and the pre-paint window background.
    try {
      if (window.sakura && window.sakura.setChrome) {
        window.sakura.setChrome({ background: theme.tokens.sidebar, symbol: theme.tokens.text });
      }
    } catch (e) { /* not in Electron */ }
  }

  let animTimer = null;
  function apply(id, opts = {}) {
    const theme = get(id) || get(SP.DEFAULT_THEME_ID);
    const root = document.documentElement;
    const animate = opts.animate !== false && root.dataset.motion !== 'off';
    if (animate) {
      root.classList.add('sp-theme-anim');
      clearTimeout(animTimer);
      animTimer = setTimeout(() => root.classList.remove('sp-theme-anim'), 480);
    }
    applyTokens(theme, root);
    activeId = theme.id;
    if (opts.persist !== false) SP.store.set(KEY_ACTIVE, activeId);
    pushChrome(theme);
    emit('applied', theme);
    return theme;
  }

  /** Apply arbitrary tokens to the whole app without saving (live preview while editing). */
  function previewLive(theme) { applyTokens(theme, document.documentElement); pushChrome(theme); }

  function uid() { return 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function uniqueName(base) {
    const names = new Set(list().map((t) => t.name.toLowerCase()));
    if (!names.has(base.toLowerCase())) return base;
    for (let i = 2; i < 999; i++) { const n = `${base} ${i}`; if (!names.has(n.toLowerCase())) return n; }
    return base;
  }

  function createCustom({ name, baseId, tokens, mode } = {}) {
    const base = get(baseId || activeId) || get(SP.DEFAULT_THEME_ID);
    const t = {
      id: uid(), name: uniqueName(sanitizeName(name, 'My Sakura')), tagline: 'Personal theme',
      mode: mode || base.mode, builtIn: false, basedOn: base.id,
      tokens: sanitizeTokens(tokens || base.tokens, base.tokens),
    };
    customs.push(t); persist(); emit('changed', t);
    return { ...t };
  }

  function duplicate(id) {
    const src = get(id);
    if (!src) return null;
    return createCustom({ name: uniqueName(src.name + ' Copy'), baseId: src.id, tokens: src.tokens, mode: src.mode });
  }

  /** Save edits. Built-ins store an override (resettable); customs are updated in place. */
  function save(id, { name, tokens, mode }) {
    if (builtInById[id]) {
      overrides[id] = { mode: mode === 'light' ? 'light' : mode === 'dark' ? 'dark' : builtInById[id].mode, tokens: sanitizeTokens(tokens, builtInById[id].tokens) };
    } else {
      const c = customs.find((x) => x.id === id);
      if (!c) return null;
      if (name !== undefined) c.name = sanitizeName(name, c.name);
      if (mode) c.mode = mode === 'light' ? 'light' : 'dark';
      if (tokens) c.tokens = sanitizeTokens(tokens, c.tokens);
    }
    persist(); emit('changed', get(id));
    if (id === activeId) apply(id, { animate: false });
    return get(id);
  }

  function resetBuiltIn(id) {
    if (!overrides[id]) return;
    delete overrides[id]; persist(); emit('changed', get(id));
    if (id === activeId) apply(id);
  }

  function remove(id) {
    if (builtInById[id]) return false;
    const before = customs.length;
    customs = customs.filter((x) => x.id !== id);
    if (customs.length === before) return false;
    persist();
    if (activeId === id) apply(SP.DEFAULT_THEME_ID);
    emit('changed', null);
    return true;
  }

  function restoreDefault() {
    overrides = {}; persist();
    apply(SP.DEFAULT_THEME_ID);
    emit('changed', null);
  }

  /* ---------------- import / export ---------------- */
  const FORMAT = 'sakura-panel-theme';
  function exportData(id) {
    const t = get(id);
    if (!t) return null;
    return { format: FORMAT, version: 1, name: t.name, tagline: t.tagline, mode: t.mode, tokens: t.tokens };
  }
  function exportToFile(id) {
    const data = exportData(id);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.sakura-theme.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importData(obj) {
    if (!obj || typeof obj !== 'object' || obj.format !== FORMAT || typeof obj.tokens !== 'object') {
      throw new Error('This file is not a SAKURA PANEL theme.');
    }
    const tokens = sanitizeTokens(obj.tokens, fallbackTokens);
    const mode = obj.mode === 'light' || obj.mode === 'dark' ? obj.mode : (luminance(tokens.background) > 0.4 ? 'light' : 'dark');
    const t = createCustom({ name: sanitizeName(obj.name, 'Imported theme'), tokens, mode });
    return t;
  }
  function importFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected.'));
      if (file.size > 64 * 1024) return reject(new Error('Theme files must be smaller than 64 KB.'));
      const r = new FileReader();
      r.onload = () => { try { resolve(importData(JSON.parse(r.result))); } catch (e) { reject(e instanceof SyntaxError ? new Error('The file is not valid JSON.') : e); } };
      r.onerror = () => reject(new Error('Could not read the file.'));
      r.readAsText(file);
    });
  }

  SP.theme = {
    list, get, apply, previewLive, applyTokens, cssVars,
    createCustom, duplicate, save, resetBuiltIn, remove, restoreDefault,
    exportData, exportToFile, importData, importFromFile, sanitizeTokens,
    get activeId() { return activeId; },
    get active() { return get(activeId); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  // Paint the saved theme before the body renders (no flash on restart).
  const motion = SP.store.get('settings.applied', null);
  if (motion && motion.system && motion.system.motion) document.documentElement.dataset.motion = motion.system.motion;
  apply(get(activeId) ? activeId : SP.DEFAULT_THEME_ID, { animate: false });
})();
