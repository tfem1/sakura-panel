/* Launches the real Electron app and exercises the real preload -> ipcMain -> engine path.
 * On Windows this talks to the real display stack; elsewhere the engine must report
 * "unsupported" honestly (and the UI must say so) rather than pretend.
 *   node tests/electron-ipc.js   (Linux: run under xvfb-run)
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [path.resolve(__dirname, '..'), '--no-sandbox'],
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(e.message));
  await win.waitForTimeout(2500);
  const ok = (m) => console.log('PASS', m);

  const hasApi = await win.evaluate(() => !!(window.sakura && window.sakura.color && window.sakura.color.preview));
  assert.ok(hasApi); ok('preload exposes the colour API');

  const status = await win.evaluate(() => window.sakura.color.status());
  assert.equal(typeof status.supported, 'boolean');
  ok(`status over IPC: supported=${status.supported}${status.reason ? ' (' + status.reason + ')' : ''}, displays=${status.displays.length}`);

  const r = await win.evaluate(() => window.sakura.color.preview({ displays: {}, global: { saturation: 120 } }));
  if (status.supported) {
    assert.ok(r.matrix && ['applied', 'unavailable', 'failed'].includes(r.matrix.status));
    await win.evaluate(() => window.sakura.color.restoreOriginal());
  } else {
    assert.equal(r.ok, false); assert.equal(r.supported, false);
  }
  ok(`preview over IPC returns an honest result (ok=${r.ok}, matrix=${r.matrix.status})`);

  await win.evaluate(() => SP.go('color', { animate: false }));
  await win.waitForTimeout(300);
  const text = await win.textContent('[data-page="color"]');
  if (!status.supported) { assert.ok(text.includes('Display colour control unavailable')); ok('UI shows the engine is unavailable on this platform'); }
  else { assert.ok(text.includes('Gamma ramp')); ok('UI shows live engine status'); }

  await app.close();
  console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors');
  if (errs.length) process.exit(1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
