/* Engine tests against a simulated Windows display stack. node --test
 *
 * FakeWindows models the behaviours the engine must handle: per-monitor hardware LUTs,
 * an existing calibration ramp, Windows refusing ramps too far from neutral, HDR displays,
 * another program overriding the ramp, LUT resets on mode change, hot-plug, and the
 * Magnification colour matrix. It does NOT prove the real driver behaves the same way;
 * `npm run test:display` runs the same checks against real Windows.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('../src/js/color-math.js');
const { ColorEngine } = require('../electron/color/engine.js');
const { restoreFromLock } = require('../electron/color/watchdog.js');
const { runSelfTest } = require('../electron/color/selftest.js');

const { FakeWindows, calibration, copy } = require('./helpers/fake-windows.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-color-'));
const cfg = (perDisplay = {}, global = {}) => ({
  displays: Object.fromEntries(Object.entries(perDisplay).map(([k, t]) => [k, { enabled: true, tone: { ...M.TONE_DEFAULTS, ...t } }])),
  global: { ...M.GLOBAL_DEFAULTS, ...global },
});
function boot(win, dir = tmp()) { const e = new ColorEngine({ backend: win, dataDir: dir }); e.init(); return e; }

test('brightness change reaches the hardware LUT of that display only, verified by read-back', () => {
  const win = new FakeWindows();
  const e = boot(win);
  const r = e.apply(cfg({ mon1: { brightness: 75 } }), { verify: true });
  assert.equal(r.ok, true);
  assert.equal(r.displays.mon1.status, 'applied');
  assert.equal(r.displays.mon1.verified, true);
  assert.ok(win.lut['\\\\.\\DISPLAY2'].g[128] > 128 * 257);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY1'], calibration()), 0, 'other display untouched');
});

test('adjustments are composed on top of the existing calibration, and neutral gives it back', () => {
  const win = new FakeWindows();
  const e = boot(win);
  e.apply(cfg({ mon0: { gamma: 1.4 } }));
  assert.ok(win.lut['\\\\.\\DISPLAY1'].b[128] > calibration().b[128]);
  e.apply(cfg({ mon0: {} }), { verify: true });
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY1'], calibration()), 0);
});

test('untouched displays are never written', () => {
  const win = new FakeWindows();
  const e = boot(win);
  e.apply(cfg({ mon0: {} }), { verify: true, force: true });
  assert.equal(win.writes, 0);
});

test('when Windows refuses a ramp, the strongest accepted version is applied and reported as limited', () => {
  const win = new FakeWindows({ rejectBeyond: 9000 });
  const e = boot(win);
  const r = e.apply(cfg({ mon1: { brightness: 100 } }), { verify: true });
  assert.equal(r.displays.mon1.status, 'limited');
  assert.ok(r.displays.mon1.strength < 1);
  assert.match(r.displays.mon1.message, /Windows only accepted/);
  assert.ok(win.lut['\\\\.\\DISPLAY2'].g[128] > 128 * 257);
});

test('a refused ramp with no acceptable fallback is a failure, never reported as success', () => {
  const win = new FakeWindows({ rejectBeyond: 10 });
  const e = boot(win);
  const r = e.apply(cfg({ mon1: { brightness: 100 } }), { verify: true });
  assert.equal(r.ok, false);
  assert.equal(r.displays.mon1.status, 'failed');
  assert.match(r.displays.mon1.message, /rejected/);
});

test('HDR display: gamma ramp reported unavailable and not written', () => {
  const win = new FakeWindows();
  win.monitors[1].hdr.enabled = true;
  const e = boot(win);
  const r = e.apply(cfg({ mon1: { contrast: 70 } }));
  assert.equal(r.ok, false);
  assert.equal(r.displays.mon1.status, 'unavailable');
  assert.match(r.displays.mon1.message, /HDR/);
  assert.equal(win.writes, 0);
});

test('another program overriding the ramp is detected by read-back', () => {
  const win = new FakeWindows();
  win.overrideOn = '\\\\.\\DISPLAY2';
  const e = boot(win);
  const r = e.apply(cfg({ mon1: { brightness: 70 } }), { verify: true });
  assert.equal(r.displays.mon1.status, 'mismatch');
  assert.equal(r.ok, false);
});

test('saturation / vibrance / hue go to the colour matrix and are verified', () => {
  const win = new FakeWindows();
  const e = boot(win);
  const r = e.apply(cfg({}, { saturation: 150, hue: 20 }), { verify: true });
  assert.equal(r.matrix.status, 'applied');
  assert.equal(r.matrix.verified, true);
  assert.ok(!M.isIdentityMatrix(win.mag.m));
  e.apply(cfg({}, {}), { verify: true });
  assert.ok(M.isIdentityMatrix(win.mag.m));
});

test('matrix not touched until needed; unavailable matrix is reported, not faked', () => {
  const win = new FakeWindows({ magAvailable: false });
  const e = boot(win);
  assert.equal(e.apply(cfg({ mon0: { brightness: 60 } })).matrix.status, 'original');
  const r = e.apply(cfg({}, { saturation: 150 }));
  assert.equal(r.matrix.status, 'unavailable');
  assert.equal(r.ok, false);
});

test('A/B compare shows the real original output, then returns to the adjustment', () => {
  const win = new FakeWindows();
  const e = boot(win);
  e.commit(cfg({ mon1: { brightness: 80 } }, { saturation: 140 }));
  const on = e.compare(true);
  assert.equal(on.displays.mon1.status, 'compare');
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], M.identityRamp()), 0);
  assert.ok(M.isIdentityMatrix(win.mag.m));
  e.compare(false);
  assert.ok(win.lut['\\\\.\\DISPLAY2'].g[128] > 128 * 257);
  assert.ok(!M.isIdentityMatrix(win.mag.m));
});

test('preset values apply; reset all returns every display to its original ramp', () => {
  const win = new FakeWindows();
  const e = boot(win);
  e.commit(cfg({ mon0: { brightness: 55, contrast: 56, gamma: 1.18 }, mon1: { gainR: 80 } }, { vibrance: 76 }));
  assert.ok(win.lut['\\\\.\\DISPLAY1'].g[100] > calibration().g[100]);
  const r = e.restoreOriginal();
  assert.equal(r.ok, true);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY1'], calibration()), 0);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], M.identityRamp()), 0);
  assert.ok(M.isIdentityMatrix(win.mag.m));
  assert.equal(fs.existsSync(path.join(e.dir, 'color-session.json')), false);
});

test('restart: committed settings are saved and re-applied by a new engine', () => {
  const win = new FakeWindows();
  const dir = tmp();
  const e1 = boot(win, dir);
  e1.commit(cfg({ mon1: { brightness: 70 } }));
  const expected = copy(win.lut['\\\\.\\DISPLAY2']);
  e1.shutdown('restore');
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], M.identityRamp()), 0, 'restored on exit');
  const e2 = boot(win, dir);
  const r = e2.apply(e2.loadConfig(), { verify: true, force: true });
  assert.equal(r.displays.mon1.verified, true);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], expected), 0);
});

test('exit policy "keep" leaves the gamma ramp, removes the matrix, and is not treated as a crash', () => {
  const win = new FakeWindows();
  const dir = tmp();
  const e1 = boot(win, dir);
  e1.commit(cfg({ mon1: { brightness: 70 } }, { saturation: 150 }));
  const kept = copy(win.lut['\\\\.\\DISPLAY2']);
  e1.shutdown('keep');
  assert.ok(M.isIdentityMatrix(win.mag.m));
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], kept), 0);
  const e2 = boot(win, dir);
  assert.equal(e2.recovered, null);
  // The kept (modified) ramp must never be captured as the "original".
  e2.restoreOriginal();
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], M.identityRamp()), 0);
});

test('crash recovery at next launch restores the original ramps', () => {
  const win = new FakeWindows();
  const dir = tmp();
  const e1 = boot(win, dir);
  e1.commit(cfg({ mon0: { brightness: 90 }, mon1: { temperature: 3500 } }));
  // simulate a crash: no shutdown()
  const e2 = boot(win, dir);
  assert.ok(e2.recovered);
  assert.equal(e2.recovered.restored.length, 2);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY1'], calibration()), 0);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], M.identityRamp()), 0);
});

test('watchdog restores originals immediately when the app process dies', () => {
  const win = new FakeWindows();
  const dir = tmp();
  const e = boot(win, dir);
  e.commit(cfg({ mon1: { brightness: 90 } }, { hue: 40 }));
  const r = restoreFromLock({ dataDir: dir, parentPid: process.pid, backend: win });
  assert.equal(r.action, 'restored');
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], M.identityRamp()), 0);
  assert.ok(M.isIdentityMatrix(win.mag.m));
  // After a clean shutdown the watchdog must do nothing.
  const e2 = boot(win, dir); e2.commit(cfg({ mon1: { brightness: 90 } })); e2.shutdown('restore');
  assert.equal(restoreFromLock({ dataDir: dir, parentPid: process.pid, backend: win }).action, 'none');
});

test('multi-monitor: disconnect keeps settings, reconnect re-applies them', () => {
  const win = new FakeWindows({ displays: 3 });
  const e = boot(win);
  e.commit(cfg({ mon0: { brightness: 60 }, mon1: { gamma: 1.3 }, mon2: { gainB: 80 } }));
  const unplugged = win.monitors.splice(2, 1)[0];
  let r = e.handleDisplayChange();
  assert.deepEqual(r.change.removed, ['mon2']);
  assert.equal(r.displays.mon2.status, 'disconnected');
  assert.equal(r.displays.mon1.verified, true);
  win.monitors.push(unplugged);
  win.lut[unplugged.gdiName] = M.identityRamp();
  r = e.handleDisplayChange();
  assert.deepEqual(r.change.added, ['mon2']);
  assert.equal(r.displays.mon2.status, 'applied');
  assert.ok(win.lut[unplugged.gdiName].b[200] < 200 * 257);
});

test('resolution / refresh change that resets the LUT is detected and re-applied', () => {
  const win = new FakeWindows();
  const e = boot(win);
  e.commit(cfg({ mon1: { contrast: 75 } }));
  const good = copy(win.lut['\\\\.\\DISPLAY2']);
  win.modeChangeResetsLuts();
  assert.notEqual(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], good), 0);
  const r = e.handleDisplayChange();
  assert.equal(r.displays.mon1.verified, true);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], good), 0);
});

test('live preview coalesces rapid slider updates and ends on the latest value', async () => {
  const win = new FakeWindows();
  const e = boot(win);
  const ps = [];
  for (let v = 51; v <= 100; v++) ps.push(e.preview(cfg({ mon1: { brightness: v } })));
  const results = await Promise.all(ps);
  assert.ok(win.writes < 10, `expected coalescing, got ${win.writes} writes for 50 updates`);
  assert.equal(results[results.length - 1].displays.mon1.status, 'applied');
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY2'], M.buildRamp({ ...M.TONE_DEFAULTS, brightness: 100 })), 0);
});

test('self-test passes on a normal setup, and reports HDR displays as unavailable', async () => {
  const win = new FakeWindows();
  win.monitors[1].hdr.enabled = true;
  const e = boot(win);
  e.commit(cfg({ mon0: { brightness: 60 } }));
  const before = copy(win.lut['\\\\.\\DISPLAY1']);
  const rep = await runSelfTest(e, { stepMs: 0 });
  assert.equal(rep.failed, 0, JSON.stringify(rep.results.filter((r) => r.status === 'fail')));
  assert.ok(rep.passed >= 13);
  assert.equal(rep.unavailable, 1);
  assert.equal(M.maxRampDiff(win.lut['\\\\.\\DISPLAY1'], before), 0, 'settings restored after the test');
});

test('self-test fails loudly when Windows does not keep what was written', async () => {
  const win = new FakeWindows({ displays: 1 });
  win.overrideOn = '\\\\.\\DISPLAY1';
  const e = boot(win);
  const rep = await runSelfTest(e, { stepMs: 0 });
  assert.ok(rep.failed >= 8);
});
