/* Dashboard — at-a-glance status and the most common adjustments. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;

  function themeDots() {
    const wrap = h('div', { class: 'sp-theme-dots' });
    const paint = () => {
      wrap.replaceChildren(...SP.theme.list().filter((t) => t.builtIn).map((t) => {
        const b = h('button', {
          type: 'button', class: 'sp-theme-dot' + (t.id === SP.theme.activeId ? ' is-active' : ''), title: t.name, 'aria-label': 'Apply ' + t.name,
          style: { '--d-bg': t.tokens.background, '--d-a': t.tokens.primary, '--d-b': t.tokens.panelRaised },
          onclick: () => { SP.theme.apply(t.id); },
        }, h('i'));
        return b;
      }));
    };
    paint();
    return { el: wrap, paint };
  }

  SP.pages.push({
    id: 'dashboard', title: 'Dashboard', group: 'overview', icon: 'dashboard',
    search: ['Quick adjust', 'GPU status', 'Theme quick switch', 'Active profiles'],
    render(root) {
      const d = SP.DISPLAYS.find((x) => x.id === SP.colorKey()) || SP.DISPLAYS[0];
      const E = SP.colorEngine;
      const live = !!(E.available && E.status && E.status.supported);
      const dInfo = E.displayInfo(d.id);
      const quickOff = SP.state.get(SP.tonePath('source')) === 'default' || !!(dInfo && dInfo.hdr && dInfo.hdr.enabled);
      const gpu = live && E.status.gpus && E.status.gpus[0];
      const hour = new Date().getHours();
      const greet = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

      root.append(SP.ui.pageHeader({
        eyebrow: 'Overview', title: greet, desc: 'Your display and graphics at a glance. Quick adjustments are staged until you press Apply.',
        actions: [SP.ui.button('Presets', { icon: 'presets', onClick: () => SP.go('presets') }), SP.ui.button('Theme Studio', { icon: 'palette', onClick: () => SP.go('themes') })],
      }));

      /* Hero */
      const hero = h('section', { class: 'sp-card sp-hero' },
        h('div', { class: 'sp-hero-id' },
          h('div', { class: 'sp-hero-mark' }, SP.ui.mark(46)),
          h('div', null,
            h('div', { class: 'sp-hero-kicker' }, 'Graphics adapter'),
            h('h2', null, gpu ? gpu.name : 'Graphics adapter', gpu ? null : h('span', null, ' · not detected in this preview')),
            h('div', { class: 'sp-hero-meta' },
              h('span', { class: 'sp-chip', title: live ? 'Display colour engine connected to Windows' : 'Preview build: no access to the display' }, h('i', { class: live ? 'is-ok' : 'is-off' }), live ? 'Colour engine active' : 'Colour engine offline'),
              h('span', { class: 'sp-chip' }, icon('display'), d.name + ' · ' + d.model),
              h('span', { class: 'sp-chip' }, icon('gamepad'), 'Profile: Global')))),
        h('div', { class: 'sp-hero-sim' }, icon('info'), 'Load, temperature, clock and VRAM below are simulated: no driver telemetry backend yet.'),
        h('div', { class: 'sp-grid sp-grid-4 sp-hero-stats' },
          SP.ui.stat({ id: 'load', icon: 'activity', label: 'GPU load', value: '—', unit: '%', meter: 0 }),
          SP.ui.stat({ id: 'temp', icon: 'temp', label: 'Temperature', value: '—', unit: '°C', meter: 0 }),
          SP.ui.stat({ id: 'clock', icon: 'chip', label: 'Core clock', value: '—', unit: 'MHz', meter: 0 }),
          SP.ui.stat({ id: 'vram', icon: 'memory', label: 'VRAM used', value: '—', unit: 'GB', meter: 0 })));

      /* Quick adjust */
      const quick = SP.ui.card({
        icon: 'sun', title: 'Quick adjust', desc: (live ? 'Live on ' : 'Saved for ') + d.name + ' · vibrance applies to all displays',
        actions: SP.ui.button('Color Control', { size: 'sm', variant: 'ghost', icon: 'chevron', iconAfter: true, onClick: () => SP.go('color') }),
        body: [
          SP.ui.row({ path: SP.tonePath('brightness'), label: 'Brightness', control: SP.ui.slider({ path: SP.tonePath('brightness'), min: 0, max: 100, center: 50, unit: '%', disabled: quickOff }) }),
          SP.ui.row({ path: SP.tonePath('contrast'), label: 'Contrast', control: SP.ui.slider({ path: SP.tonePath('contrast'), min: 0, max: 100, center: 50, unit: '%', disabled: quickOff }) }),
          SP.ui.row({ path: 'color.global.vibrance', label: 'Digital vibrance', control: SP.ui.slider({ path: 'color.global.vibrance', min: 0, max: 100, center: 50, unit: '%' }) }),
          SP.ui.row({ path: SP.tonePath('gamma'), label: 'Gamma', adv: true, control: SP.ui.slider({ path: SP.tonePath('gamma'), min: 0.3, max: 2.8, step: 0.01, center: 1, format: (v) => v.toFixed(2), disabled: quickOff }) }),
        ],
      });

      /* Activity */
      const svgNS = 'http://www.w3.org/2000/svg';
      const spark = document.createElementNS(svgNS, 'svg');
      spark.setAttribute('viewBox', '0 0 300 72'); spark.setAttribute('preserveAspectRatio', 'none'); spark.setAttribute('class', 'sp-spark');
      const area = document.createElementNS(svgNS, 'polygon'); area.setAttribute('class', 'sp-spark-area');
      const line = document.createElementNS(svgNS, 'polyline'); line.setAttribute('class', 'sp-spark-line');
      const line2 = document.createElementNS(svgNS, 'polyline'); line2.setAttribute('class', 'sp-spark-line is-2');
      spark.append(area, line, line2);
      const activity = SP.ui.card({
        icon: 'activity', title: 'Activity', desc: 'Last 60 seconds',
        actions: h('div', { class: 'sp-legend' }, h('span', null, h('i', { class: 'is-1' }), 'Load'), h('span', null, h('i', { class: 'is-2' }), 'Temperature')),
        body: h('div', { class: 'sp-spark-wrap' }, spark),
      });

      /* Display */
      const vrr = SP.state.getApplied('display.vrr');
      const hdr = dInfo && dInfo.hdr ? dInfo.hdr.enabled : SP.state.getApplied('display.hdr');
      const display = SP.ui.card({
        icon: 'display', title: 'Display', desc: d.name + (d.primary ? ' · Primary' : ''),
        actions: SP.ui.button('', { size: 'sm', variant: 'ghost', icon: 'chevron', title: 'Display Settings', onClick: () => SP.go('display') }),
        body: h('div', { class: 'sp-kv' },
          h('div', null, h('span', null, 'Resolution'), h('strong', null, (d.real ? d.resolutions[0] : SP.state.getApplied('display.resolution')).replace('x', ' × '))),
          h('div', null, h('span', null, 'Refresh rate'), h('strong', null, (d.real ? d.refresh[0] : SP.state.getApplied('display.refresh')) + ' Hz')),
          d.real
            ? h('div', null, h('span', null, 'Bits per channel'), h('strong', null, dInfo && dInfo.hdr && dInfo.hdr.bitsPerChannel ? dInfo.hdr.bitsPerChannel + ' bpc' : '—'))
            : h('div', null, h('span', null, 'Variable refresh'), h('strong', { class: vrr ? 'is-on' : '' }, vrr ? 'On' : 'Off')),
          h('div', null, h('span', null, 'HDR'), h('strong', { class: hdr ? 'is-on' : '' }, hdr ? 'On' : 'Off'))),
      });

      /* Profiles */
      const profs = SP.state.getApplied('profiles').slice(0, 3);
      const profiles = SP.ui.card({
        icon: 'gamepad', title: 'Game profiles', desc: SP.state.getApplied('profiles').length + ' configured',
        actions: SP.ui.button('', { size: 'sm', variant: 'ghost', icon: 'chevron', title: 'Game Profiles', onClick: () => SP.go('profiles') }),
        body: h('div', { class: 'sp-mini-list' }, profs.map((p) => h('button', { type: 'button', class: 'sp-mini-item', onclick: () => { SP.store.set('profiles.selected', p.id); SP.go('profiles'); } },
          h('span', { class: 'sp-avatar' }, p.name.slice(0, 1)),
          h('span', { class: 'sp-mini-text' }, h('strong', null, p.name), h('small', null, (SP.COLOR_PRESETS.find((x) => x.id === p.preset) || SP.COLOR_PRESETS[0]).name + ' · ' + p.fpsLimit + ' FPS cap')),
          icon('chevron')))),
      });

      /* Theme quick switch */
      const dots = themeDots();
      const themeCard = SP.ui.card({
        icon: 'palette', title: 'Theme', desc: 'One click applies instantly',
        actions: SP.ui.button('', { size: 'sm', variant: 'ghost', icon: 'chevron', title: 'Theme Studio', onClick: () => SP.go('themes') }),
        body: dots.el,
      });

      root.append(hero, h('div', { class: 'sp-grid sp-grid-main', style: { marginTop: '16px' } },
        h('div', { class: 'sp-stack' }, quick, activity),
        h('div', { class: 'sp-stack' }, display, themeCard, profiles)));

      const unTheme = SP.theme.on(dots.paint);
      const unTel = SP.telemetry.subscribe((s, hist) => {
        const set = (id, v, pct) => {
          const n = root.querySelector(`[data-stat="${id}"]`); if (n) n.textContent = v;
          const m = root.querySelector(`[data-meter="${id}"]`); if (m) m.style.width = pct + '%';
        };
        set('load', Math.round(s.load), s.load);
        set('temp', Math.round(s.temp), (s.temp / 95) * 100);
        set('clock', Math.round(s.clock), (s.clock / 2900) * 100);
        set('vram', s.vram.toFixed(1), (s.vram / 16) * 100);
        const a = SP.sparkline(hist.load, { min: 0, max: 100, w: 300, hgt: 72 });
        const b = SP.sparkline(hist.temp, { min: 20, max: 100, w: 300, hgt: 72, area: false });
        line.setAttribute('points', a.line); area.setAttribute('points', a.area); line2.setAttribute('points', b.line);
      });
      return () => { unTheme(); unTel(); };
    },
  });
})();
