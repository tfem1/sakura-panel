/* Unit tests for the colour maths (ramps and matrices). node --test */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/js/color-math.js');

const T = (o) => ({ ...M.TONE_DEFAULTS, ...o });
const I = M.identityRamp();
const calib = () => { const r = M.identityRamp(); for (let i = 0; i < 256; i++) r.b[i] = Math.round(i * 257 * 0.95); return r; };

test('neutral settings give exactly the identity ramp', () => {
  assert.equal(M.maxRampDiff(M.buildRamp(T({})), I), 0);
});

test('neutral settings preserve an existing calibration ramp exactly', () => {
  const base = calib();
  assert.equal(M.maxRampDiff(M.buildRamp(T({}), base), base), 0);
});

test('brightness up raises mid-tones, down lowers them', () => {
  const up = M.buildRamp(T({ brightness: 75 })), down = M.buildRamp(T({ brightness: 25 }));
  for (const c of ['r', 'g', 'b']) { assert.ok(up[c][128] > I[c][128]); assert.ok(down[c][128] < I[c][128]); }
});

test('contrast up darkens shadows and brightens highlights around mid-grey', () => {
  const r = M.buildRamp(T({ contrast: 80 }));
  assert.ok(r.g[48] < I.g[48]); assert.ok(r.g[208] > I.g[208]);
  assert.ok(Math.abs(r.g[128] - I.g[128]) < 400);
});

test('gamma above 1 brightens mid-tones, below 1 darkens them; endpoints fixed', () => {
  const hi = M.buildRamp(T({ gamma: 1.6 })), lo = M.buildRamp(T({ gamma: 0.7 }));
  assert.ok(hi.r[128] > I.r[128]); assert.ok(lo.r[128] < I.r[128]);
  assert.equal(hi.r[0], 0); assert.equal(hi.r[255], 65535);
});

test('RGB gain/offset/gamma only affect their own channel', () => {
  const g = M.buildRamp(T({ gainR: 70 }));
  assert.ok(g.r[200] < I.r[200]); assert.equal(g.g[200], I.g[200]); assert.equal(g.b[200], I.b[200]);
  const o = M.buildRamp(T({ offsetB: 20 }));
  assert.ok(o.b[10] > I.b[10]); assert.equal(o.r[10], I.r[10]);
  const gg = M.buildRamp(T({ gammaG: 1.3 }));
  assert.ok(gg.g[128] > I.g[128]); assert.equal(gg.r[128], I.r[128]);
});

test('colour temperature: 6500 K neutral, warm lowers blue, cool lowers red, never clips', () => {
  assert.deepEqual(M.temperatureGains(6500), [1, 1, 1]);
  const w = M.temperatureGains(3000), c = M.temperatureGains(9500);
  assert.ok(w[2] < w[1] && w[1] < w[0]); assert.equal(Math.max(...w), 1);
  assert.ok(c[0] < c[2]); assert.equal(Math.max(...c), 1);
});

test('black and white level set the output floor and ceiling', () => {
  const r = M.buildRamp(T({ blackLevel: 10, whiteLevel: 90 }));
  assert.equal(r.r[0], Math.round(0.1 * 65535)); assert.equal(r.r[255], Math.round(0.9 * 65535));
});

test('exposure, shadows and highlights move the expected tonal range', () => {
  assert.ok(M.buildRamp(T({ exposure: 1 })).g[100] > I.g[100]);
  const sh = M.buildRamp(T({ shadows: 80 })), hl = M.buildRamp(T({ highlights: 80 }));
  assert.ok(sh.g[64] - I.g[64] > sh.g[200] - I.g[200]);
  assert.ok(hl.g[200] - I.g[200] > hl.g[64] - I.g[64]);
});

test('every ramp is monotonic and in range, even at extreme settings (fuzz)', () => {
  const R = M.RANGES;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 300; n++) {
    const tone = {};
    for (const k of Object.keys(M.TONE_DEFAULTS)) tone[k] = R[k][0] + rnd() * (R[k][1] - R[k][0]);
    const r = M.buildRamp(tone, n % 2 ? calib() : undefined);
    for (const c of ['r', 'g', 'b']) for (let i = 1; i < 256; i++) {
      assert.ok(r[c][i] >= r[c][i - 1], `monotonic ${c}[${i}]`);
      assert.ok(r[c][i] >= 0 && r[c][i] <= 65535);
    }
  }
});

test('out-of-range and garbage input is clamped, not passed through', () => {
  const t = M.sanitizeTone({ brightness: 999, gamma: -5, temperature: 'hot', gainR: NaN });
  assert.equal(t.brightness, 100); assert.equal(t.gamma, 0.3); assert.equal(t.temperature, 6500); assert.equal(t.gainR, 100);
});

test('colour matrix: neutral is identity; layout matches MAGCOLOREFFECT (row vector, offsets in row 4)', () => {
  assert.ok(M.isIdentityMatrix(M.buildMatrix(M.GLOBAL_DEFAULTS)));
  const T5 = M.identityMatrix(); T5[20] = 0.1; // offset on red
  assert.deepEqual(M.applyMatrix(T5, [0.5, 0.5, 0.5]).map((v) => +v.toFixed(4)), [0.6, 0.5, 0.5]);
});

test('saturation keeps greys grey and pushes colours away from grey', () => {
  const m = M.buildMatrix({ saturation: 160 });
  const g = M.applyMatrix(m, [0.4, 0.4, 0.4]);
  g.forEach((v) => assert.ok(Math.abs(v - 0.4) < 1e-5));
  const c = M.applyMatrix(m, [0.7, 0.4, 0.4]);
  assert.ok(c[0] - c[1] > 0.3);
  const z = M.applyMatrix(M.buildMatrix({ saturation: 0 }), [0.9, 0.2, 0.1]);
  assert.ok(Math.max(...z) - Math.min(...z) < 1e-5);
});

test('vibrance is a linear saturation boost; hue rotates and 360° returns to identity', () => {
  assert.ok(M.saturationFactor({ saturation: 100, vibrance: 100 }) > 1);
  assert.ok(M.saturationFactor({ saturation: 100, vibrance: 0 }) < 1);
  const h = M.applyMatrix(M.buildMatrix({ hue: 120 }), [1, 0, 0]);
  assert.ok(h[1] > h[0]);
  assert.ok(M.matrixDiff(M.buildMatrix({ hue: 180 }), M.buildMatrix({ hue: -180 })) < 1e-5);
});
