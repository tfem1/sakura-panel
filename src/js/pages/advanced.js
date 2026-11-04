/* Advanced Settings — global 3D settings. Essentials first, deep controls in sections. */
(function () {
  const SP = window.SP;
  const { h } = SP.ui;

  SP.pages.push({
    id: 'advanced', title: 'Advanced Settings', group: 'gaming', icon: 'cube',
    search: ['Low latency', 'Power management', 'Vertical sync', 'Frame rate limit', 'Texture filtering quality', 'Anisotropic filtering', 'Antialiasing', 'FXAA', 'Ambient occlusion', 'Image sharpening', 'LOD bias', 'Triple buffering', 'Shader cache size', 'Threaded optimization'],
    advancedTerms: ['Anisotropic filtering', 'Antialiasing', 'FXAA', 'Ambient occlusion', 'Image sharpening', 'LOD bias', 'Triple buffering', 'Shader cache size', 'Threaded optimization'],
    render(root) {
      root.append(SP.ui.pageHeader({
        eyebrow: '3D & Gaming', title: 'Advanced Settings', desc: 'Global 3D settings used by every program unless a game profile overrides them.',
        actions: [SP.ui.button('Restore defaults', { icon: 'reset', variant: 'ghost', onClick: () => { SP.state.resetSection('graphics'); SP.refresh(); } })],
      }));

      const capOn = SP.state.get('graphics.fpsCap');
      const essentials = SP.ui.card({
        icon: 'bolt', title: 'Essentials', desc: 'The settings that matter most for latency and smoothness',
        body: [
          SP.ui.row({ path: 'graphics.lowLatency', label: 'Low latency', desc: 'Reduces queued frames. Ultra is best for competitive play.', control: SP.ui.segmented({ path: 'graphics.lowLatency', label: 'Low latency', options: [['off', 'Off'], ['on', 'On'], ['ultra', 'Ultra']] }) }),
          SP.ui.row({ path: 'graphics.power', label: 'Power management', control: SP.ui.select({ path: 'graphics.power', label: 'Power management', options: [['performance', 'Prefer maximum performance'], ['balanced', 'Normal'], ['quiet', 'Optimal power']] }) }),
          SP.ui.row({ path: 'graphics.vsync', label: 'Vertical sync', control: SP.ui.select({ path: 'graphics.vsync', label: 'Vertical sync', options: [['app', 'Use application setting'], ['on', 'On'], ['off', 'Off'], ['fast', 'Fast'], ['adaptive', 'Adaptive']] }) }),
          SP.ui.row({ path: 'graphics.fpsCap', label: 'Frame rate limit', desc: 'Cap frames to keep VRR in range and lower power.', control: SP.ui.toggle({ path: 'graphics.fpsCap', label: 'Frame rate limit', onChange: () => SP.refresh() }) }),
          SP.ui.row({ path: 'graphics.fpsLimit', label: 'Limit', desc: capOn ? 'Tip: 3 below your refresh rate keeps VRR engaged.' : 'Turn on the limit to edit.', control: SP.ui.slider({ path: 'graphics.fpsLimit', label: 'Frame rate limit', min: 20, max: 360, disabled: !capOn, format: (v) => v + ' FPS' }) }),
          SP.ui.row({ path: 'graphics.textureQuality', label: 'Texture filtering quality', control: SP.ui.segmented({ path: 'graphics.textureQuality', label: 'Texture filtering quality', options: [['performance', 'Performance'], ['quality', 'Quality'], ['high', 'High quality']] }) }),
        ],
      });

      const adv = h('div', { class: 'adv-only', style: { marginTop: '16px' } },
        SP.ui.expander({ id: 'adv-image', icon: 'eye', title: 'Image quality', desc: 'Filtering, antialiasing and post-processing', badge: 'Advanced', body: [
          SP.ui.row({ path: 'graphics.aniso', label: 'Anisotropic filtering', control: SP.ui.select({ path: 'graphics.aniso', label: 'Anisotropic filtering', options: [['app', 'Application-controlled'], ['off', 'Off'], ['2', '2×'], ['4', '4×'], ['8', '8×'], ['16', '16×']] }) }),
          SP.ui.row({ path: 'graphics.aa', label: 'Antialiasing', control: SP.ui.select({ path: 'graphics.aa', label: 'Antialiasing mode', options: [['app', 'Application-controlled'], ['enhance', 'Enhance application'], ['override', 'Override application'], ['off', 'Off']] }) }),
          SP.ui.row({ path: 'graphics.fxaa', label: 'FXAA', desc: 'Fast post-process edge smoothing.', control: SP.ui.toggle({ path: 'graphics.fxaa', label: 'FXAA' }) }),
          SP.ui.row({ path: 'graphics.ao', label: 'Ambient occlusion', control: SP.ui.segmented({ path: 'graphics.ao', label: 'Ambient occlusion', options: [['off', 'Off'], ['performance', 'Performance'], ['quality', 'Quality']] }) }),
          SP.ui.row({ path: 'graphics.sharpen', label: 'Image sharpening', control: SP.ui.slider({ path: 'graphics.sharpen', label: 'Image sharpening', min: 0, max: 100, unit: '%' }) }),
          SP.ui.row({ path: 'graphics.lodBias', label: 'LOD bias', desc: 'Clamp prevents shimmering when sharpening.', control: SP.ui.segmented({ path: 'graphics.lodBias', label: 'Negative LOD bias', options: [['allow', 'Allow'], ['clamp', 'Clamp']] }) }),
        ] }),
        SP.ui.expander({ id: 'adv-sync', icon: 'activity', title: 'Frame pacing', desc: 'Buffering behaviour', badge: 'Advanced', body: [
          SP.ui.row({ path: 'graphics.tripleBuffer', label: 'Triple buffering', desc: 'OpenGL only. Smooths V-Sync at the cost of latency.', control: SP.ui.toggle({ path: 'graphics.tripleBuffer', label: 'Triple buffering' }) }),
        ] }),
        SP.ui.expander({ id: 'adv-shader', icon: 'memory', title: 'Shaders & memory', desc: 'Caching and driver threading', badge: 'Advanced', body: [
          SP.ui.row({ path: 'graphics.shaderCache', label: 'Shader cache size', desc: 'A larger cache reduces stutter after driver updates.', control: SP.ui.select({ path: 'graphics.shaderCache', label: 'Shader cache size', options: [['off', 'Disabled'], ['5', '5 GB'], ['10', '10 GB'], ['100', '100 GB'], ['unlimited', 'Unlimited']] }) }),
          SP.ui.row({ path: 'graphics.threaded', label: 'Threaded optimization', control: SP.ui.segmented({ path: 'graphics.threaded', label: 'Threaded optimization', options: [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']] }) }),
        ] }));

      const simpleHint = h('div', { class: 'sp-note simple-only', style: { marginTop: '16px' } }, SP.ui.icon('info'),
        h('span', null, 'Image quality, frame pacing and shader controls are available in Advanced detail. ',
          h('button', { type: 'button', class: 'sp-link', onclick: () => SP.state.set('system.view', 'advanced') }, 'Show advanced controls')));

      root.append(essentials, simpleHint, adv);
    },
  });
})();
