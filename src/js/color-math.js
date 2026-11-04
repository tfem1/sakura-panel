/* SAKURA PANEL — colour maths shared by the main-process engine and the UI.
 *
 * Two processing stages, matching what Windows actually offers:
 *
 *  1. Tone curve -> hardware gamma ramp (SetDeviceGammaRamp), per monitor.
 *     A gamma ramp is three independent 256-entry lookup tables, one per channel.
 *     It can only express per-channel curves: brightness, contrast, gamma, exposure,
 *     shadows/highlights, black/white level, colour temperature and RGB gain/offset/gamma.
 *     It CANNOT mix channels, so saturation, vibrance and hue are impossible here.
 *
 *  2. Colour matrix -> Windows Magnification full-screen colour effect, all monitors.
 *     A 5x5 matrix applied by the desktop compositor (DWM). It can mix channels:
 *     saturation, vibrance (as a linear saturation boost) and hue rotation.
 *
 * Sharpness needs a spatial filter; neither stage can do it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SP = root.SP || {}; root.SP.colorMath = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const N = 256;

  const TONE_DEFAULTS = Object.freeze({
    brightness: 50, contrast: 50, gamma: 1, exposure: 0, shadows: 0, highlights: 0,
    blackLevel: 0, whiteLevel: 100, temperature: 6500,
    gainR: 100, gainG: 100, gainB: 100, offsetR: 0, offsetG: 0, offsetB: 0, gammaR: 1, gammaG: 1, gammaB: 1,
  });
  const GLOBAL_DEFAULTS = Object.freeze({ saturation: 100, vibrance: 50, hue: 0 });

  const RANGES = {
    brightness: [0, 100], contrast: [0, 100], gamma: [0.3, 2.8], exposure: [-2, 2],
    shadows: [-100, 100], highlights: [-100, 100], blackLevel: [0, 40], whiteLevel: [60, 100],
    temperature: [3000, 10000],
    gainR: [50, 150], gainG: [50, 150], gainB: [50, 150],
    offsetR: [-50, 50], offsetG: [-50, 50], offsetB: [-50, 50],
    gammaR: [0.5, 1.5], gammaG: [0.5, 1.5], gammaB: [0.5, 1.5],
    saturation: [0, 200], vibrance: [0, 100], hue: [-180, 180],
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (v) => clamp(v, 0, 1);

  function sanitize(input, defaults) {
    const out = {};
    for (const k of Object.keys(defaults)) {
      const n = Number(input && input[k]);
      out[k] = Number.isFinite(n) ? clamp(n, RANGES[k][0], RANGES[k][1]) : defaults[k];
    }
    return out;
  }
  const sanitizeTone = (t) => sanitize(t, TONE_DEFAULTS);
  const sanitizeGlobal = (g) => sanitize(g, GLOBAL_DEFAULTS);
  const isNeutral = (v, defaults) => Object.keys(defaults).every((k) => Math.abs(Number(v[k]) - defaults[k]) < 1e-9);
  const isNeutralTone = (t) => isNeutral(sanitizeTone(t), TONE_DEFAULTS);
  const isNeutralGlobal = (g) => isNeutral(sanitizeGlobal(g), GLOBAL_DEFAULTS);

  /* ---------------- colour temperature ---------------- */
  // Tanner Helland's black-body approximation, normalised so 6500 K is exactly neutral
  // and the strongest channel is 1 (never clips, like f.lux / Night light).
  function kelvinToRgb(k) {
    const t = k / 100;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
  }
  const NEUTRAL = kelvinToRgb(6500);
  function temperatureGains(k) {
    if (Math.abs(k - 6500) < 1e-9) return [1, 1, 1];
    const raw = kelvinToRgb(k).map((v, i) => v / NEUTRAL[i]);
    const m = Math.max(...raw);
    return raw.map((v) => v / m);
  }

  /* ---------------- tone curve ---------------- */
  const CH = ['R', 'G', 'B'];
  /** Maps a normalised input level x (0..1) to an output level for channel c (0=R,1=G,2=B). */
  function curve(x, tone, c, tempGains) {
    const t = tone;
    let v = x;
    if (t.exposure) v = Math.pow(Math.pow(v, 2.2) * Math.pow(2, t.exposure), 1 / 2.2); // in linear light
    if (t.contrast !== 50) v = (v - 0.5) * Math.pow(2, (t.contrast - 50) / 50) + 0.5;   // 0..100 -> x0.5..x2 around mid-grey
    if (t.brightness !== 50) v += ((t.brightness - 50) / 50) * 0.4;                    // 0..100 -> -0.4..+0.4 offset
    if (t.shadows) { const u = clamp01(v); v += (t.shadows / 100) * 0.81 * u * (1 - u) * (1 - u); }
    if (t.highlights) { const u = clamp01(v); v += (t.highlights / 100) * 0.81 * u * u * (1 - u); }
    const g = t.gamma * t['gamma' + CH[c]];
    if (g !== 1) v = Math.pow(clamp01(v), 1 / g);
    v *= (t['gain' + CH[c]] / 100) * tempGains[c];
    v += t['offset' + CH[c]] / 200;
    const bl = t.blackLevel / 100, wl = t.whiteLevel / 100;
    v = bl + clamp01(v) * (wl - bl);
    return clamp01(v);
  }

  const identityChannel = () => { const a = new Uint16Array(N); for (let i = 0; i < N; i++) a[i] = i * 257; return a; };
  const identityRamp = () => ({ r: identityChannel(), g: identityChannel(), b: identityChannel() });

  function sample(channel, y) {
    const p = y * (N - 1);
    const i = Math.floor(p);
    if (i >= N - 1) return channel[N - 1];
    const f = p - i;
    return channel[i] + (channel[i + 1] - channel[i]) * f;
  }

  /**
   * Builds the ramp for a tone setting, composed ON TOP OF the display's original ramp
   * (its calibration curve, if any), so neutral settings give back exactly the original.
   */
  function buildRamp(toneIn, base) {
    const tone = sanitizeTone(toneIn);
    const b = base || identityRamp();
    if (isNeutral(tone, TONE_DEFAULTS)) return { r: Uint16Array.from(b.r), g: Uint16Array.from(b.g), b: Uint16Array.from(b.b) };
    const tg = temperatureGains(tone.temperature);
    const out = {};
    ['r', 'g', 'b'].forEach((ch, c) => {
      const a = new Uint16Array(N);
      let prev = 0;
      for (let i = 0; i < N; i++) {
        const y = curve(i / (N - 1), tone, c, tg);
        let w = Math.round(sample(b[ch], y));
        if (w < prev) w = prev; // gamma ramps must be monotonic
        a[i] = prev = clamp(w, 0, 65535);
      }
      out[ch] = a;
    });
    return out;
  }

  function blendRamp(from, to, t) {
    const out = {};
    for (const ch of ['r', 'g', 'b']) {
      const a = new Uint16Array(N);
      for (let i = 0; i < N; i++) a[i] = Math.round(from[ch][i] + (to[ch][i] - from[ch][i]) * t);
      out[ch] = a;
    }
    return out;
  }

  function maxRampDiff(a, b) {
    let m = 0;
    for (const ch of ['r', 'g', 'b']) for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(a[ch][i] - b[ch][i]));
    return m;
  }
  const rampToJSON = (r) => ({ r: Array.from(r.r), g: Array.from(r.g), b: Array.from(r.b) });
  function rampFromJSON(j) {
    if (!j || !['r', 'g', 'b'].every((c) => Array.isArray(j[c]) && j[c].length === N)) return null;
    return { r: Uint16Array.from(j.r), g: Uint16Array.from(j.g), b: Uint16Array.from(j.b) };
  }

  /* ---------------- colour matrix ---------------- */
  const LR = 0.2126, LG = 0.7152, LB = 0.0722; // Rec.709 luma

  /** Column-vector 3x3 (out = M * in) for saturation s (1 = neutral). Preserves luma. */
  function saturationMatrix(s) {
    return [
      [LR + (1 - LR) * s, LG - LG * s, LB - LB * s],
      [LR - LR * s, LG + (1 - LG) * s, LB - LB * s],
      [LR - LR * s, LG - LG * s, LB + (1 - LB) * s],
    ];
  }
  /** Hue rotation around the luma axis (same coefficients as SVG feColorMatrix hueRotate). */
  function hueMatrix(deg) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
    ];
  }
  const mul3 = (A, B) => A.map((row, i) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));

  /** Effective saturation factor. Vibrance 50 = neutral; it is a LINEAR boost (x0.5..x1.5). */
  function saturationFactor(g) { return (g.saturation / 100) * (1 + ((g.vibrance - 50) / 50) * 0.5); }

  /**
   * MAGCOLOREFFECT layout: float[5][5], row-vector convention: out = [r g b a 1] x T.
   * T[i][j] = contribution of input channel i to output channel j; row 4 holds offsets.
   */
  function buildMatrix(gIn) {
    const g = sanitizeGlobal(gIn);
    const M = mul3(hueMatrix(g.hue), saturationMatrix(saturationFactor(g)));
    const T = new Float32Array(25);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[i * 5 + j] = M[j][i];
    T[3 * 5 + 3] = 1; T[4 * 5 + 4] = 1;
    return T;
  }
  function identityMatrix() { const T = new Float32Array(25); [0, 6, 12, 18, 24].forEach((i) => (T[i] = 1)); return T; }
  function isIdentityMatrix(T, eps = 1e-5) { const I = identityMatrix(); for (let i = 0; i < 25; i++) if (Math.abs(T[i] - I[i]) > eps) return false; return true; }
  function matrixDiff(A, B) { let m = 0; for (let i = 0; i < 25; i++) m = Math.max(m, Math.abs(A[i] - B[i])); return m; }
  /** Applies a MAGCOLOREFFECT matrix to an [r,g,b] colour (0..1), clamped like the compositor. */
  function applyMatrix(T, rgb) {
    const v = [rgb[0], rgb[1], rgb[2], 1, 1];
    return [0, 1, 2].map((j) => clamp01(v[0] * T[j] + v[1] * T[5 + j] + v[2] * T[10 + j] + v[3] * T[15 + j] + v[4] * T[20 + j]));
  }

  return {
    N, TONE_DEFAULTS, GLOBAL_DEFAULTS, RANGES,
    sanitizeTone, sanitizeGlobal, isNeutralTone, isNeutralGlobal,
    kelvinToRgb, temperatureGains, curve,
    identityRamp, buildRamp, blendRamp, maxRampDiff, rampToJSON, rampFromJSON,
    buildMatrix, identityMatrix, isIdentityMatrix, matrixDiff, applyMatrix, saturationFactor,
  };
});
