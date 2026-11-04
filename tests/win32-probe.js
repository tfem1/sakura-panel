/* Exercises electron/color/win32.js against a Windows API implementation
 * (real Windows, or Wine for development). Restores everything it changes.
 *   node tests/win32-probe.js      (Windows node.exe)
 */
const M = require('../src/js/color-math.js');
const backend = require('../electron/color/win32.js').create();

const out = (k, v) => console.log(k.padEnd(22), typeof v === 'string' ? v : JSON.stringify(v));
let failed = 0;
const check = (name, cond, detail = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' -- ' + detail : '')); if (!cond) failed++; };

out('platform', backend.platform);
if (!backend.platform.supported) process.exit(2);

const displays = backend.listDisplays();
out('displays', displays.map((d) => ({ key: d.key, gdi: d.gdiName, name: d.name, primary: d.primary, mode: `${d.width}x${d.height}@${d.refresh}`, pos: [d.x, d.y], hdr: d.hdr, adapter: d.adapter })));
check('enumerates at least one display', displays.length > 0);
check('display keys are stable hashes', displays.every((d) => /^m[0-9a-f]{12}$/.test(d.key)));
check('current mode read from DEVMODE', displays.every((d) => d.width > 0 && d.height > 0), displays.map((d) => `${d.width}x${d.height}`).join(', '));
out('gpus', backend.gpus());

for (const d of displays) {
  const g = backend.getRamp(d.gdiName);
  check(`${d.gdiName} GetDeviceGammaRamp`, g.ok, g.ok ? `r[0]=${g.ramp.r[0]} r[128]=${g.ramp.r[128]} r[255]=${g.ramp.r[255]}` : g.error);
  if (!g.ok) continue;
  const original = g.ramp;
  const target = M.buildRamp({ ...M.TONE_DEFAULTS, brightness: 62, gainB: 90 }, original);
  const s = backend.setRamp(d.gdiName, target);
  check(`${d.gdiName} SetDeviceGammaRamp (modified ramp)`, s.ok, s.error || '');
  if (s.ok) {
    const rb = backend.getRamp(d.gdiName);
    const diff = rb.ok ? M.maxRampDiff(rb.ramp, target) : -1;
    check(`${d.gdiName} read-back matches written ramp`, rb.ok && diff <= 512, `max diff ${diff}`);
  }
  const r = backend.setRamp(d.gdiName, original);
  const back = backend.getRamp(d.gdiName);
  check(`${d.gdiName} original ramp restored`, r.ok && back.ok && M.maxRampDiff(back.ramp, original) <= 512);
}

const ma = backend.matrix.available();
out('magnification', ma);
if (ma.ok) {
  const T = M.buildMatrix({ saturation: 140 });
  const s = backend.matrix.set(T);
  check('MagSetFullscreenColorEffect', s.ok, s.error || '');
  const g = backend.matrix.get();
  check('MagGetFullscreenColorEffect read-back', g.ok && M.matrixDiff(g.matrix, T) < 1e-4, g.error || '');
  backend.matrix.set(M.identityMatrix());
  backend.matrix.shutdown();
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
