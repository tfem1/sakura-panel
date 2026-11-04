/* Color Control — real display colour adjustments.
 *
 * Every control here drives the display colour engine (electron/color/engine.js):
 *  - Tone + RGB channels  -> hardware gamma ramp of the selected display (per monitor)
 *  - Saturation/vibrance/hue -> Windows colour matrix (all displays)
 * Settings that no Windows API can apply system-wide are shown disabled with the reason.
 */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;
  const CM = SP.colorMath;

  /** Illustration filter for preset thumbnails (Presets page). Not used for the live display. */
  SP.colorFilter = function (c) {
    const gammaLift = (c.gamma - 1) * 0.12;
    return `brightness(${(0.5 + c.brightness / 100 + gammaLift).toFixed(3)}) contrast(${(0.5 + c.contrast / 100).toFixed(3)}) saturate(${(c.vibrance / 50).toFixed(3)}) hue-rotate(${c.hue || 0}deg)`;
  };

  const STATUS = {
    applied: ['Active', 'is-ok'], limited: ['Limited by Windows', 'is-warn'], original: ['Original (no change)', 'is-idle'],
    compare: ['Showing original', 'is-warn'], unavailable: ['Unavailable', 'is-bad'], failed: ['Failed', 'is-bad'],
    mismatch: ['Overridden by another program', 'is-bad'], disconnected: ['Disconnected', 'is-idle'],
  };
  function statusPill(label, res) {
    const [text, cls] = res ? STATUS[res.status] || [res.status, 'is-idle'] : ['Waiting…', 'is-idle'];
    const extra = res && res.status === 'limited' ? ` (${Math.round(res.strength * 100)}%)` : '';
    return h('div', { class: 'sp-engine-pill ' + cls },
      h('i'), h('div', null, h('small', null, label), h('strong', null, text + extra, res && res.verified ? h('span', { class: 'sp-verified', title: 'Read back from Windows and matches' }, icon('check'), 'verified') : null)));
  }

  function testPattern() {
    return h('div', { class: 'sp-testimg' },
      h('div', { class: 'sp-testimg-scene' },
        h('div', { class: 'sp-ti-sky' }), h('div', { class: 'sp-ti-sun' }),
        h('div', { class: 'sp-ti-hill is-1' }), h('div', { class: 'sp-ti-hill is-2' }), h('div', { class: 'sp-ti-hill is-3' }),
        h('div', { class: 'sp-ti-skin' }, h('i'), h('i'), h('i'), h('i'))),
      h('div', { class: 'sp-ti-bars' }, ['#FFFFFF', '#FFFF00', '#00FFFF', '#00FF00', '#FF00FF', '#FF0000', '#0000FF', '#000000'].map((c) => h('i', { style: { background: c } }))),
      h('div', { class: 'sp-ti-ramp' }),
      h('div', { class: 'sp-ti-steps' }, Array.from({ length: 12 }, (_, i) => h('i', { style: { background: `rgb(${i * 4},${i * 4},${i * 4})` } }, String(i * 4)))));
  }

  SP.pages.push({
    id: 'color', title: 'Color Control', group: 'display', icon: 'color',
    search: ['Brightness', 'Contrast', 'Gamma', 'Color temperature', 'Exposure', 'Shadows', 'Highlights', 'Black level', 'White level',
      'Red gain', 'Green gain', 'Blue gain', 'Red offset', 'Green offset', 'Blue offset', 'Red gamma', 'Green gamma', 'Blue gamma',
      'Saturation', 'Digital vibrance', 'Hue', 'Sharpness', 'Color source', 'Restore original colors', 'Display self-test', 'Compare before and after'],
    advancedTerms: ['Exposure', 'Shadows', 'Highlights', 'Black level', 'White level'],
    render(root) {
      const E = SP.colorEngine;
      const st = E.status;
      const real = !!(E.available && st && st.supported);
      const key = SP.colorKey();
      const D = SP.DISPLAYS.find((d) => d.id === key) || SP.DISPLAYS[0];
      const tp = (f) => SP.tonePath(f, key);
      const tone = SP.state.get('color.displays.' + key);
      const custom = tone.source !== 'default';
      const info = E.displayInfo(key);
      const hdrOn = !!(info && info.hdr && info.hdr.enabled);
      const toneOff = !custom || hdrOn;
      const matrixInfo = st && st.matrix;
      const matrixOff = real && matrixInfo && !matrixInfo.ok;

      /* ---------- header ---------- */
      const resetBtn = SP.ui.button('Reset adjustments', { icon: 'reset', variant: 'ghost', title: 'Stage neutral values for this display and the global colour section', onClick: () => {
        for (const k of Object.keys(CM.TONE_DEFAULTS)) SP.state.set(tp(k), CM.TONE_DEFAULTS[k]);
        for (const k of Object.keys(CM.GLOBAL_DEFAULTS)) SP.state.set('color.global.' + k, CM.GLOBAL_DEFAULTS[k]);
        SP.refresh();
      } });
      const restoreBtn = SP.ui.button('Restore original', { icon: 'display', title: 'Put every display back exactly as it was before SAKURA PANEL changed it', disabled: !real, onClick: async () => {
        if (!(await SP.ui.dialog({ title: 'Restore original colours?', body: 'Every display goes back to the gamma ramp it had before SAKURA PANEL changed it, the colour matrix is removed, and all colour settings return to neutral.', confirmText: 'Restore' }))) return;
        const r = await E.restoreOriginal();
        SP.ui.toast(r && r.ok ? 'Original colours restored and verified' : 'Restore reported a problem: see the status panel', { type: r && r.ok ? 'success' : 'error', duration: 5000 });
      } });
      root.append(SP.ui.pageHeader({
        eyebrow: 'Display', title: 'Color Control',
        desc: 'Changes reach your display live while you drag. Apply saves them (and restores them at the next launch). Discard puts the previous values back.',
        actions: [resetBtn, restoreBtn],
      }));

      /* ---------- engine banner ---------- */
      const pills = h('div', { class: 'sp-engine-pills' });
      const engineMsg = h('div', { class: 'sp-engine-msgs' });
      let banner;
      if (!E.available) {
        banner = h('div', { class: 'sp-note is-warn sp-engine-banner' }, icon('warning'), h('span', null, h('strong', null, 'Preview build — your screen will not change. '), 'Display colour control runs in the SAKURA PANEL Windows app (install with the one-line PowerShell command). In a browser there is no access to the display driver.'));
      } else if (!real) {
        banner = h('div', { class: 'sp-note is-warn sp-engine-banner' }, icon('warning'), h('span', null, h('strong', null, 'Display colour control unavailable. '), (st && st.reason) || 'The colour engine did not start.'));
      } else {
        banner = h('section', { class: 'sp-card sp-engine' }, pills, engineMsg);
      }
      function paintEngine() {
        if (!real) return;
        const r = E.results || {};
        const dr = r.displays ? r.displays[key] : null;
        pills.replaceChildren(statusPill('Gamma ramp · ' + (D ? D.name : 'display'), dr), statusPill('Colour matrix · all displays', r.matrix || null));
        const msgs = [];
        if (dr && dr.message) msgs.push(dr.message);
        if (r.matrix && r.matrix.message) msgs.push('Colour matrix: ' + r.matrix.message);
        engineMsg.replaceChildren(...msgs.map((m) => h('div', { class: 'sp-note is-warn' }, icon('warning'), h('span', null, m))));
      }

      /* ---------- display & source ---------- */
      const displayCtl = SP.DISPLAYS.length > 3
        ? SP.ui.select({ path: 'color.display', label: 'Display', options: SP.DISPLAYS.map((d) => [d.id, d.name]), onChange: () => SP.refresh() })
        : SP.ui.segmented({ path: 'color.display', label: 'Display', options: SP.DISPLAYS.map((d) => [d.id, d.name.length > 22 ? d.name.slice(0, 21) + '…' : d.name]), onChange: () => SP.refresh() });
      const source = SP.ui.card({
        icon: 'display', title: 'Display & source', desc: D ? D.model : '',
        body: [
          SP.ui.row({ path: 'color.display', label: 'Display', desc: 'Tone and RGB settings are stored and applied per display.', control: displayCtl }),
          SP.ui.row({ path: tp('source'), label: 'Color source', desc: 'SAKURA PANEL applies your values; Windows leaves this display exactly as it was.', control: SP.ui.segmented({ path: tp('source'), label: 'Color source', options: [['default', 'Windows'], ['custom', 'SAKURA PANEL']], onChange: () => SP.refresh() }) }),
        ],
      });

      /* ---------- tone (gamma ramp) ---------- */
      const sl = (field, label, o) => SP.ui.row({ path: tp(field), label, desc: o.desc, adv: o.adv, control: SP.ui.slider({ path: tp(field), label, disabled: toneOff, ...o }) });
      const pct0 = (v) => (v > 0 ? '+' : '') + v + '%';
      const toneCard = SP.ui.card({
        icon: 'sun', title: 'Tone', desc: 'Hardware gamma ramp · this display only · everything on screen, including most full-screen games',
        body: [
          hdrOn ? h('div', { class: 'sp-note is-warn', style: { marginBottom: '8px' } }, icon('warning'), h('span', null, 'HDR / Advanced Color is on for this display. Windows does not apply gamma ramps in that mode, so tone and RGB settings cannot take effect. Turn HDR off in Windows Settings › System › Display to use them.')) : null,
          !custom ? h('div', { class: 'sp-note', style: { marginBottom: '8px' } }, icon('info'), h('span', null, 'Color source is set to Windows: this display is left untouched. Switch to SAKURA PANEL to adjust it.')) : null,
          sl('brightness', 'Brightness', { min: 0, max: 100, center: 50, unit: '%' }),
          sl('contrast', 'Contrast', { min: 0, max: 100, center: 50, unit: '%' }),
          sl('gamma', 'Gamma', { min: 0.3, max: 2.8, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
          sl('temperature', 'Color temperature', { min: 3000, max: 10000, step: 100, center: 6500, format: (v) => v + ' K', desc: '6500 K is neutral. Lower is warmer.' }),
          sl('exposure', 'Exposure', { adv: true, min: -2, max: 2, step: 0.05, center: 0, format: (v) => (v > 0 ? '+' : '') + v.toFixed(2) + ' EV' }),
          sl('shadows', 'Shadows', { adv: true, min: -100, max: 100, center: 0, format: pct0 }),
          sl('highlights', 'Highlights', { adv: true, min: -100, max: 100, center: 0, format: pct0 }),
          sl('blackLevel', 'Black level', { adv: true, min: 0, max: 40, unit: '%', desc: 'Raises the darkest output level.' }),
          sl('whiteLevel', 'White level', { adv: true, min: 60, max: 100, unit: '%', desc: 'Lowers the brightest output level.' }),
        ],
      });

      const rgb = SP.ui.expander({ id: 'color-rgb', icon: 'sliders', title: 'RGB channels', desc: 'Gain, offset and gamma per channel · hardware gamma ramp · this display', body: [
        sl('gainR', 'Red gain', { min: 50, max: 150, center: 100, unit: '%' }),
        sl('gainG', 'Green gain', { min: 50, max: 150, center: 100, unit: '%' }),
        sl('gainB', 'Blue gain', { min: 50, max: 150, center: 100, unit: '%' }),
        sl('offsetR', 'Red offset', { min: -50, max: 50, center: 0, format: pct0 }),
        sl('offsetG', 'Green offset', { min: -50, max: 50, center: 0, format: pct0 }),
        sl('offsetB', 'Blue offset', { min: -50, max: 50, center: 0, format: pct0 }),
        sl('gammaR', 'Red gamma', { min: 0.5, max: 1.5, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
        sl('gammaG', 'Green gamma', { min: 0.5, max: 1.5, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
        sl('gammaB', 'Blue gamma', { min: 0.5, max: 1.5, step: 0.01, center: 1, format: (v) => v.toFixed(2) }),
      ] });

      /* ---------- colour (matrix) ---------- */
      const gl = (field, label, o) => SP.ui.row({ path: 'color.global.' + field, label, desc: o.desc, control: SP.ui.slider({ path: 'color.global.' + field, label, disabled: matrixOff, ...o }) });
      const colorCard = SP.ui.card({
        icon: 'color', title: 'Color', desc: 'Windows colour matrix · all displays · desktop, windowed and borderless games',
        body: [
          matrixOff ? h('div', { class: 'sp-note is-warn', style: { marginBottom: '8px' } }, icon('warning'), h('span', null, matrixInfo.reason)) : null,
          gl('saturation', 'Saturation', { min: 0, max: 200, center: 100, unit: '%' }),
          gl('vibrance', 'Digital vibrance', { min: 0, max: 100, center: 50, unit: '%', desc: 'Applied as a linear saturation boost. Driver vibrance that protects already-saturated colours needs the NVIDIA/AMD driver API, which is not used.' }),
          gl('hue', 'Hue', { min: -180, max: 180, center: 0, format: (v) => (v > 0 ? '+' : '') + v + '°' }),
          h('div', { class: 'sp-note', style: { marginTop: '10px' } }, icon('info'), h('span', null, 'Processed by the Windows compositor. Exclusive full-screen games and protected video can bypass it; tone and RGB settings (gamma ramp) still apply there.')),
        ],
      });

      /* ---------- not available ---------- */
      const bits = info && info.hdr ? `${info.hdr.bitsPerChannel || '?'} bits per channel · HDR ${info.hdr.enabled ? 'on' : 'off'}${info.hdr.supported ? '' : ' (not supported)'}` : 'Not reported';
      const unsupported = SP.ui.card({
        icon: 'info', title: 'Not available system-wide',
        body: [
          SP.ui.row({ label: 'Sharpness', desc: 'Sharpening is a spatial filter. Windows has no API that sharpens the whole desktop; vendor sharpening (NVIDIA NIS, AMD RIS) only works inside games through the driver, which SAKURA PANEL does not control. The setting is not offered rather than faked.', control: SP.ui.slider({ value: 0, min: 0, max: 100, unit: '%', label: 'Sharpness', disabled: true }) }),
          SP.ui.row({ label: 'Output color depth / format / range', desc: 'Read-only. Changing them requires the NVIDIA or AMD driver API.', control: h('span', { class: 'sp-readonly' }, bits) }),
        ],
      });

      /* ---------- right column: real display, compare, curve ---------- */
      const compare = SP.ui.button('Hold to compare', { size: 'sm', icon: 'eye', variant: 'ghost', disabled: !real, title: real ? 'Shows the original display output while held' : 'Needs the Windows app' });
      let holding = false;
      const down = () => { if (!real || holding) return; holding = true; compare.classList.add('is-active'); E.compare(true); };
      const up = () => { if (!holding) return; holding = false; compare.classList.remove('is-active'); E.compare(false); };
      compare.addEventListener('pointerdown', down);
      compare.addEventListener('pointerup', up);
      compare.addEventListener('pointerleave', up);
      compare.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); down(); } });
      compare.addEventListener('keyup', up);

      const curve = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      curve.setAttribute('viewBox', '0 0 200 120'); curve.setAttribute('class', 'sp-curve'); curve.setAttribute('preserveAspectRatio', 'none');
      curve.innerHTML = '<path class="grid" d="M50 0V120M100 0V120M150 0V120M0 30H200M0 60H200M0 90H200"/><line class="ref" x1="0" y1="120" x2="200" y2="0"/><polyline class="curve is-r" fill="none"/><polyline class="curve is-g" fill="none"/><polyline class="curve is-b" fill="none"/>';
      function paintCurve() {
        const t = SP.state.get('color.displays.' + key);
        const ramp = t.source === 'default' ? CM.identityRamp() : CM.buildRamp(t);
        ['r', 'g', 'b'].forEach((c) => {
          const pts = [];
          for (let i = 0; i < 256; i += 5) pts.push(`${((i / 255) * 200).toFixed(1)},${(120 - (ramp[c][i] / 65535) * 120).toFixed(1)}`);
          pts.push(`200,${(120 - (ramp[c][255] / 65535) * 120).toFixed(1)}`);
          curve.querySelector('.is-' + c).setAttribute('points', pts.join(' '));
        });
      }
      paintCurve();

      const preview = SP.ui.card({
        icon: 'eye', title: 'Your display', class: 'sp-sticky', actions: compare,
        body: [
          testPattern(),
          h('p', { class: 'sp-caption' }, real
            ? 'This pattern is drawn without any filter. When it changes, your real display output changed. Hold “Compare” to see the original output.'
            : 'Reference pattern. In this preview build it never changes, because nothing reaches the display.'),
          h('div', { class: 'sp-curve-wrap' }, h('div', { class: 'sp-curve-label' }, h('span', null, 'Gamma ramp for this display'), h('small', null, 'R · G · B, input → output')), curve),
        ],
      });

      /* ---------- self-test ---------- */
      const testOut = h('div', { class: 'sp-selftest' });
      const testBtn = SP.ui.button('Run display self-test', { icon: 'activity', disabled: !real, onClick: async () => {
        if (!(await SP.ui.dialog({ title: 'Run display self-test?', body: `Your screen will change colour briefly for each test (about ${Math.max(1, SP.DISPLAYS.length) * 5} seconds). Every result is read back from Windows. Your current settings are put back afterwards.`, confirmText: 'Run test' }))) return;
        testBtn.disabled = true;
        testOut.replaceChildren();
        const report = await E.selfTest((r) => testOut.appendChild(stepRow(r)));
        testBtn.disabled = false;
        if (report) {
          testOut.prepend(h('div', { class: 'sp-selftest-sum ' + (report.failed ? 'is-bad' : 'is-ok') }, `${report.displays} display(s): ${report.passed} passed · ${report.failed} failed · ${report.unavailable} unavailable`));
          SP.ui.toast(report.failed ? 'Self-test found problems' : 'Self-test passed', { type: report.failed ? 'error' : 'success' });
        }
      } });
      const stepRow = (r) => h('div', { class: 'sp-selftest-row is-' + r.status },
        h('span', { class: 'sp-selftest-st' }, r.status === 'pass' ? '✓' : r.status === 'fail' ? '✕' : '–'),
        h('div', null, h('strong', null, r.name), h('small', null, r.display + (r.detail ? ' · ' + r.detail : ''))));
      const testCard = SP.ui.card({ icon: 'activity', title: 'Display self-test', desc: 'Applies each adjustment for real and checks what Windows reports back', body: [h('div', { 'data-search': 'Display self-test' }, testBtn), testOut] });

      root.append(banner, h('div', { class: 'sp-grid sp-grid-main', style: { marginTop: '16px' } },
        h('div', { class: 'sp-stack' }, source, toneCard, rgb, colorCard, unsupported),
        h('div', { class: 'sp-stack' }, preview, testCard)));

      paintEngine();
      const offE = E.on((type) => { if (type === 'results' || type === 'status') paintEngine(); });
      const offS = SP.state.on((type, d) => { if (type !== 'change' || !d || !d.path || d.path.startsWith('color')) paintCurve(); });
      return () => { offE(); offS(); if (holding) up(); };
    },
  });
})();
