/* Full-chain UI test: real renderer -> preload-shaped API -> colour bridge -> REAL ColorEngine
 * (running here in Node) -> simulated Windows display stack. Checks that moving a slider in
 * the actual UI changes the (simulated) hardware LUT, and that every reported status is true.
 *   node tests/electron-bridge.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const M = require('../src/js/color-math.js');
const { ColorEngine } = require('../electron/color/engine.js');
const { runSelfTest } = require('../electron/color/selftest.js');
const { FakeWindows, calibration } = require('./helpers/fake-windows.js');

const OUT = process.env.OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const D1 = '\\\\.\\DISPLAY1', D2 = '\\\\.\\DISPLAY2';

(async () => {
  const win = new FakeWindows({ displays: 2 });
  const engine = new ColorEngine({ backend: win, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-ui-')) });
  engine.init();

  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = (m) => console.log('PASS', m);
  const wait = (ms) => pg.waitForTimeout(ms);

  await pg.exposeFunction('__colorCall', async (method, arg) => {
    switch (method) {
      case 'status': return engine.status();
      case 'preview': return engine.preview(arg);
      case 'commit': return engine.commit(arg);
      case 'compare': return engine.compare(arg);
      case 'restoreOriginal': return engine.restoreOriginal();
      case 'selfTest': return runSelfTest(engine, { stepMs: 0, onStep: (r) => pg.evaluate((x) => window.__onStep && window.__onStep(x), r).catch(() => {}) });
      default: throw new Error('unknown ' + method);
    }
  });
  await pg.addInitScript(() => {
    window.__calls = [];
    window.sakura = {
      setChrome: (c) => window.__calls.push(['chrome', c]),
      setPrefs: (p) => window.__calls.push(['prefs', p]),
      window: (a) => window.__calls.push(['window', a]),
      color: {
        status: () => window.__colorCall('status'),
        preview: (c) => window.__colorCall('preview', c),
        commit: (c) => window.__colorCall('commit', c),
        compare: (on) => window.__colorCall('compare', on),
        restoreOriginal: () => window.__colorCall('restoreOriginal'),
        selfTest: () => window.__colorCall('selfTest'),
        onResults: (cb) => { window.__onResults = cb; return () => {}; },
        onSelfTestStep: (cb) => { window.__onStep = cb; return () => { window.__onStep = null; }; },
      },
    };
  });

  await pg.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await wait(1200);

  // Shell integration
  const calls = await pg.evaluate(() => window.__calls);
  assert.ok(calls.some(([k, c]) => k === 'chrome' && /^#[0-9A-F]{6}$/.test(c.background)));
  assert.ok(calls.some(([k, p]) => k === 'prefs' && p.colorOnExit === 'restore'));
  ok('window chrome + prefs (incl. colour exit policy) sent to main');

  // Real monitors replace the sample list
  assert.deepEqual(await pg.evaluate(() => SP.DISPLAYS.map((d) => d.name)), ['Monitor 1', 'Monitor 2']);
  ok('displays come from the engine, not sample data');

  await pg.evaluate(() => SP.go('color', { animate: false })); await wait(300);
  const key0 = await pg.evaluate(() => SP.colorKey());
  assert.equal(key0, 'mon0'); ok('primary display selected by default');

  // 1. Live preview: dragging a slider changes the hardware LUT before Apply
  const setSlider = async (p, v) => { await pg.$eval(`.sp-row[data-path="${p}"] input[type=range]`, (e, val) => { e.value = val; e.dispatchEvent(new Event('input')); }, v); await wait(150); };
  await setSlider('color.displays.mon0.brightness', 80);
  assert.ok(win.lut[D1].g[128] > calibration().g[128] + 2000, 'LUT raised');
  assert.equal(M.maxRampDiff(win.lut[D2], M.identityRamp()), 0, 'other display untouched');
  assert.ok((await pg.textContent('.sp-engine')).includes('Active'));
  ok('slider move → engine → hardware LUT changes live (display 1 only)');

  // 2. Discard instantly restores previous values on the hardware
  await pg.click('.sp-applybar >> text=Discard'); await wait(250);
  assert.equal(M.maxRampDiff(win.lut[D1], calibration()), 0);
  ok('Discard restores the previous output on the hardware');

  // 3. Apply commits, verifies, reports success only after read-back
  await setSlider('color.displays.mon0.contrast', 70);
  await pg.click('.sp-applybar .sp-btn-primary'); await wait(400);
  assert.ok((await pg.textContent('.sp-toasts')).includes('verified'));
  const committed = JSON.parse(fs.readFileSync(path.join(engine.dir, 'color-config.json'), 'utf8'));
  assert.equal(committed.displays.mon0.tone.contrast, 70);
  assert.ok((await pg.textContent('.sp-engine')).includes('verified'));
  ok('Apply → verified by read-back, saved for next launch, success shown only then');

  // 4. Global colour matrix
  await setSlider('color.global.saturation', 150);
  assert.ok(!M.isIdentityMatrix(win.mag.m));
  ok('saturation slider → Windows colour matrix');

  // 5. Real A/B compare
  await pg.dispatchEvent('.sp-card-actions .sp-btn:has-text("Hold to compare")', 'pointerdown'); await wait(200);
  assert.equal(M.maxRampDiff(win.lut[D1], calibration()), 0);
  assert.ok(M.isIdentityMatrix(win.mag.m));
  await pg.dispatchEvent('.sp-card-actions .sp-btn:has-text("Hold to compare")', 'pointerup'); await wait(200);
  assert.ok(win.lut[D1].g[200] > calibration().g[200]);
  assert.ok(!M.isIdentityMatrix(win.mag.m));
  ok('Hold to compare shows the real original output, release restores the adjustment');
  await pg.click('.sp-applybar >> text=Discard'); await wait(250);

  // 6. Windows refusing a change → error, never "applied"
  win.rejectBeyond = 10;
  await setSlider('color.displays.mon0.gamma', 2.4);
  await pg.click('.sp-applybar .sp-btn-primary'); await wait(400);
  const toasts = await pg.textContent('.sp-toasts');
  assert.ok(toasts.includes('could not be applied'));
  assert.ok((await pg.textContent('.sp-engine')).includes('Failed'));
  ok('refused ramp → error toast + "Failed" status, no false success');
  win.rejectBeyond = null;

  // 7. Presets reach the display
  await pg.evaluate(() => SP.go('presets', { animate: false })); await wait(200);
  await pg.click('.sp-preset:has-text("Competitive") .sp-btn-primary'); await wait(300);
  assert.ok(win.lut[D1].g[100] > calibration().g[100] + 1000);
  ok('preset → live on the display');

  // 8. Restore original: hardware back to calibration, sliders neutral
  await pg.evaluate(() => SP.go('color', { animate: false })); await wait(200);
  await pg.click('.sp-page-actions >> text=Restore original'); await pg.click('.sp-dialog .sp-btn-primary'); await wait(400);
  assert.equal(M.maxRampDiff(win.lut[D1], calibration()), 0);
  assert.ok(M.isIdentityMatrix(win.mag.m));
  assert.equal(await pg.evaluate(() => SP.state.getApplied('color.displays.mon0.brightness')), 50);
  assert.equal(await pg.evaluate(() => SP.state.changes()), 0);
  ok('Restore original → hardware + settings back to the original state');

  // 9. HDR display: explained, controls disabled, nothing written
  win.monitors[1].hdr.enabled = true;
  engine.handleDisplayChange();
  await pg.reload(); await wait(1200);
  await pg.evaluate(() => { SP.state.set('color.display', 'mon1'); SP.go('color', { animate: false }); }); await wait(300);
  assert.ok((await pg.textContent('[data-page="color"]')).includes('HDR / Advanced Color is on'));
  assert.ok(await pg.$eval('.sp-row[data-path="color.displays.mon1.brightness"] input', (e) => e.disabled));
  ok('HDR display → clear explanation, tone controls disabled');
  assert.equal(await pg.evaluate(() => SP.state.changes()), 0);
  ok('switching the edited display is not a pending change');
  await pg.screenshot({ path: OUT + '/color-hdr.png' });

  // 10. Self-test from the UI
  await pg.evaluate(() => { SP.state.set('color.display', 'mon0'); SP.go('color', { animate: false }); }); await wait(300);
  await pg.click('text=Run display self-test'); await pg.click('.sp-dialog .sp-btn-primary'); await wait(1500);
  const sum = await pg.textContent('.sp-selftest-sum');
  assert.match(sum, /2 display\(s\): 1[3-9] passed · 0 failed · 1 unavailable/);
  ok('self-test from the UI: ' + sum);
  await pg.screenshot({ path: OUT + '/color-live.png', fullPage: false });

  // 11. Not-connected sections say so
  await pg.evaluate(() => SP.go('advanced', { animate: false })); await wait(200);
  assert.ok((await pg.textContent('.sp-notconnected')).includes('Not connected to the GPU driver yet'));
  ok('3D settings page states it is not connected');

  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  await b.close();
  if (errs.length) process.exit(1);
})().catch((e) => { console.error('FAIL', e.stack || e.message); process.exit(1); });
