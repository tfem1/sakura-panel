/* SAKURA PANEL — hardware self-test.
 *
 * Drives the real engine and checks the result by READING BACK what Windows holds
 * (GetDeviceGammaRamp / MagGetFullscreenColorEffect), never by trusting our own maths.
 * Each step stays on screen for `stepMs` so the change is visible. The configuration
 * that was active before the test is restored at the end.
 */
const M = require('../../src/js/color-math.js');

const TOL = 256;
const mid = (r, i) => `R ${r.r[i]} G ${r.g[i]} B ${r.b[i]}`;
const all = (fn) => ['r', 'g', 'b'].every(fn);

const RAMP_CASES = [
  { name: 'Increase brightness', tone: { brightness: 75 }, check: (r, b) => all((c) => r[c][128] > b[c][128] + TOL), at: 128 },
  { name: 'Decrease brightness', tone: { brightness: 25 }, check: (r, b) => all((c) => r[c][128] < b[c][128] - TOL), at: 128 },
  { name: 'Increase contrast', tone: { contrast: 80 }, check: (r, b) => all((c) => r[c][48] < b[c][48] - TOL && r[c][208] > b[c][208] + TOL), at: 208 },
  { name: 'Raise gamma (brighter mid-tones)', tone: { gamma: 1.6 }, check: (r, b) => all((c) => r[c][128] > b[c][128] + TOL), at: 128 },
  { name: 'Lower gamma (darker mid-tones)', tone: { gamma: 0.7 }, check: (r, b) => all((c) => r[c][128] < b[c][128] - TOL), at: 128 },
  { name: 'Red channel gain down', tone: { gainR: 70 }, check: (r, b) => r.r[200] < b.r[200] - TOL && Math.abs(r.g[200] - b.g[200]) <= TOL && Math.abs(r.b[200] - b.b[200]) <= TOL, at: 200 },
  { name: 'Blue channel offset up', tone: { offsetB: 20 }, check: (r, b) => r.b[10] > b.b[10] + TOL && Math.abs(r.r[10] - b.r[10]) <= TOL, at: 10 },
  { name: 'Warm colour temperature (4000 K)', tone: { temperature: 4000 }, check: (r, b) => r.b[200] < b.b[200] - TOL && r.r[200] >= b.r[200] - TOL, at: 200 },
  { name: 'Apply preset (Competitive)', tone: { brightness: 55, contrast: 56, gamma: 1.18 }, check: (r, b) => all((c) => r[c][100] > b[c][100] + TOL), at: 100 },
  { name: 'Reset all adjustments', tone: {}, check: (r, b) => M.maxRampDiff(r, b) <= TOL, at: 128 },
];

const spread = (rgb) => Math.max(...rgb) - Math.min(...rgb);
const MATRIX_CASES = [
  { name: 'Increase saturation (all displays)', global: { saturation: 160 }, check: (m) => spread(M.applyMatrix(m, [0.7, 0.4, 0.4])) > spread([0.7, 0.4, 0.4]) + 0.05 },
  { name: 'Rotate hue 90° (all displays)', global: { hue: 90 }, check: (m) => { const o = M.applyMatrix(m, [1, 0, 0]); return Math.abs(o[0] - 1) > 0.1 || o[1] > 0.1 || o[2] > 0.1; } },
  { name: 'Reset colour matrix', global: {}, check: (m) => M.isIdentityMatrix(m, 1e-4) },
];

async function runSelfTest(engine, { stepMs = 400, onStep = () => {} } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  const push = (r) => { results.push(r); onStep(r); };
  if (!engine.backend.platform.supported) {
    push({ name: 'Platform', display: '-', status: 'unavailable', detail: engine.backend.platform.reason });
    return summarize(results, 0);
  }
  const saved = JSON.parse(JSON.stringify(engine.config));
  engine.bypass = false;
  const displays = engine.displays.slice();
  const neutral = () => ({ displays: Object.fromEntries(displays.map((d) => [d.key, { enabled: true, tone: { ...M.TONE_DEFAULTS } }])), global: { ...M.GLOBAL_DEFAULTS } });

  try {
    engine.apply(neutral(), { verify: true, force: true, transient: true });
    for (const d of displays) {
      const label = d.name + (d.primary ? ' (primary)' : '');
      if (d.hdr && d.hdr.enabled) { push({ name: 'Gamma ramp tests', display: label, status: 'unavailable', detail: 'HDR / Advanced Color is on: Windows does not apply gamma ramps.' }); continue; }
      const baseRead = engine.backend.getRamp(d.gdiName);
      if (!baseRead.ok) { push({ name: 'Read original ramp', display: label, status: 'fail', detail: baseRead.error }); continue; }
      const base = baseRead.ramp;
      for (const tc of RAMP_CASES) {
        const cfg = neutral();
        cfg.displays[d.key].tone = { ...M.TONE_DEFAULTS, ...tc.tone };
        const res = engine.apply(cfg, { verify: true, force: true, transient: true });
        const dr = res.displays[d.key] || {};
        const rb = engine.backend.getRamp(d.gdiName);
        let status, detail;
        if (dr.status === 'failed') { status = 'fail'; detail = dr.message; }
        else if (!rb.ok) { status = 'fail'; detail = 'Read-back failed: ' + rb.error; }
        else {
          const pass = tc.check(rb.ramp, base);
          status = pass ? 'pass' : 'fail';
          detail = `level ${tc.at}: original ${mid(base, tc.at)} → read back ${mid(rb.ramp, tc.at)}` + (dr.status === 'limited' ? ` (Windows limited it to ${Math.round(dr.strength * 100)}%)` : '');
        }
        push({ name: tc.name, display: label, status, detail });
        await sleep(stepMs);
      }
    }
    for (const tc of MATRIX_CASES) {
      const cfg = neutral();
      cfg.global = { ...M.GLOBAL_DEFAULTS, ...tc.global };
      const res = engine.apply(cfg, { verify: true, force: true, transient: true });
      if (res.matrix.status === 'unavailable') { push({ name: tc.name, display: 'All displays', status: 'unavailable', detail: res.matrix.message }); continue; }
      const rb = engine.backend.matrix.get();
      const pass = rb.ok && res.matrix.status !== 'failed' && tc.check(rb.matrix);
      push({ name: tc.name, display: 'All displays', status: pass ? 'pass' : 'fail', detail: rb.ok ? `matrix read back from Windows (${res.matrix.status})` : rb.error });
      await sleep(stepMs);
    }
  } finally {
    engine.apply(saved, { verify: true, force: true });
  }
  return summarize(results, displays.length);
}

function summarize(results, displayCount) {
  const count = (s) => results.filter((r) => r.status === s).length;
  return { displays: displayCount, passed: count('pass'), failed: count('fail'), unavailable: count('unavailable'), results, at: new Date().toISOString() };
}

module.exports = { runSelfTest, RAMP_CASES, MATRIX_CASES };
