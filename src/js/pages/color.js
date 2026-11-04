/* Color Control — desktop colour with a live reference preview. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;

  /** Visual approximation of the colour pipeline for the on-screen preview. */
  SP.colorFilter = function (c) {
    const gammaLift = (c.gamma - 1) * 0.12;
    return `brightness(${(0.5 + c.brightness / 100 + gammaLift).toFixed(3)}) contrast(${(0.5 + c.contrast / 100).toFixed(3)}) saturate(${(c.vibrance / 50).toFixed(3)}) hue-rotate(${c.hue}deg)`;
  };

  function testImage() {
    return h('div', { class: 'sp-testimg' },
      h('div', { class: 'sp-testimg-scene' },
        h('div', { class: 'sp-ti-sky' }), h('div', { class: 'sp-ti-sun' }),
        h('div', { class: 'sp-ti-hill is-1' }), h('div', { class: 'sp-ti-hill is-2' }), h('div', { class: 'sp-ti-hill is-3' }),
        h('div', { class: 'sp-ti-skin' }, h('i'), h('i'), h('i'), h('i'))),
      h('div', { class: 'sp-ti-bars' }, ['#FFFFFF', '#FFFF00', '#00FFFF', '#00FF00', '#FF00FF', '#FF0000', '#0000FF', '#000000'].map((c) => h('i', { style: { background: c } }))),
      h('div', { class: 'sp-ti-ramp' }),
      h('div', { class: 'sp-ti-steps' }, Array.from({ length: 12 }, (_, i) => h('i', { style: { background: `rgb(${i * 4},${i * 4},${i * 4})` } }, String(i * 4)))));
  }

  function curvePath(c, ch) {
    const g = ch === 'all' ? c.gamma : c['gamma' + ch.toUpperCase()] * c.gamma;
    const b = (c.brightness - 50) / 100;
    const k = 0.5 + c.contrast / 100;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const x = i / 40;
      let y = Math.pow(x, 1 / g);
      y = (y - 0.5) * k + 0.5 + b;
      y = Math.max(0, Math.min(1, y));
      pts.push(`${(x * 200).toFixed(1)},${(120 - y * 120).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  SP.pages.push({
    id: 'color', title: 'Color Control', group: 'display', icon: 'color',
    search: ['Brightness', 'Contrast', 'Gamma', 'Digital vibrance', 'Hue', 'Color channel', 'Output color depth', 'Output color format', 'Dynamic range', 'Red gamma', 'Green gamma', 'Blue gamma', 'Color source'],
    advancedTerms: ['Color channel', 'Output color depth', 'Output color format', 'Dynamic range', 'Red gamma', 'Green gamma', 'Blue gamma'],
    render(root) {
      root.append(SP.ui.pageHeader({
        eyebrow: 'Display', title: 'Color Control', desc: 'Tune desktop colour per display. Changes preview live on the reference image and take effect when applied.',
        actions: [SP.ui.button('Restore defaults', { icon: 'reset', variant: 'ghost', onClick: () => { SP.state.resetSection('color'); SP.refresh(); } })],
      }));

      const custom = SP.state.get('color.source') === 'custom';

      const source = SP.ui.card({
        icon: 'display', title: 'Display & source',
        body: [
          SP.ui.row({ path: 'color.display', label: 'Display', desc: 'Settings are stored per display.', control: SP.ui.segmented({ path: 'color.display', label: 'Display', options: SP.DISPLAYS.map((d) => [d.id, d.name]) }) }),
          SP.ui.row({ path: 'color.source', label: 'Color source', desc: 'Let applications control colour, or use your own values.', control: SP.ui.segmented({ path: 'color.source', label: 'Color source', options: [['default', 'Application'], ['custom', 'Custom']], onChange: () => SP.refresh() }) }),
        ],
      });

      const sl = (path, label, o) => SP.ui.row({ path, label, desc: o.desc, adv: o.adv, control: SP.ui.slider({ path, label, disabled: !custom, ...o }) });
      const adjust = SP.ui.card({
        icon: 'sliders', title: 'Adjustments', desc: custom ? 'Double-check with the reference image on the right.' : 'Switch the source to Custom to edit.',
        body: [
          SP.ui.row({ path: 'color.channel', label: 'Color channel', adv: true, desc: 'Apply brightness, contrast and gamma to one channel.', control: SP.ui.segmented({ path: 'color.channel', label: 'Channel', options: [['all', 'All'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']], onChange: updatePreview }) }),
          sl('color.brightness', 'Brightness', { min: 0, max: 100, unit: '%' }),
          sl('color.contrast', 'Contrast', { min: 0, max: 100, unit: '%' }),
          sl('color.gamma', 'Gamma', { min: 0.3, max: 2.8, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
          sl('color.vibrance', 'Digital vibrance', { min: 0, max: 100, unit: '%', desc: 'Boosts colour saturation without clipping skin tones.' }),
          sl('color.hue', 'Hue', { min: -180, max: 180, center: 0, format: (v) => (v > 0 ? '+' : '') + v + '°' }),
        ],
      });

      const output = h('div', { class: 'adv-only' },
        SP.ui.expander({ id: 'color-gamma', icon: 'sliders', title: 'Per-channel gamma', desc: 'Fine-tune grey balance', badge: 'Advanced', body: [
          sl('color.gammaR', 'Red gamma', { min: 0.5, max: 1.5, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
          sl('color.gammaG', 'Green gamma', { min: 0.5, max: 1.5, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
          sl('color.gammaB', 'Blue gamma', { min: 0.5, max: 1.5, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
        ] }),
        SP.ui.expander({ id: 'color-output', icon: 'chip', title: 'Output', desc: 'Signal sent to the display', badge: 'Advanced', body: [
          SP.ui.row({ path: 'color.depth', label: 'Output color depth', control: SP.ui.select({ path: 'color.depth', label: 'Output color depth', options: [['8', '8 bpc'], ['10', '10 bpc'], ['12', '12 bpc']] }) }),
          SP.ui.row({ path: 'color.format', label: 'Output color format', control: SP.ui.select({ path: 'color.format', label: 'Output color format', options: [['RGB', 'RGB'], ['YCbCr422', 'YCbCr 4:2:2'], ['YCbCr444', 'YCbCr 4:4:4']] }) }),
          SP.ui.row({ path: 'color.range', label: 'Dynamic range', desc: 'Use Limited only for TVs that expect 16–235.', control: SP.ui.segmented({ path: 'color.range', label: 'Dynamic range', options: [['full', 'Full'], ['limited', 'Limited']] }) }),
        ] }));

      /* Preview */
      const img = testImage();
      const curve = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      curve.setAttribute('viewBox', '0 0 200 120'); curve.setAttribute('class', 'sp-curve'); curve.setAttribute('preserveAspectRatio', 'none');
      curve.innerHTML = '<path class="grid" d="M50 0V120M100 0V120M150 0V120M0 30H200M0 60H200M0 90H200"/><line class="ref" x1="0" y1="120" x2="200" y2="0"/><polyline class="curve" fill="none"/>';
      const compare = SP.ui.button('Hold to compare', { size: 'sm', icon: 'eye', variant: 'ghost' });
      const down = () => img.classList.add('is-original');
      const up = () => img.classList.remove('is-original');
      compare.addEventListener('pointerdown', down); compare.addEventListener('pointerup', up); compare.addEventListener('pointerleave', up);
      const preview = SP.ui.card({
        icon: 'eye', title: 'Reference preview', class: 'sp-sticky', actions: compare,
        body: [img, h('div', { class: 'sp-curve-wrap adv-only' }, h('div', { class: 'sp-curve-label' }, h('span', null, 'Transfer curve'), h('small', null, 'Input → output')), curve)],
      });

      function updatePreview() {
        const c = SP.state.draft.color;
        img.style.setProperty('--sp-filter', c.source === 'custom' ? SP.colorFilter(c) : 'none');
        curve.querySelector('.curve').setAttribute('points', curvePath(c, c.channel));
        curve.dataset.channel = c.channel;
      }
      updatePreview();
      const off = SP.state.on((type, d) => { if (type !== 'change' || !d || !d.path || d.path.startsWith('color')) updatePreview(); });

      root.append(h('div', { class: 'sp-grid sp-grid-main' }, h('div', { class: 'sp-stack' }, source, adjust, output), h('div', { class: 'sp-stack' }, preview)));
      return off;
    },
  });
})();
