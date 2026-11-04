/* End-to-end checks for the SAKURA PANEL UI (runs in headless Chromium).
 *   node tests/e2e.js            — needs `playwright` resolvable (pre-installed here)
 * Screenshots go to $OUT (defaults to tests/out). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const URL = 'file://' + path.resolve(__dirname, '../src/index.html');
const OUT = process.env.OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = (m) => console.log('PASS', m);
  const wait = (ms) => pg.waitForTimeout(ms);

  await pg.goto(URL); await wait(900);
  assert.equal(await pg.evaluate(() => SP.theme.activeId), 'midnight-sakura'); ok('default theme is Midnight Sakura');

  // Preview vs apply, persistence
  await pg.evaluate(() => SP.go('themes')); await wait(300);
  await pg.click('.sp-tcard[data-id="graphite"]');
  assert.equal(await pg.evaluate(() => SP.theme.activeId), 'midnight-sakura'); ok('single click previews without applying');
  await wait(100);
  const prevBg = await pg.$eval('.sp-tprev', (e) => getComputedStyle(e).getPropertyValue('--sp-bg').trim());
  assert.equal(prevBg.toUpperCase(), '#191B1E'); ok('preview pane uses the previewed theme');
  await pg.dblclick('.sp-tcard[data-id="graphite"]'); await wait(200);
  assert.equal(await pg.evaluate(() => SP.theme.activeId), 'graphite'); ok('double-click applies');
  await pg.reload(); await wait(900);
  assert.equal(await pg.evaluate(() => SP.theme.activeId), 'graphite');
  assert.equal((await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sp-bg').trim())).toUpperCase(), '#191B1E');
  ok('theme restored after restart');

  // Create + edit + save
  await pg.evaluate(() => SP.go('themes')); await wait(300);
  await pg.click('.sp-page-actions >> text=New theme'); await wait(300);
  assert.ok(await pg.$('.sp-editor')); ok('New theme opens the editor');
  const hex = await pg.$$('.sp-hex'); await hex[0].fill('#12AB34'); await wait(100);
  assert.equal(await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sp-primary').trim()), '#12AB34'); ok('live preview across the app');
  await pg.click('.sp-qa[title="Lavender"]'); await wait(150);
  await pg.screenshot({ path: OUT + '/studio-editor.png' });
  await pg.click('text=Save & apply'); await wait(300);
  const act = await pg.evaluate(() => SP.theme.active);
  assert.ok(!act.builtIn); assert.equal(act.tokens.primary, '#C6A4FF'); ok('custom theme saved & applied: ' + act.name);

  // Duplicate + delete
  const n0 = await pg.evaluate(() => SP.theme.list().length);
  await pg.click('button[title="Duplicate"]'); await wait(200);
  assert.equal(await pg.evaluate(() => SP.theme.list().length), n0 + 1); ok('duplicate');
  await pg.click('button[title="Delete theme"]'); await wait(200);
  await pg.click('.sp-dialog .sp-btn-danger'); await wait(300);
  assert.equal(await pg.evaluate(() => SP.theme.list().length), n0); ok('delete');

  // Export + import
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('button[title="Export as file"]')]);
  const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert.equal(data.format, 'sakura-panel-theme'); ok('export → ' + dl.suggestedFilename());
  data.name = 'Imported Test';
  fs.writeFileSync(OUT + '/imp.json', JSON.stringify(data));
  await pg.setInputFiles('input[type=file]', OUT + '/imp.json'); await wait(400);
  assert.ok(await pg.evaluate(() => SP.theme.list().some((t) => t.name === 'Imported Test'))); ok('import');
  fs.writeFileSync(OUT + '/bad.json', '{"hello":1}');
  await pg.setInputFiles('input[type=file]', OUT + '/bad.json'); await wait(300);
  assert.ok((await pg.textContent('.sp-toasts')).includes('not a SAKURA PANEL theme')); ok('invalid import rejected with a message');

  // Built-in override + reset
  await pg.evaluate(() => SP.theme.save('midnight-sakura', { tokens: { ...SP.theme.get('midnight-sakura').tokens, primary: '#00FF00' } }));
  assert.ok(await pg.evaluate(() => SP.theme.get('midnight-sakura').modified));
  await pg.evaluate(() => SP.theme.resetBuiltIn('midnight-sakura'));
  assert.equal(await pg.evaluate(() => SP.theme.get('midnight-sakura').tokens.primary), '#FF5C9D'); ok('built-in customise + reset');

  // Restore default
  await pg.click('.sp-page-actions >> text=Restore default'); await pg.click('.sp-dialog .sp-btn-primary'); await wait(300);
  assert.equal(await pg.evaluate(() => SP.theme.activeId), 'midnight-sakura'); ok('restore default theme');

  // Apply cycle
  await pg.evaluate(() => SP.go('color')); await wait(300);
  const bPath = await pg.evaluate(() => SP.tonePath('brightness'));
  const cPath = await pg.evaluate(() => SP.tonePath('contrast'));
  await pg.$eval(`.sp-row[data-path="${bPath}"] input[type=range]`, (e) => { e.value = 72; e.dispatchEvent(new Event('input')); });
  await wait(100);
  assert.ok(await pg.$eval('.sp-applybar', (e) => e.classList.contains('is-visible')));
  assert.ok(await pg.$eval(`.sp-row[data-path="${bPath}"]`, (e) => e.classList.contains('is-modified'))); ok('change shows apply bar + modified marker');
  assert.ok((await pg.textContent('.sp-engine-banner')).includes('Preview build')); ok('browser preview says plainly that the screen will not change');
  await pg.click('.sp-applybar .sp-btn-primary'); await wait(1000);
  assert.ok(!(await pg.$eval('.sp-applybar', (e) => e.classList.contains('is-visible')))); ok('apply clears the bar');
  await pg.reload(); await wait(900);
  assert.equal(await pg.evaluate((p) => SP.state.getApplied(p), bPath), 72); ok('applied settings persist');
  await pg.evaluate(() => SP.go('color')); await wait(200);
  await pg.$eval(`.sp-row[data-path="${cPath}"] input[type=range]`, (e) => { e.value = 10; e.dispatchEvent(new Event('input')); });
  await pg.click('.sp-applybar >> text=Discard'); await wait(200);
  assert.equal(await pg.evaluate((p) => SP.state.get(p), cPath), 50);
  assert.equal(await pg.$eval(`.sp-row[data-path="${cPath}"] input`, (e) => e.value), '50'); ok('discard reverts');

  // Search reveals advanced settings
  await pg.evaluate(() => SP.state.set('system.view', 'simple')); await wait(100);
  await pg.fill('.sp-search input', 'shader'); await pg.keyboard.press('Enter'); await wait(800);
  assert.equal(await pg.evaluate(() => location.hash), '#/advanced');
  assert.equal(await pg.evaluate(() => document.documentElement.dataset.view), 'advanced'); ok('search jumps to an advanced setting and reveals it');
  await pg.screenshot({ path: OUT + '/search-result.png' });

  // Every page in every theme
  const themes = await pg.evaluate(() => SP.theme.list().map((t) => t.id));
  const pages = await pg.evaluate(() => SP.pages.map((p) => p.id));
  for (const t of themes) {
    await pg.evaluate((t) => SP.theme.apply(t, { animate: false }), t);
    for (const id of pages) await pg.evaluate((id) => SP.go(id, { animate: false }), id);
  }
  ok(`${pages.length} pages × ${themes.length} themes rendered`);

  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  await b.close();
  if (errs.length) process.exit(1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
