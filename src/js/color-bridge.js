/* SAKURA PANEL — renderer side of the display colour engine.
 *
 * Slider moves -> SP.state 'change' -> preview(draft) -> main process engine -> Windows.
 * At most one request is in flight; newer values replace queued ones, so dragging stays
 * smooth without flooding the driver. Apply -> commit (verified + saved), Discard ->
 * preview(applied). In a plain browser there is no engine and the UI says so.
 */
(function () {
  const SP = window.SP;
  const CM = SP.colorMath;
  const api = window.sakura && window.sakura.color;
  const listeners = new Set();
  const emit = (type, detail) => listeners.forEach((fn) => { try { fn(type, detail); } catch (e) { console.error(e); } });
  const TONE_KEYS = Object.keys(CM.TONE_DEFAULTS);

  const engine = SP.colorEngine = {
    available: !!api,
    status: null,
    results: null,
    comparing: false,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Settings (state shape) -> engine config. */
    config(color) {
      const displays = {};
      for (const [k, v] of Object.entries((color && color.displays) || {})) {
        const tone = {};
        TONE_KEYS.forEach((t) => { tone[t] = v[t]; });
        displays[k] = { enabled: v.source !== 'default', tone };
      }
      return { displays, global: { ...(color && color.global) } };
    },
    preview(color) { if (!api) return; queued = engine.config(color); pump(); },
    async commit(color) {
      queued = null;
      const r = await api.commit(engine.config(color));
      engine.results = r; emit('results', r);
      return r;
    },
    async compare(on) {
      if (!api) return null;
      engine.comparing = !!on;
      const r = await api.compare(!!on);
      engine.results = r; emit('results', r);
      return r;
    },
    async restoreOriginal() {
      if (!api) return null;
      const r = await api.restoreOriginal();
      // The display is now neutral: make the saved settings say so too.
      const color = SP.state.applied.color;
      const neutral = { ...color, displays: {}, global: { ...CM.GLOBAL_DEFAULTS } };
      for (const k of Object.keys(color.displays)) neutral.displays[k] = { source: 'custom', ...CM.TONE_DEFAULTS };
      SP.state.setApplied('color', neutral);
      engine.results = r; emit('results', r);
      return r;
    },
    async selfTest(onStep) {
      if (!api) return null;
      const off = api.onSelfTestStep(onStep);
      try { return await api.selfTest(); } finally { off(); }
    },
    /** Result for one display key from the last engine update. */
    resultFor(key) { return engine.results && engine.results.displays ? engine.results.displays[key] : null; },
    displayInfo(key) { return engine.status && engine.status.displays ? engine.status.displays.find((d) => d.key === key) : null; },
  };

  /* ---------- live preview pump ---------- */
  let queued = null, inflight = false;
  async function pump() {
    if (inflight || !queued || !api) return;
    inflight = true;
    const cfg = queued; queued = null;
    try { engine.results = await api.preview(cfg); emit('results', engine.results); }
    catch (e) { emit('error', e); }
    finally { inflight = false; if (queued) pump(); }
  }

  /* ---------- displays ---------- */
  function mapDisplay(d, i) {
    const res = d.width && d.height ? `${d.width}x${d.height}` : 'unknown';
    return {
      id: d.key, real: true, name: d.name || `Display ${i + 1}`, index: i + 1,
      model: [d.width && d.height ? `${d.width}×${d.height}` : '', d.refresh ? d.refresh + ' Hz' : '', d.adapter || ''].filter(Boolean).join(' · '),
      primary: !!d.primary, resolutions: [res], refresh: [String(d.refresh || '')],
      w: Math.max(16, Math.min(34, (d.width || 1920) / 95)), ratio: d.width && d.height ? d.width / d.height : 16 / 9,
      hdr: d.hdr, rampAvailable: d.rampAvailable,
    };
  }

  /** Makes sure every known display has a settings entry and a valid selection. */
  SP.seedColorDisplays = function () {
    for (const d of SP.DISPLAYS) SP.state.seed('color.displays.' + d.id, { source: 'custom', ...CM.TONE_DEFAULTS });
    SP.state.seed('color.global', { ...CM.GLOBAL_DEFAULTS });
    const cur = SP.state.get('color.display');
    if (!SP.DISPLAYS.some((d) => d.id === cur)) {
      const primary = SP.DISPLAYS.find((d) => d.primary) || SP.DISPLAYS[0];
      if (primary) { SP.state.applied.color.display = primary.id; SP.state.draft.color.display = primary.id; }
    }
  };
  SP.colorKey = () => { SP.seedColorDisplays(); return SP.state.get('color.display'); };
  SP.tonePath = (field, key) => `color.displays.${key || SP.colorKey()}.${field}`;

  // In the browser preview the sample displays are final; in the app, wait for the real list.
  if (!api) SP.seedColorDisplays();

  /* ---------- wiring ---------- */
  SP.state.on((type, d) => {
    if (type === 'change' && d && d.path && d.path.startsWith('color')) engine.preview(SP.state.draft.color);
    if (type === 'discarded') { SP.seedColorDisplays(); engine.preview(SP.state.draft.color); }
  });

  engine.ready = !api ? Promise.resolve(null) : api.status().then((st) => {
    engine.status = st;
    engine.results = st.lastResults;
    if (st.supported && st.displays.length) {
      SP.DISPLAYS = st.displays.map(mapDisplay);
      if (!SP.DISPLAYS.some((x) => x.id === SP.state.get('display.active'))) {
        const p = SP.DISPLAYS.find((x) => x.primary) || SP.DISPLAYS[0];
        SP.state.applied.display.active = p.id; SP.state.draft.display.active = p.id;
      }
    }
    SP.seedColorDisplays();
    // Bring the display in line with the saved settings (no-op when they already match).
    engine.preview(SP.state.draft.color);
    emit('status', st);
    return st;
  }).catch((e) => { engine.status = { supported: false, reason: e.message }; emit('status', engine.status); return engine.status; });

  if (api) api.onResults((r) => { engine.results = r; emit('results', r); });
})();
