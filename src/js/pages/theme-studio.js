/* Theme Studio — browse, preview, apply, customise, create, import and export themes. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;

  const QUICK_ACCENTS = [
    ['Sakura', '#FF5C9D'], ['Blossom', '#F4A6C6'], ['Cherry', '#E0284F'], ['Plum', '#B45CA6'], ['Lavender', '#C6A4FF'],
    ['Ice', '#6FA9DA'], ['Champagne', '#C9A27E'], ['White', '#FFFFFF'], ['Silver', '#C9CED6'], ['Graphite', '#5F656D'], ['Ink', '#1C1C1C'],
  ];

  // Studio state survives re-renders (theme changes, refreshes).
  const studio = { sel: null, editing: false, draft: null, live: SP.store.get('studio.live', true) };

  function thumb(t) {
    const k = t.tokens;
    return h('div', { class: 'sp-tthumb', style: { background: `linear-gradient(180deg, ${k.background}, ${k.backgroundAlt})`, borderColor: k.border } },
      h('div', { class: 'sp-tthumb-side', style: { background: k.sidebar, borderColor: k.border } },
        h('i', { style: { background: k.primary } }), h('i', { style: { background: k.textMuted } }), h('i', { style: { background: k.textMuted } })),
      h('div', { class: 'sp-tthumb-main' },
        h('div', { class: 'sp-tthumb-card', style: { background: k.panel, borderColor: k.border } },
          h('i', { class: 'line', style: { background: k.text } }),
          h('div', { class: 'track', style: { background: k.sliderTrack } }, h('i', { style: { background: k.sliderFill } })),
          h('div', { class: 'btns' }, h('i', { style: { background: k.button } }), h('i', { style: { background: k.panelRaised, borderColor: k.border } }))),
        h('div', { class: 'sp-tthumb-dots' }, [k.primary, k.secondary, k.accent].map((c) => h('i', { style: { background: c } })))));
  }

  function previewMock() {
    const el = h('div', { class: 'sp-tprev' },
      h('div', { class: 'sp-tprev-title' }, SP.ui.mark(14), h('span', { class: 'sp-brand-word' }, h('b', null, 'SAKURA'), h('span', null, 'PANEL')), h('i'), h('i'), h('i')),
      h('div', { class: 'sp-tprev-body' },
        h('div', { class: 'sp-tprev-side' },
          ['dashboard', 'color', 'display', 'gamepad', 'palette'].map((n, i) => h('div', { class: 'sp-tprev-nav' + (i === 1 ? ' is-active' : '') }, icon(n), h('span', null, ['Dashboard', 'Color Control', 'Display', 'Profiles', 'Theme Studio'][i])))),
        h('div', { class: 'sp-tprev-main' },
          h('div', { class: 'sp-eyebrow' }, 'Display'),
          h('div', { class: 'sp-tprev-h' }, 'Color Control'),
          h('div', { class: 'sp-card sp-tprev-card' },
            h('div', { class: 'sp-tprev-row' }, h('span', null, 'Brightness'), SP.ui.slider({ value: 62, min: 0, max: 100, unit: '%', label: 'Preview slider', compact: true })),
            h('div', { class: 'sp-tprev-row' }, h('span', null, 'Vibrance'), SP.ui.slider({ value: 35, min: 0, max: 100, unit: '%', label: 'Preview slider', compact: true })),
            h('div', { class: 'sp-tprev-row' }, h('span', null, 'HDR'), SP.ui.toggle({ value: true, label: 'Preview toggle' })),
            h('div', { class: 'sp-tprev-row' }, h('span', null, 'Low latency'), SP.ui.segmented({ value: 'on', label: 'Preview segmented', options: [['off', 'Off'], ['on', 'On'], ['ultra', 'Ultra']] }))),
          h('div', { class: 'sp-grid sp-grid-2', style: { gap: '8px' } },
            SP.ui.stat({ icon: 'temp', label: 'Temp', value: '61', unit: '°C', meter: 61 }),
            SP.ui.stat({ icon: 'activity', label: 'Load', value: '74', unit: '%', meter: 74 })),
          h('div', { class: 'sp-tprev-actions' }, SP.ui.button('Discard', { variant: 'ghost', size: 'sm' }), SP.ui.button('Apply', { variant: 'primary', size: 'sm' })))));
    return el;
  }

  function contrastIssues(t) {
    const C = SP.color, k = t.tokens, out = [];
    if (C.contrast(k.text, k.panel) < 4.5) out.push('Text on panels');
    if (C.contrast(k.textMuted, k.panel) < 2.8) out.push('Muted text on panels');
    if (C.contrast(k.buttonText, k.button) < 3) out.push('Button text');
    return out;
  }

  SP.pages.push({
    id: 'themes', title: 'Theme Studio', group: 'system', icon: 'palette',
    search: ['Apply theme', 'Create theme', 'Import theme', 'Export theme', 'Duplicate theme', 'Restore default theme', 'Customize colors', 'Quick accent', ...SP.BUILT_IN_THEMES.map((t) => t.name)],
    render(root) {
      if (!studio.sel || !SP.theme.get(studio.sel)) studio.sel = SP.theme.activeId;

      const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
      fileIn.addEventListener('change', async () => {
        try {
          const t = await SP.theme.importFromFile(fileIn.files[0]);
          studio.sel = t.id; studio.editing = false;
          SP.ui.toast(`Imported “${t.name}”`);
          paint();
        } catch (e) { SP.ui.toast(e.message, { type: 'error', duration: 4000 }); }
        fileIn.value = '';
      });

      root.append(fileIn, SP.ui.pageHeader({
        eyebrow: 'Personalisation', title: 'Theme Studio', desc: 'Preview any theme before applying it, tune every colour, and keep your own. Your choice is restored on the next launch.',
        actions: [
          SP.ui.button('Import', { icon: 'upload', variant: 'ghost', onClick: () => fileIn.click(), title: 'Import a .sakura-theme.json file' }),
          SP.ui.button('New theme', { icon: 'plus', onClick: () => { const t = SP.theme.createCustom({ baseId: studio.sel, name: 'My Sakura' }); studio.sel = t.id; startEdit(); } }),
          SP.ui.button('Restore default', { icon: 'reset', variant: 'ghost', onClick: async () => {
            if (await SP.ui.dialog({ title: 'Restore default theme?', body: 'Applies Midnight Sakura and removes your edits to built-in themes. Your own themes are kept.', confirmText: 'Restore' })) {
              studio.editing = false; studio.sel = SP.DEFAULT_THEME_ID; SP.theme.restoreDefault(); SP.ui.toast('Default theme restored'); paint();
            }
          } }),
        ],
      }));

      const left = h('div', { class: 'sp-studio-left' });
      const previewHost = previewMock();
      const info = h('div', { class: 'sp-studio-info' });
      const right = h('div', { class: 'sp-studio-right' }, h('section', { class: 'sp-card sp-studio-preview' },
        h('div', { class: 'sp-studio-preview-head' }, h('span', { class: 'sp-eyebrow' }, 'Live preview'), h('span', { class: 'sp-studio-preview-name' })),
        previewHost, info));
      root.append(h('div', { class: 'sp-studio' }, left, right));

      /* ---------- preview ---------- */
      let raf = 0;
      function paintPreview() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const t = studio.editing ? { ...SP.theme.get(studio.sel), ...studio.draft } : SP.theme.get(studio.sel);
          if (!t) return;
          SP.theme.applyTokens(t, previewHost);
          right.querySelector('.sp-studio-preview-name').textContent = t.name;
          if (studio.editing && studio.live) SP.theme.previewLive(t);
        });
      }

      function paintInfo() {
        const t = SP.theme.get(studio.sel);
        const isActive = t.id === SP.theme.activeId;
        const actions = [];
        if (!studio.editing) {
          actions.push(SP.ui.button(isActive ? 'Applied' : 'Apply theme', { variant: 'primary', icon: isActive ? 'check' : null, disabled: isActive, onClick: () => { SP.theme.apply(t.id); SP.ui.toast(`${t.name} applied`); paint(); } }));
          actions.push(SP.ui.button('Customize', { icon: 'edit', onClick: startEdit }));
        }
        info.replaceChildren(
          h('div', { class: 'sp-studio-info-text' },
            h('h3', null, t.name, isActive ? h('span', { class: 'sp-badge' }, 'Active') : null, t.modified ? h('span', { class: 'sp-tag' }, 'Modified') : null, !t.builtIn ? h('span', { class: 'sp-tag' }, 'Yours') : null),
            h('p', { class: 'sp-muted' }, t.tagline + ' · ' + (t.mode === 'light' ? 'Light' : 'Dark'))),
          h('div', { class: 'sp-studio-info-actions' }, actions,
            !studio.editing ? SP.ui.button('', { variant: 'ghost', icon: 'copy', title: 'Duplicate', onClick: () => { const c = SP.theme.duplicate(t.id); studio.sel = c.id; SP.ui.toast(`Created “${c.name}”`); paint(); } }) : null,
            SP.ui.button('', { variant: 'ghost', icon: 'download', title: 'Export as file', onClick: () => { SP.theme.exportToFile(t.id); SP.ui.toast(`Exported “${t.name}”`); } }),
            t.modified && !studio.editing ? SP.ui.button('', { variant: 'ghost', icon: 'reset', title: 'Reset to original', onClick: () => { SP.theme.resetBuiltIn(t.id); SP.ui.toast(`${t.name} reset`); paint(); } }) : null,
            !t.builtIn && !studio.editing ? SP.ui.button('', { variant: 'ghost', icon: 'trash', title: 'Delete theme', onClick: async () => {
              if (await SP.ui.dialog({ title: 'Delete theme?', body: `“${t.name}” will be permanently removed.`, confirmText: 'Delete', danger: true })) {
                SP.theme.remove(t.id); studio.sel = SP.theme.activeId; SP.ui.toast('Theme deleted'); paint();
              }
            } }) : null));
      }

      /* ---------- library ---------- */
      function card(t) {
        const isActive = t.id === SP.theme.activeId;
        const b = h('button', {
          type: 'button', class: 'sp-tcard' + (t.id === studio.sel ? ' is-selected' : '') + (isActive ? ' is-active' : ''), 'data-search': t.name, 'aria-pressed': String(t.id === studio.sel),
          title: 'Click to preview · double-click to apply',
          onclick: () => { studio.sel = t.id; paintLibrarySelection(); paintPreview(); paintInfo(); },
          ondblclick: () => { SP.theme.apply(t.id); SP.ui.toast(`${t.name} applied`); paint(); },
        }, thumb(t),
          h('div', { class: 'sp-tcard-text' },
            h('strong', null, t.name),
            h('small', null, t.tagline)),
          isActive ? h('span', { class: 'sp-tcard-badge' }, icon('check')) : null,
          t.modified ? h('span', { class: 'sp-tcard-mod', title: 'Customised' }) : null);
        b.dataset.id = t.id;
        return b;
      }
      function paintLibrarySelection() {
        left.querySelectorAll('.sp-tcard').forEach((c) => { const on = c.dataset.id === studio.sel; c.classList.toggle('is-selected', on); c.setAttribute('aria-pressed', String(on)); });
      }
      function library() {
        const all = SP.theme.list();
        const mine = all.filter((t) => !t.builtIn);
        return [
          h('div', { class: 'sp-section-title' }, h('h2', null, 'Built-in themes'), h('span', { class: 'sp-muted' }, 'Click to preview · double-click to apply')),
          h('div', { class: 'sp-tgrid' }, all.filter((t) => t.builtIn).map(card)),
          h('div', { class: 'sp-section-title' }, h('h2', null, 'Your themes'), h('span', { class: 'sp-muted' }, mine.length ? mine.length + ' saved' : '')),
          mine.length ? h('div', { class: 'sp-tgrid' }, mine.map(card))
            : h('div', { class: 'sp-card sp-empty-row' }, icon('sparkle'), h('span', null, 'Create a theme from any built-in one, or import a .sakura-theme.json file.'),
              SP.ui.button('New theme', { size: 'sm', icon: 'plus', onClick: () => { const t = SP.theme.createCustom({ baseId: studio.sel, name: 'My Sakura' }); studio.sel = t.id; startEdit(); } })),
        ];
      }

      /* ---------- editor ---------- */
      function startEdit() {
        const t = SP.theme.get(studio.sel);
        studio.editing = true;
        studio.draft = { name: t.name, mode: t.mode, tokens: { ...t.tokens } };
        paint();
      }
      function stopEdit() {
        studio.editing = false; studio.draft = null;
        SP.theme.apply(SP.theme.activeId, { animate: false, persist: false });
        paint();
      }

      function colorRow(def) {
        const val = studio.draft.tokens[def.key];
        const picker = h('input', { type: 'color', value: val.toLowerCase(), 'aria-label': def.label });
        const chip = h('span', { class: 'sp-swatch-chip', style: { background: val } });
        const hex = h('input', { class: 'sp-input sp-hex sp-mono', value: val, maxlength: 7, spellcheck: 'false', 'aria-label': def.label + ' hex' });
        const set = (v, from) => {
          studio.draft.tokens[def.key] = v;
          chip.style.background = v;
          if (from !== 'picker') picker.value = v.toLowerCase();
          if (from !== 'hex') hex.value = v;
          paintPreview(); paintWarnings();
        };
        picker.addEventListener('input', () => set(picker.value.toUpperCase(), 'picker'));
        hex.addEventListener('input', () => { const n = SP.color.normHex(hex.value); hex.classList.toggle('is-invalid', !n); if (n) set(n, 'hex'); });
        hex.addEventListener('blur', () => { hex.value = studio.draft.tokens[def.key]; hex.classList.remove('is-invalid'); });
        const row = h('div', { class: 'sp-tok', 'data-search': def.label }, h('label', { class: 'sp-swatch', title: 'Pick colour' }, picker, chip),
          h('div', { class: 'sp-tok-text' }, h('strong', null, def.label), def.hint ? h('small', null, def.hint) : null), hex);
        row.setVal = (v) => set(v);
        return row;
      }
      function rangeRow(def) {
        return h('div', { class: 'sp-tok is-range', 'data-search': def.label },
          h('div', { class: 'sp-tok-text' }, h('strong', null, def.label)),
          SP.ui.slider({ value: studio.draft.tokens[def.key], min: def.min, max: def.max, step: def.step, label: def.label, compact: true,
            format: (v) => Math.round(((v - def.min) / (def.max - def.min)) * 100) + '%',
            onInput: (v) => { studio.draft.tokens[def.key] = v; paintPreview(); } }));
      }

      const warnBox = h('div');
      function paintWarnings() {
        if (!studio.editing) return;
        const issues = contrastIssues({ tokens: studio.draft.tokens });
        warnBox.replaceChildren(...(issues.length ? [h('div', { class: 'sp-note is-warn' }, icon('warning'), h('span', null, 'Low contrast: ' + issues.join(', ') + '. Text may be hard to read.'))] : []));
      }

      function editor() {
        const t = SP.theme.get(studio.sel);
        const rows = {};
        const nameIn = h('input', { class: 'sp-input', value: studio.draft.name, maxlength: 40, disabled: t.builtIn, 'aria-label': 'Theme name' });
        nameIn.addEventListener('input', () => { studio.draft.name = nameIn.value; });
        const quick = h('div', { class: 'sp-quick-accents' }, QUICK_ACCENTS.map(([n, c]) => h('button', {
          type: 'button', class: 'sp-qa', title: n, 'aria-label': 'Use ' + n + ' accent', style: { '--qa': c },
          onclick: () => {
            const onBtn = SP.color.contrast(c, '#000000') > SP.color.contrast(c, '#FFFFFF') ? '#111111' : '#FFFFFF';
            ['primary', 'sliderFill', 'button', 'animation'].forEach((k) => rows[k] && rows[k].setVal(c));
            rows.buttonText && rows.buttonText.setVal(onBtn);
          },
        }, h('i'), h('span', null, n))));

        const groups = SP.TOKEN_SCHEMA.map((g) => h('div', { class: 'sp-tok-group' },
          h('div', { class: 'sp-tok-group-title' }, g.group),
          g.tokens.map((def) => { const r = def.type === 'range' ? rangeRow(def) : colorRow(def); rows[def.key] = r; return r; })));

        const liveToggle = SP.ui.toggle({ value: studio.live, label: 'Live preview across the app', onChange: (v) => {
          studio.live = v; SP.store.set('studio.live', v);
          if (!v) SP.theme.apply(SP.theme.activeId, { animate: false, persist: false }); else paintPreview();
        } });

        const save = () => {
          if (t.builtIn) SP.theme.save(t.id, { tokens: studio.draft.tokens, mode: studio.draft.mode });
          else SP.theme.save(t.id, { name: studio.draft.name, tokens: studio.draft.tokens, mode: studio.draft.mode });
          studio.editing = false; studio.draft = null;
          SP.theme.apply(t.id);
          SP.ui.toast(`${SP.theme.get(t.id).name} saved and applied`);
          paint();
        };
        const saveNew = async () => {
          const name = await SP.ui.dialog({ title: 'Save as new theme', confirmText: 'Save', input: { label: 'Theme name', value: t.builtIn ? t.name + ' Custom' : studio.draft.name + ' Copy' } });
          if (!name) return;
          const n = SP.theme.createCustom({ name, tokens: studio.draft.tokens, mode: studio.draft.mode });
          studio.editing = false; studio.draft = null; studio.sel = n.id;
          SP.theme.apply(n.id);
          SP.ui.toast(`“${n.name}” created and applied`);
          paint();
        };

        const el = h('section', { class: 'sp-card sp-editor' },
          h('header', { class: 'sp-card-head' },
            h('div', { class: 'sp-card-icon' }, icon('edit')),
            h('div', { class: 'sp-card-titles' }, h('h3', null, 'Customize ' + t.name), h('p', null, t.builtIn ? 'Saving keeps your edits on this built-in theme — reset them any time.' : 'Edit your theme. Every page updates together.')),
            SP.ui.button('', { size: 'sm', variant: 'ghost', icon: 'close', title: 'Close editor', onClick: stopEdit })),
          h('div', { class: 'sp-card-body' },
            h('div', { class: 'sp-grid sp-grid-2', style: { gap: '12px' } },
              h('label', { class: 'sp-field' }, h('span', null, 'Name'), nameIn),
              h('div', { class: 'sp-field' }, h('span', null, 'Appearance'), SP.ui.segmented({ value: studio.draft.mode, label: 'Appearance', full: true, options: [['dark', 'Dark'], ['light', 'Light']], onChange: (v) => { studio.draft.mode = v; paintPreview(); } }))),
            h('div', { class: 'sp-tok-group' }, h('div', { class: 'sp-tok-group-title' }, 'Quick accent — sakura & monochrome'), quick),
            groups,
            warnBox,
            h('div', { class: 'sp-editor-foot' },
              h('label', { class: 'sp-inline-toggle' }, liveToggle, h('span', null, 'Live preview across the app')),
              h('div', { class: 'sp-editor-foot-actions' },
                SP.ui.button('Cancel', { variant: 'ghost', onClick: stopEdit }),
                SP.ui.button('Save as new', { icon: 'copy', onClick: saveNew }),
                SP.ui.button('Save & apply', { variant: 'primary', icon: 'save', onClick: save })))));
        return el;
      }

      function paint() {
        left.replaceChildren(...(studio.editing ? [editor()] : library()));
        if (studio.editing) paintWarnings();
        paintPreview(); paintInfo();
      }
      paint();

      return () => {
        // Leaving the page while editing: drop unsaved live preview, keep the saved theme.
        if (studio.editing) { studio.editing = false; studio.draft = null; SP.theme.apply(SP.theme.activeId, { animate: false, persist: false }); }
        cancelAnimationFrame(raf);
      };
    },
  });
})();
