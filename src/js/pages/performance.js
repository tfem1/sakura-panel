/* Performance — monitoring, power, cooling and (advanced) clock offsets. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;
  const NS = 'http://www.w3.org/2000/svg';

  const SERIES = [
    { key: 'load', label: 'Load', unit: '%', min: 0, max: 100, color: 'var(--sp-primary)' },
    { key: 'temp', label: 'Temperature', unit: '°C', min: 20, max: 100, color: 'var(--sp-accent)' },
    { key: 'clock', label: 'Core clock', unit: 'MHz', min: 300, max: 2900, color: 'var(--sp-secondary)' },
    { key: 'fps', label: 'Frame rate', unit: 'FPS', min: 0, max: 360, color: 'var(--sp-text-muted)' },
  ];

  SP.pages.push({
    id: 'performance', title: 'Performance', group: 'system', icon: 'activity',
    search: ['Monitoring', 'Power limit', 'Temperature target', 'Fan control', 'Fan speed', 'Core clock offset', 'Memory clock offset'],
    advancedTerms: ['Temperature target', 'Core clock offset', 'Memory clock offset'],
    render(root) {
      root.append(SP.ui.pageHeader({
        eyebrow: 'System', title: 'Performance', desc: 'Live monitoring and power tuning. Telemetry is simulated until a hardware backend is connected.',
        actions: [SP.ui.button('Restore defaults', { icon: 'reset', variant: 'ghost', onClick: () => { SP.state.resetSection('performance'); SP.refresh(); } })],
      }));

      const shown = new Set(SP.store.get('perf.series', ['load', 'temp']));
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 600 180'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'sp-chart');
      svg.innerHTML = '<g class="grid">' + [36, 72, 108, 144].map((y) => `<line x1="0" x2="600" y1="${y}" y2="${y}"/>`).join('') + '</g>';
      const lines = {};
      SERIES.forEach((s) => {
        const l = document.createElementNS(NS, 'polyline');
        l.setAttribute('class', 'sp-chart-line'); l.style.stroke = s.color; l.style.display = shown.has(s.key) ? '' : 'none';
        svg.appendChild(l); lines[s.key] = l;
      });
      const legend = h('div', { class: 'sp-legend-toggles' }, SERIES.map((s) => {
        const b = h('button', { type: 'button', class: 'sp-legend-btn', 'aria-pressed': String(shown.has(s.key)), style: { '--c': s.color } }, h('i'), s.label, h('b', { 'data-live': s.key }, '—'), h('small', null, s.unit));
        b.addEventListener('click', () => {
          if (shown.has(s.key)) shown.delete(s.key); else shown.add(s.key);
          b.setAttribute('aria-pressed', String(shown.has(s.key)));
          lines[s.key].style.display = shown.has(s.key) ? '' : 'none';
          SP.store.set('perf.series', [...shown]);
        });
        return b;
      }));
      const monitor = SP.ui.card({ icon: 'activity', title: 'Monitoring', desc: 'Updated every second', body: h('div', { 'data-search': 'Monitoring' }, legend, h('div', { class: 'sp-chart-wrap' }, svg)) });

      const power = SP.ui.card({
        icon: 'bolt', title: 'Power & thermals',
        body: [
          SP.ui.row({ path: 'performance.powerLimit', label: 'Power limit', desc: 'Relative to the board’s default power target.', control: SP.ui.slider({ path: 'performance.powerLimit', label: 'Power limit', min: 50, max: 120, center: 100, unit: '%' }) }),
          SP.ui.row({ path: 'performance.tempTarget', label: 'Temperature target', adv: true, control: SP.ui.slider({ path: 'performance.tempTarget', label: 'Temperature target', min: 65, max: 90, format: (v) => v + ' °C' }) }),
        ],
      });

      const manual = SP.state.get('performance.fanMode') === 'manual';
      const cooling = SP.ui.card({
        icon: 'fan', title: 'Cooling',
        body: [
          SP.ui.row({ path: 'performance.fanMode', label: 'Fan control', control: SP.ui.segmented({ path: 'performance.fanMode', label: 'Fan control', options: [['auto', 'Automatic'], ['manual', 'Manual']], onChange: () => SP.refresh() }) }),
          SP.ui.row({ path: 'performance.fanSpeed', label: 'Fan speed', desc: manual ? 'Fixed speed while manual control is on.' : 'Switch to Manual to set a fixed speed.', control: SP.ui.slider({ path: 'performance.fanSpeed', label: 'Fan speed', min: 30, max: 100, unit: '%', disabled: !manual }) }),
        ],
      });

      const oc = h('div', { class: 'adv-only', style: { marginTop: '16px' } }, SP.ui.expander({ id: 'perf-oc', icon: 'chip', title: 'Clock offsets', desc: 'For experienced users', badge: 'Advanced', body: [
        h('div', { class: 'sp-note is-warn', style: { margin: '12px 0 4px' } }, icon('warning'), h('span', null, 'Offsets beyond your card’s stable range can cause crashes. Increase in small steps and test after each change.')),
        SP.ui.row({ path: 'performance.coreOffset', label: 'Core clock offset', control: SP.ui.slider({ path: 'performance.coreOffset', label: 'Core clock offset', min: -200, max: 250, step: 5, center: 0, format: (v) => (v > 0 ? '+' : '') + v + ' MHz' }) }),
        SP.ui.row({ path: 'performance.memOffset', label: 'Memory clock offset', control: SP.ui.slider({ path: 'performance.memOffset', label: 'Memory clock offset', min: -500, max: 1500, step: 25, center: 0, format: (v) => (v > 0 ? '+' : '') + v + ' MHz' }) }),
      ] }));

      root.append(monitor, h('div', { class: 'sp-grid sp-grid-2', style: { marginTop: '16px' } }, power, cooling), oc);

      return SP.telemetry.subscribe((s, hist) => {
        SERIES.forEach((se) => {
          lines[se.key].setAttribute('points', SP.sparkline(hist[se.key], { min: se.min, max: se.max, w: 600, hgt: 180, area: false }).line);
          const n = root.querySelector(`[data-live="${se.key}"]`);
          if (n) n.textContent = Math.round(s[se.key]);
        });
      });
    },
  });
})();
