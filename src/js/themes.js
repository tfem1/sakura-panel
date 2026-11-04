/* SAKURA PANEL — built-in themes and the editable token schema. */
(function () {
  const SP = (window.SP = window.SP || {});

  /*
   * Every theme is a flat set of tokens. Colours are #RRGGBB, the three
   * "strength" tokens are numbers 0–1. Everything else the UI needs
   * (soft fills, focus rings, shadows) is derived from these in theme-engine.
   */
  SP.TOKEN_SCHEMA = [
    { group: 'Brand', tokens: [
      { key: 'primary', label: 'Primary', hint: 'Active states, indicators, highlights' },
      { key: 'secondary', label: 'Secondary', hint: 'Secondary data, tags, subtle chrome' },
      { key: 'accent', label: 'Accent', hint: 'Charts, info badges, focus details' },
    ] },
    { group: 'Surfaces', tokens: [
      { key: 'background', label: 'Background', hint: 'Window background (top)' },
      { key: 'backgroundAlt', label: 'Background gradient', hint: 'Window background (bottom)' },
      { key: 'sidebar', label: 'Sidebar', hint: 'Navigation rail' },
      { key: 'panel', label: 'Panel', hint: 'Cards and sections' },
      { key: 'panelRaised', label: 'Raised panel', hint: 'Inputs, popovers, nested surfaces' },
      { key: 'panelOpacity', label: 'Panel opacity', type: 'range', min: 0.55, max: 1, step: 0.01 },
    ] },
    { group: 'Text & lines', tokens: [
      { key: 'text', label: 'Text', hint: 'Primary text' },
      { key: 'textMuted', label: 'Muted text', hint: 'Descriptions and labels' },
      { key: 'border', label: 'Borders', hint: 'Dividers and outlines' },
    ] },
    { group: 'Controls', tokens: [
      { key: 'button', label: 'Button', hint: 'Primary button fill' },
      { key: 'buttonText', label: 'Button text' },
      { key: 'sliderTrack', label: 'Slider track' },
      { key: 'sliderFill', label: 'Slider fill' },
      { key: 'sliderThumb', label: 'Slider thumb' },
    ] },
    { group: 'Effects', tokens: [
      { key: 'hover', label: 'Hover tint', hint: 'Colour mixed over hovered items' },
      { key: 'hoverStrength', label: 'Hover strength', type: 'range', min: 0, max: 0.2, step: 0.005 },
      { key: 'animation', label: 'Animation colour', hint: 'Loaders, apply feedback, glows' },
      { key: 'glow', label: 'Glow intensity', type: 'range', min: 0, max: 1, step: 0.01 },
    ] },
  ];

  const T = (id, name, tagline, mode, t) => ({ id, name, tagline, mode, builtIn: true, tokens: t });

  SP.BUILT_IN_THEMES = [
    T('sakura-pink', 'Sakura Pink', 'Classic cherry blossom pink', 'light', {
      primary: '#E2558E', secondary: '#B88A9F', accent: '#8C6BD6',
      background: '#FBF4F7', backgroundAlt: '#F6E8EF', sidebar: '#F7EAF0', panel: '#FFFFFF', panelRaised: '#FDF5F8', panelOpacity: 0.92,
      text: '#2A1F25', textMuted: '#87717C', border: '#EDD7E1',
      button: '#E2558E', buttonText: '#FFFFFF', sliderTrack: '#F1DCE5', sliderFill: '#E2558E', sliderThumb: '#FFFFFF',
      hover: '#E2558E', hoverStrength: 0.07, animation: '#E2558E', glow: 0.25,
    }),
    T('midnight-sakura', 'Midnight Sakura', 'Deep black with neon pink accents', 'dark', {
      primary: '#FF5C9D', secondary: '#C9B5C0', accent: '#A996FF',
      background: '#0A090B', backgroundAlt: '#120D12', sidebar: '#0D0B0E', panel: '#141115', panelRaised: '#1C181D', panelOpacity: 0.94,
      text: '#F5EEF2', textMuted: '#9D929A', border: '#2A2329',
      button: '#FF5C9D', buttonText: '#1A0710', sliderTrack: '#2C252B', sliderFill: '#FF5C9D', sliderThumb: '#FFF1F7',
      hover: '#FFFFFF', hoverStrength: 0.045, animation: '#FF5C9D', glow: 0.45,
    }),
    T('pure-sakura', 'Pure Sakura', 'Pearl white and pastel pink', 'light', {
      primary: '#E487AE', secondary: '#C9B3BD', accent: '#9FB7E0',
      background: '#FCFAF9', backgroundAlt: '#F7F1F2', sidebar: '#F7F2F3', panel: '#FFFFFF', panelRaised: '#FBF7F8', panelOpacity: 0.96,
      text: '#33292E', textMuted: '#8F8088', border: '#EEE4E8',
      button: '#F4C3D7', buttonText: '#4A1730', sliderTrack: '#F1E6EA', sliderFill: '#E487AE', sliderThumb: '#FFFFFF',
      hover: '#E487AE', hoverStrength: 0.07, animation: '#E487AE', glow: 0.2,
    }),
    T('dark-blossom', 'Dark Blossom', 'Anthracite and dusty pink', 'dark', {
      primary: '#D893AA', secondary: '#AAA1A6', accent: '#93B5C6',
      background: '#1A191B', backgroundAlt: '#211E21', sidebar: '#1D1C1E', panel: '#242225', panelRaised: '#2C292D', panelOpacity: 0.95,
      text: '#EDE8EA', textMuted: '#9C959A', border: '#363237',
      button: '#D893AA', buttonText: '#2A161D', sliderTrack: '#38343A', sliderFill: '#D893AA', sliderThumb: '#F3EAEE',
      hover: '#FFFFFF', hoverStrength: 0.04, animation: '#D893AA', glow: 0.25,
    }),
    T('crimson-sakura', 'Crimson Sakura', 'Deep cherry red and black', 'dark', {
      primary: '#E0284F', secondary: '#C79AA4', accent: '#FF8FAE',
      background: '#0B0607', backgroundAlt: '#160A0C', sidebar: '#0E0708', panel: '#170C0E', panelRaised: '#211114', panelOpacity: 0.95,
      text: '#F7ECEE', textMuted: '#A38D92', border: '#33171C',
      button: '#D3214A', buttonText: '#FFFFFF', sliderTrack: '#35191E', sliderFill: '#E0284F', sliderThumb: '#FFE6EC',
      hover: '#FF8FAE', hoverStrength: 0.05, animation: '#FF3D66', glow: 0.5,
    }),
    T('lavender-sakura', 'Lavender Sakura', 'Soft purple and pink', 'dark', {
      primary: '#C6A4FF', secondary: '#FF9EC7', accent: '#FFB8D6',
      background: '#131019', backgroundAlt: '#1A1422', sidebar: '#16121D', panel: '#1C1725', panelRaised: '#241E2F', panelOpacity: 0.94,
      text: '#F2EDF8', textMuted: '#A096AF', border: '#2F2840',
      button: '#C6A4FF', buttonText: '#1E1230', sliderTrack: '#30293F', sliderFill: '#C6A4FF', sliderThumb: '#FFE9F4',
      hover: '#C6A4FF', hoverStrength: 0.06, animation: '#FF9EC7', glow: 0.4,
    }),
    T('ice-sakura', 'Ice Sakura', 'Icy white and pastel blue', 'light', {
      primary: '#4C8FC7', secondary: '#9DB4C6', accent: '#EFA3C2',
      background: '#F4F8FB', backgroundAlt: '#E9F1F7', sidebar: '#EBF2F7', panel: '#FFFFFF', panelRaised: '#F5F9FC', panelOpacity: 0.94,
      text: '#1D2A35', textMuted: '#6F8496', border: '#DCE7EF',
      button: '#3F84BE', buttonText: '#FFFFFF', sliderTrack: '#DCE8F1', sliderFill: '#6FA9DA', sliderThumb: '#FFFFFF',
      hover: '#4C8FC7', hoverStrength: 0.07, animation: '#7DB8E6', glow: 0.25,
    }),
    T('black-white', 'Black & White', 'Pure monochrome', 'dark', {
      primary: '#FFFFFF', secondary: '#A3A3A3', accent: '#D4D4D4',
      background: '#000000', backgroundAlt: '#060606', sidebar: '#050505', panel: '#0E0E0E', panelRaised: '#171717', panelOpacity: 1,
      text: '#FFFFFF', textMuted: '#8E8E8E', border: '#262626',
      button: '#FFFFFF', buttonText: '#000000', sliderTrack: '#2A2A2A', sliderFill: '#FFFFFF', sliderThumb: '#FFFFFF',
      hover: '#FFFFFF', hoverStrength: 0.06, animation: '#FFFFFF', glow: 0,
    }),
    T('graphite', 'Graphite', 'Graphite grey and silver', 'dark', {
      primary: '#C9CED6', secondary: '#8D949C', accent: '#9FB6CC',
      background: '#191B1E', backgroundAlt: '#1F2226', sidebar: '#1B1D20', panel: '#22252A', panelRaised: '#2A2E33', panelOpacity: 0.96,
      text: '#E9EBEE', textMuted: '#979DA5', border: '#33373D',
      button: '#D3D7DD', buttonText: '#15171A', sliderTrack: '#383C43', sliderFill: '#B9C0C9', sliderThumb: '#F2F4F6',
      hover: '#FFFFFF', hoverStrength: 0.045, animation: '#C9CED6', glow: 0.15,
    }),
    T('rose-gold', 'Rose Gold', 'Rose gold and champagne', 'light', {
      primary: '#B46E76', secondary: '#C9AE8B', accent: '#B98E62',
      background: '#F7F2EC', backgroundAlt: '#EFE6DC', sidebar: '#F0E7DE', panel: '#FFFCF9', panelRaised: '#FAF4EE', panelOpacity: 0.94,
      text: '#2F2522', textMuted: '#8B7A71', border: '#E5D8CC',
      button: '#B46E76', buttonText: '#FFFFFF', sliderTrack: '#E8DCD0', sliderFill: '#C4868B', sliderThumb: '#FFFCF9',
      hover: '#C9AE8B', hoverStrength: 0.1, animation: '#C99A86', glow: 0.25,
    }),
    T('deep-red', 'Deep Red', 'Dark red and black', 'dark', {
      primary: '#C11B32', secondary: '#9D7C7C', accent: '#E06A5A',
      background: '#080404', backgroundAlt: '#110707', sidebar: '#0A0505', panel: '#130909', panelRaised: '#1C0E0E', panelOpacity: 0.96,
      text: '#F2E8E8', textMuted: '#9A8585', border: '#2B1515',
      button: '#A8162B', buttonText: '#FFFFFF', sliderTrack: '#2E1717', sliderFill: '#C11B32', sliderThumb: '#F4E1E1',
      hover: '#FFFFFF', hoverStrength: 0.04, animation: '#C11B32', glow: 0.35,
    }),
    T('minimal-sakura', 'Minimal Sakura', 'Off-white with subtle pink accents', 'light', {
      primary: '#D9708F', secondary: '#A6A6A2', accent: '#D9708F',
      background: '#FAFAF8', backgroundAlt: '#F4F4F1', sidebar: '#F4F4F2', panel: '#FFFFFF', panelRaised: '#F8F8F6', panelOpacity: 1,
      text: '#1C1C1C', textMuted: '#7A7A77', border: '#E6E6E2',
      button: '#1C1C1C', buttonText: '#FFFFFF', sliderTrack: '#E7E7E3', sliderFill: '#1C1C1C', sliderThumb: '#FFFFFF',
      hover: '#1C1C1C', hoverStrength: 0.04, animation: '#D9708F', glow: 0.1,
    }),
  ];

  SP.DEFAULT_THEME_ID = 'midnight-sakura';
})();
