/* Game Profiles — per-application overrides. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;

  const blank = () => ({ id: 'p' + Date.now().toString(36), name: 'New profile', exe: '', preset: 'none', lowLatency: 'on', fpsLimit: 144, vsync: 'app', power: 'balanced', colorOverride: false, vibrance: 50 });

  SP.pages.push({
    id: 'profiles', title: 'Game Profiles', group: 'gaming', icon: 'gamepad',
    search: ['Add profile', 'Executable', 'Profile color preset', 'Low latency mode', 'Max frame rate', 'Profile vertical sync', 'Power mode', 'Override color'],
    render(root) {
      const list = SP.state.draft.profiles;
      let selId = SP.store.get('profiles.selected', list[0] && list[0].id);
      if (!list.some((p) => p.id === selId)) selId = list[0] && list[0].id;
      const idx = list.findIndex((p) => p.id === selId);

      const add = () => {
        const p = blank();
        SP.state.replace('profiles', [...SP.state.draft.profiles, p]);
        SP.store.set('profiles.selected', p.id);
        SP.refresh();
      };

      root.append(SP.ui.pageHeader({
        eyebrow: '3D & Gaming', title: 'Game Profiles', desc: 'Profiles override global settings whenever the matching program is running.',
        actions: [SP.ui.button('Add profile', { icon: 'plus', variant: 'primary', onClick: add })],
      }));

      /* List */
      const filter = h('input', { class: 'sp-input', type: 'search', placeholder: 'Filter profiles', 'aria-label': 'Filter profiles' });
      const items = list.map((p) => h('button', {
        type: 'button', class: 'sp-plist-item' + (p.id === selId ? ' is-active' : ''), 'data-name': p.name.toLowerCase(),
        onclick: () => { SP.store.set('profiles.selected', p.id); SP.refresh(); },
      }, h('span', { class: 'sp-avatar' }, (p.name || '?').slice(0, 1)), h('span', { class: 'sp-mini-text' }, h('strong', { 'data-pname': p.id }, p.name || 'Untitled'), h('small', null, p.exe ? p.exe.split('\\').pop() : 'No program set'))));
      filter.addEventListener('input', () => {
        const q = filter.value.trim().toLowerCase();
        items.forEach((it) => { it.style.display = it.dataset.name.includes(q) ? '' : 'none'; });
      });
      const listCard = h('section', { class: 'sp-card sp-plist' },
        h('div', { class: 'sp-plist-head' }, filter),
        h('div', { class: 'sp-plist-items' }, items.length ? items : h('div', { class: 'sp-empty' }, 'No profiles yet.')),
        h('div', { class: 'sp-plist-foot' }, h('span', { class: 'sp-muted' }, list.length + (list.length === 1 ? ' profile' : ' profiles'))));

      /* Editor */
      let editor;
      if (idx < 0) {
        editor = SP.ui.card({ body: h('div', { class: 'sp-empty-state' }, SP.ui.mark(48), h('h3', null, 'No profile selected'), h('p', { class: 'sp-muted' }, 'Create a profile to tune a game separately from your global settings.'), SP.ui.button('Add profile', { icon: 'plus', variant: 'primary', onClick: add })) });
      } else {
        const base = `profiles.${idx}.`;
        const p = list[idx];
        const nameIn = h('input', { class: 'sp-input', value: p.name, maxlength: 40, 'aria-label': 'Profile name' });
        nameIn.addEventListener('input', () => {
          SP.state.set(base + 'name', nameIn.value);
          const n = root.querySelector(`[data-pname="${p.id}"]`); if (n) n.textContent = nameIn.value || 'Untitled';
        });
        const exeIn = h('input', { class: 'sp-input sp-mono', value: p.exe, placeholder: 'C:\\Path\\to\\game.exe', 'aria-label': 'Executable path' });
        exeIn.addEventListener('input', () => SP.state.set(base + 'exe', exeIn.value));
        const vib = SP.ui.row({ path: base + 'vibrance', label: 'Vibrance override', control: SP.ui.slider({ path: base + 'vibrance', label: 'Vibrance override', min: 0, max: 100, unit: '%', disabled: !p.colorOverride }) });

        editor = SP.ui.card({
          icon: 'gamepad', title: p.name || 'Untitled', desc: 'Overrides global settings while running',
          actions: [
            SP.ui.button('', { size: 'sm', variant: 'ghost', icon: 'copy', title: 'Duplicate profile', onClick: () => {
              const c = { ...JSON.parse(JSON.stringify(p)), id: 'p' + Date.now().toString(36), name: (p.name + ' Copy').slice(0, 40) };
              SP.state.replace('profiles', [...SP.state.draft.profiles, c]); SP.store.set('profiles.selected', c.id); SP.refresh();
            } }),
            SP.ui.button('', { size: 'sm', variant: 'ghost', icon: 'trash', title: 'Delete profile', onClick: async () => {
              if (await SP.ui.dialog({ title: 'Delete profile?', body: `“${p.name}” will be removed when you apply.`, confirmText: 'Delete', danger: true })) {
                SP.state.replace('profiles', SP.state.draft.profiles.filter((x) => x.id !== p.id)); SP.refresh();
              }
            } }),
          ],
          body: [
            h('div', { class: 'sp-grid sp-grid-2', style: { gap: '12px', marginBottom: '6px' } },
              h('label', { class: 'sp-field', 'data-search': 'Profile name' }, h('span', null, 'Name'), nameIn),
              h('label', { class: 'sp-field', 'data-search': 'Executable' }, h('span', null, 'Program'), exeIn)),
            SP.ui.row({ path: base + 'preset', label: 'Profile color preset', desc: 'Colour preset loaded with this game.', control: SP.ui.select({ path: base + 'preset', label: 'Color preset', options: SP.COLOR_PRESETS.map((x) => [x.id, x.name]) }) }),
            SP.ui.row({ path: base + 'lowLatency', label: 'Low latency mode', desc: 'Ultra submits frames just in time for the next refresh.', control: SP.ui.segmented({ path: base + 'lowLatency', label: 'Low latency mode', options: [['off', 'Off'], ['on', 'On'], ['ultra', 'Ultra']] }) }),
            SP.ui.row({ path: base + 'fpsLimit', label: 'Max frame rate', control: SP.ui.slider({ path: base + 'fpsLimit', label: 'Max frame rate', min: 30, max: 360, format: (v) => v + ' FPS' }) }),
            SP.ui.row({ path: base + 'vsync', label: 'Profile vertical sync', control: SP.ui.select({ path: base + 'vsync', label: 'Vertical sync', options: [['app', 'Use application setting'], ['on', 'On'], ['off', 'Off'], ['fast', 'Fast'], ['adaptive', 'Adaptive']] }) }),
            SP.ui.row({ path: base + 'power', label: 'Power mode', adv: true, control: SP.ui.select({ path: base + 'power', label: 'Power mode', options: [['performance', 'Prefer maximum performance'], ['balanced', 'Normal'], ['quiet', 'Optimal power']] }) }),
            SP.ui.row({ path: base + 'colorOverride', label: 'Override color', adv: true, desc: 'Use a different vibrance while this game runs.', control: SP.ui.toggle({ path: base + 'colorOverride', label: 'Override color', onChange: () => SP.refresh() }) }),
            h('div', { class: 'adv-only' }, vib),
          ],
        });
      }

      root.append(h('div', { class: 'sp-profiles' }, listCard, editor));
    },
  });
})();
