/* Presets — one-click colour looks, plus your own saved snapshots. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;
  const KEYS = ['brightness', 'contrast', 'gamma', 'vibrance', 'hue'];
  // Tone keys live on the selected display (gamma ramp); vibrance and hue are global (colour matrix).
  const GLOBAL = new Set(['vibrance', 'hue']);
  const pathFor = (k) => (GLOBAL.has(k) ? 'color.global.' + k : SP.tonePath(k));

  const userPresets = () => SP.store.get('presets.user', []).filter((p) => p && p.values);
  const matches = (v) => KEYS.every((k) => Math.abs(Number(SP.state.get(pathFor(k))) - Number(v[k] != null ? v[k] : k === 'gamma' ? 1 : k === 'hue' ? 0 : 50)) < 0.001);

  function stage(p) {
    SP.state.set(SP.tonePath('source'), 'custom');
    KEYS.forEach((k) => SP.state.set(pathFor(k), p.values[k] != null ? p.values[k] : k === 'gamma' ? 1 : k === 'hue' ? 0 : 50));
    const live = SP.colorEngine.available && SP.colorEngine.status && SP.colorEngine.status.supported;
    SP.ui.toast(live ? `“${p.name}” is now on your display — press Apply to keep it, Discard to undo` : `“${p.name}” staged — press Apply to save it`, { type: 'info', duration: 4500 });
    SP.refresh();
  }

  function presetCard(p, opts = {}) {
    const active = matches(p.values);
    return h('article', { class: 'sp-preset' + (active ? ' is-active' : ''), 'data-search': p.name },
      h('div', { class: 'sp-preset-thumb', style: { '--sp-filter': SP.colorFilter(p.values), '--sw-a': (p.swatch || [])[0] || 'var(--sp-primary)', '--sw-b': (p.swatch || [])[1] || 'var(--sp-accent)' } },
        h('div', { class: 'sp-ti-sky' }), h('div', { class: 'sp-ti-sun' }), h('div', { class: 'sp-ti-hill is-1' }), h('div', { class: 'sp-ti-hill is-2' }), h('div', { class: 'sp-ti-hill is-3' }),
        active ? h('span', { class: 'sp-preset-active' }, icon('check'), 'Active') : null),
      h('div', { class: 'sp-preset-body' },
        h('div', { class: 'sp-preset-title' }, h('h3', null, p.name), opts.user ? h('span', { class: 'sp-tag' }, 'Yours') : null),
        h('p', null, p.desc || 'Saved ' + new Date(p.created || Date.now()).toLocaleDateString()),
        h('div', { class: 'sp-preset-values' },
          h('span', null, 'B ', h('b', null, p.values.brightness)), h('span', null, 'C ', h('b', null, p.values.contrast)),
          h('span', null, 'γ ', h('b', null, Number(p.values.gamma).toFixed(2))), h('span', null, 'V ', h('b', null, p.values.vibrance)))),
      h('div', { class: 'sp-preset-actions' },
        SP.ui.button(active ? 'Selected' : 'Use preset', { size: 'sm', variant: active ? 'ghost' : 'primary', disabled: active, onClick: () => stage(p) }),
        opts.user ? SP.ui.button('', { size: 'sm', variant: 'ghost', icon: 'trash', title: 'Delete preset', onClick: async () => {
          if (await SP.ui.dialog({ title: 'Delete preset?', body: `“${p.name}” will be removed.`, confirmText: 'Delete', danger: true })) {
            SP.store.set('presets.user', userPresets().filter((x) => x.id !== p.id)); SP.refresh();
          }
        } }) : null));
  }

  SP.pages.push({
    id: 'presets', title: 'Presets', group: 'gaming', icon: 'presets',
    search: ['Competitive', 'Cinema', 'Vivid', 'Night', 'Low Light', 'Save current as preset'],
    render(root) {
      const save = async () => {
        const name = await SP.ui.dialog({ title: 'Save as preset', body: 'Saves the current brightness, contrast, gamma, vibrance and hue.', confirmText: 'Save', input: { label: 'Preset name', value: 'My preset' } });
        if (!name) return;
        const p = { id: 'u' + Date.now().toString(36), name: name.slice(0, 40), created: Date.now(), values: Object.fromEntries(KEYS.map((k) => [k, SP.state.get(pathFor(k))])) };
        SP.store.set('presets.user', [...userPresets(), p]);
        SP.ui.toast(`Preset “${p.name}” saved`);
        SP.refresh();
      };
      root.append(SP.ui.pageHeader({
        eyebrow: '3D & Gaming', title: 'Presets', desc: 'A preset changes your selected display live (brightness, contrast, gamma) plus the global vibrance and hue. Press Apply to keep it. Thumbnails are illustrations of each look.',
        actions: [SP.ui.button('Save current as preset', { icon: 'save', onClick: save })],
      }));
      root.append(h('div', { class: 'sp-section-title' }, h('h2', null, 'Built-in looks'), h('span', { class: 'sp-muted' }, SP.COLOR_PRESETS.length + ' presets')));
      root.append(h('div', { class: 'sp-preset-grid' }, SP.COLOR_PRESETS.map((p) => presetCard(p))));
      const mine = userPresets();
      root.append(h('div', { class: 'sp-section-title' }, h('h2', null, 'Your presets'), h('span', { class: 'sp-muted' }, mine.length ? mine.length + ' saved' : '')));
      root.append(mine.length
        ? h('div', { class: 'sp-preset-grid' }, mine.map((p) => presetCard(p, { user: true })))
        : h('div', { class: 'sp-card sp-empty-row', 'data-search': 'Save current as preset' }, icon('save'), h('span', null, 'Adjust colour on the Color Control page, then save it here as your own preset.'), SP.ui.button('Save current as preset', { size: 'sm', onClick: save })));
    },
  });
})();
