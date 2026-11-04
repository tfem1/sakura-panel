/* Display Settings — arrangement, resolution, refresh, VRR/HDR and scaling. */
(function () {
  const SP = window.SP;
  const { h, icon } = SP.ui;

  SP.pages.push({
    id: 'display', title: 'Display Settings', group: 'display', icon: 'display',
    search: ['Resolution', 'Refresh rate', 'Variable refresh rate', 'VRR in windowed mode', 'HDR', 'Rotation', 'Scaling', 'Scaling mode', 'Overscan', 'Monitor arrangement'],
    advancedTerms: ['VRR in windowed mode', 'Scaling', 'Scaling mode', 'Overscan'],
    render(root) {
      const activeId = SP.state.get('display.active');
      const d = SP.DISPLAYS.find((x) => x.id === activeId) || SP.DISPLAYS[0];
      if (!d.resolutions.includes(SP.state.get('display.resolution'))) SP.state.set('display.resolution', d.resolutions[0]);
      if (!d.refresh.includes(SP.state.get('display.refresh'))) SP.state.set('display.refresh', d.refresh[d.refresh.length - 1]);

      root.append(SP.ui.pageHeader({
        eyebrow: 'Display', title: 'Display Settings', desc: 'Choose a display, then set its mode. Unsupported combinations are hidden automatically.',
        actions: [SP.ui.button('Identify', { icon: 'info', variant: 'ghost', onClick: () => SP.ui.toast('Identify: numbers shown on each display', { type: 'info' }) })],
      }));

      /* Arrangement */
      const arr = h('div', { class: 'sp-arrange' }, SP.DISPLAYS.map((x, i) => h('button', {
        type: 'button', class: 'sp-monitor' + (x.id === d.id ? ' is-active' : ''), 'aria-pressed': String(x.id === d.id),
        style: { '--w': x.w * 7 + 'px', '--h': (x.w * 7) / x.ratio + 'px' },
        onclick: () => { SP.state.set('display.active', x.id); SP.refresh(); },
      }, h('span', { class: 'sp-monitor-n' }, String(i + 1)), h('span', { class: 'sp-monitor-name' }, x.name), x.primary ? h('span', { class: 'sp-monitor-primary' }, icon('star'), 'Primary') : null)));
      const arrangement = SP.ui.card({ icon: 'layers', title: 'Monitor arrangement', desc: 'Select a display to configure', body: h('div', { 'data-search': 'Monitor arrangement' }, arr, h('div', { class: 'sp-monitor-caption' }, d.name + ' · ' + d.model)) });

      const res = SP.ui.card({
        icon: 'display', title: 'Mode', desc: d.name,
        body: [
          SP.ui.row({ path: 'display.resolution', label: 'Resolution', control: SP.ui.select({ path: 'display.resolution', label: 'Resolution', options: d.resolutions.map((r) => [r, r.replace('x', ' × ') + (r === d.resolutions[d.id === 'd1' ? 1 : 0] ? '  (native)' : '')]) }) }),
          SP.ui.row({ path: 'display.refresh', label: 'Refresh rate', control: SP.ui.segmented({ path: 'display.refresh', label: 'Refresh rate', options: d.refresh.map((r) => [r, r + ' Hz']) }) }),
          SP.ui.row({ path: 'display.rotation', label: 'Rotation', control: SP.ui.segmented({ path: 'display.rotation', label: 'Rotation', options: [['0', '0°'], ['90', '90°'], ['180', '180°'], ['270', '270°']] }) }),
        ],
      });

      const features = SP.ui.card({
        icon: 'sparkle', title: 'Features',
        body: [
          SP.ui.row({ path: 'display.vrr', label: 'Variable refresh rate', desc: 'Matches refresh to frame rate to remove tearing and stutter.', control: SP.ui.toggle({ path: 'display.vrr', label: 'Variable refresh rate' }) }),
          SP.ui.row({ path: 'display.vrrWindowed', label: 'VRR in windowed mode', adv: true, desc: 'Also enable for borderless and windowed apps.', control: SP.ui.toggle({ path: 'display.vrrWindowed', label: 'VRR in windowed mode' }) }),
          SP.ui.row({ path: 'display.hdr', label: 'HDR', desc: 'Requires an HDR-capable display and 10 bpc output.', control: SP.ui.toggle({ path: 'display.hdr', label: 'HDR' }) }),
        ],
      });

      const scaling = h('div', { class: 'adv-only' }, SP.ui.expander({ id: 'display-scaling', icon: 'sliders', title: 'Scaling', desc: 'How lower resolutions fill the screen', badge: 'Advanced', body: [
        SP.ui.row({ path: 'display.scaling', label: 'Scaling', desc: 'Where non-native resolutions are scaled.', control: SP.ui.segmented({ path: 'display.scaling', label: 'Perform scaling on', options: [['gpu', 'GPU'], ['display', 'Display']] }) }),
        SP.ui.row({ path: 'display.scaleMode', label: 'Scaling mode', control: SP.ui.select({ path: 'display.scaleMode', label: 'Scaling mode', options: [['aspect', 'Aspect ratio'], ['full', 'Full screen'], ['integer', 'Integer scaling'], ['none', 'No scaling']] }) }),
        SP.ui.row({ path: 'display.overscan', label: 'Overscan', desc: 'Shrink the desktop for TVs that crop edges.', control: SP.ui.slider({ path: 'display.overscan', label: 'Overscan', min: 0, max: 10, unit: '%' }) }),
      ] }));

      root.append(arrangement, h('div', { class: 'sp-grid sp-grid-2', style: { marginTop: '16px' } }, res, features), h('div', { style: { marginTop: '16px' } }, scaling));
    },
  });
})();
