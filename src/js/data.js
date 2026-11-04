/* SAKURA PANEL — shared reference data and the simulated telemetry source.
 * Nothing here talks to a GPU: telemetry is a random walk so the UI can be
 * designed and tested. Replace SP.telemetry with a real driver bridge later. */
(function () {
  const SP = window.SP;
  SP.pages = SP.pages || [];

  SP.COLOR_PRESETS = [
    { id: 'none', name: 'Default', desc: 'Neutral reference output', values: { brightness: 50, contrast: 50, gamma: 1.0, vibrance: 50, hue: 0 }, swatch: ['#6B7280', '#D1D5DB'] },
    { id: 'competitive', name: 'Competitive', desc: 'Lifted shadows and punchy colour for target visibility', values: { brightness: 55, contrast: 56, gamma: 1.18, vibrance: 76, hue: 0 }, swatch: ['#FF3D7F', '#FFD166'] },
    { id: 'cinema', name: 'Cinema', desc: 'Deeper blacks, gentle saturation, filmic contrast', values: { brightness: 46, contrast: 54, gamma: 0.94, vibrance: 44, hue: 0 }, swatch: ['#1F2937', '#C08457'] },
    { id: 'vivid', name: 'Vivid', desc: 'Rich, saturated colour for open-world and racing', values: { brightness: 52, contrast: 55, gamma: 1.0, vibrance: 68, hue: 0 }, swatch: ['#22C55E', '#3B82F6'] },
    { id: 'night', name: 'Night', desc: 'Dimmer, warmer output for late sessions', values: { brightness: 38, contrast: 48, gamma: 0.92, vibrance: 42, hue: -6 }, swatch: ['#7C2D12', '#F59E0B'] },
    { id: 'lowlight', name: 'Low Light', desc: 'Opens up dark scenes without crushing highlights', values: { brightness: 58, contrast: 47, gamma: 1.26, vibrance: 54, hue: 0 }, swatch: ['#312E81', '#A5B4FC'] },
  ];

  SP.DISPLAYS = [
    { id: 'd1', name: 'Display 1', model: '27″ · 2560×1440 · 165 Hz', primary: true,
      resolutions: ['3840x2160', '2560x1440', '1920x1080', '1600x900', '1280x720'], refresh: ['60', '120', '144', '165'], w: 27, ratio: 16 / 9 },
    { id: 'd2', name: 'Display 2', model: '24″ · 1920×1080 · 75 Hz', primary: false,
      resolutions: ['1920x1080', '1680x1050', '1280x720'], refresh: ['60', '75'], w: 24, ratio: 16 / 9 },
  ];

  /* ---------------- simulated telemetry ---------------- */
  const subs = new Set();
  const hist = { load: [], temp: [], clock: [], fps: [] };
  const HIST = 60;
  let timer = null;
  let s = { load: 34, temp: 52, clock: 1890, mem: 10501, power: 142, fan: 38, vram: 5.2, fps: 141 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const walk = (v, step, a, b) => clamp(v + (Math.random() - 0.5) * step, a, b);

  function tick() {
    const perf = SP.state ? SP.state.applied.performance : { powerLimit: 100, coreOffset: 0 };
    s.load = walk(s.load, 14, 8, 99);
    const targetTemp = 38 + s.load * 0.42 + (perf.powerLimit - 100) * 0.18;
    s.temp = clamp(s.temp + (targetTemp - s.temp) * 0.25 + (Math.random() - 0.5), 30, 90);
    s.clock = clamp(1500 + s.load * 4.4 + perf.coreOffset * 0.9 + (Math.random() - 0.5) * 40, 300, 2900);
    s.power = clamp(40 + s.load * 2.2 * (perf.powerLimit / 100), 20, 450);
    s.fan = perf.fanMode === 'manual' ? perf.fanSpeed : clamp(28 + (s.temp - 40) * 1.3, 0, 100);
    s.vram = walk(s.vram, 0.25, 2.1, 14.8);
    s.fps = clamp(walk(s.fps, 12, 60, 240), 30, 360);
    for (const k in hist) { hist[k].push(s[k]); if (hist[k].length > HIST) hist[k].shift(); }
    subs.forEach((fn) => fn(s, hist));
  }
  for (let i = 0; i < HIST; i++) tick();

  SP.telemetry = {
    get now() { return s; },
    history: hist,
    HIST,
    subscribe(fn) {
      subs.add(fn);
      if (!timer) timer = setInterval(tick, 1000);
      fn(s, hist);
      return () => { subs.delete(fn); if (!subs.size) { clearInterval(timer); timer = null; } };
    },
  };

  /** Tiny dependency-free sparkline renderer (SVG polyline, redrawn once per second). */
  SP.sparkline = function (values, { min, max, w = 300, hgt = 64, area = true } = {}) {
    const lo = min != null ? min : Math.min(...values);
    const hi = max != null ? max : Math.max(...values);
    const n = values.length;
    const pts = values.map((v, i) => [(i / (n - 1)) * w, hgt - 2 - ((v - lo) / (hi - lo || 1)) * (hgt - 4)]);
    const line = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return { line, area: area ? `0,${hgt} ${line} ${w},${hgt}` : '' };
  };
})();
