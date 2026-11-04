/* Checks the renderer's use of the Electron bridge with a stub window.sakura (no Electron needed). */
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const OUT = process.env.OUT || path.join(__dirname, 'out');

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 980, height: 680 } });
  await pg.addInitScript(() => {
    window.__calls = [];
    window.sakura = {
      setChrome: (c) => window.__calls.push(['chrome', c]),
      setPrefs: (p) => window.__calls.push(['prefs', p]),
      window: (a) => window.__calls.push(['window', a]),
    };
  });
  await pg.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await pg.waitForTimeout(1000);
  const calls = await pg.evaluate(() => window.__calls);
  assert.ok(calls.some(([k, c]) => k === 'chrome' && /^#[0-9A-F]{6}$/.test(c.background)), 'setChrome called with theme colour');
  assert.ok(calls.some(([k]) => k === 'prefs'), 'setPrefs called');
  assert.ok(await pg.evaluate(() => document.documentElement.classList.contains('is-electron')));
  const hidden = await pg.$$eval('.sp-winctrls button', (bs) => bs.every((x) => getComputedStyle(x).display === 'none'));
  assert.ok(hidden, 'custom caption buttons hidden in favour of native ones');
  await pg.evaluate(() => SP.theme.apply('ice-sakura'));
  const last = await pg.evaluate(() => window.__calls.filter((c) => c[0] === 'chrome').pop()[1]);
  assert.equal(last.background, '#EBF2F7');
  console.log('PASS electron bridge: chrome colours, prefs, native caption area');
  await pg.evaluate(() => SP.go('themes', { animate: false }));
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: OUT + '/min-window-themes.png' });
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
