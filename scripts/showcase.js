/* Renders docs/screenshots/*.png and assets/brand/brand-sheet.png (2× DPR). node scripts/showcase.js */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs/screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'src/index.html');
const b64 = (f) => 'data:' + (f.endsWith('.png') ? 'image/png' : 'image/svg+xml') + ';base64,' + fs.readFileSync(path.join(ROOT, f)).toString('base64');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.goto(URL);
  await pg.waitForTimeout(260);
  await pg.screenshot({ path: path.join(SHOTS, '00-splash.png') });
  await pg.waitForTimeout(900);

  const shots = [
    ['01-dashboard', 'dashboard', 'midnight-sakura', 'simple'],
    ['02-color-control', 'color', 'midnight-sakura', 'advanced'],
    ['03-theme-studio', 'themes', 'midnight-sakura', 'simple'],
    ['04-presets-pure-sakura', 'presets', 'pure-sakura', 'simple'],
    ['05-profiles-crimson', 'profiles', 'crimson-sakura', 'advanced'],
    ['06-performance-graphite', 'performance', 'graphite', 'advanced'],
    ['07-display-rose-gold', 'display', 'rose-gold', 'advanced'],
    ['08-dashboard-minimal', 'dashboard', 'minimal-sakura', 'simple'],
  ];
  for (const [name, page, theme, view] of shots) {
    await pg.evaluate(([t, v, p]) => { SP.theme.apply(t, { animate: false }); SP.state.set('system.view', v); SP.go(p, { animate: false }); }, [theme, view, page]);
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.join(SHOTS, name + '.png') });
  }
  // Theme editor
  await pg.evaluate(() => { SP.theme.apply('midnight-sakura', { animate: false }); SP.go('themes', { animate: false }); });
  await pg.waitForTimeout(300);
  await pg.click('.sp-studio-info >> text=Customize');
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SHOTS, '09-theme-editor.png') });
  await pg.click('.sp-editor-foot >> text=Cancel');

  // Brand sheet
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: 1200, height: 760 });
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  await sheet.setContent(`<html><head><style>
    @font-face{font-family:Outfit;font-weight:300;src:url('${b64('src/fonts/outfit-latin-300-normal.woff2').replace('image/svg+xml', 'font/woff2')}')}
    body{margin:0;font:300 12px Outfit,sans-serif;letter-spacing:.14em;text-transform:uppercase}
    .row{display:flex}.p{flex:1;padding:44px 48px}.d{background:#0A090B;color:#8E8790}.l{background:#F6F1F3;color:#8B8189}
    .icons{display:flex;gap:30px;align-items:flex-end;padding:40px 48px;background:#141115;color:#8E8790}
    .icons figure{margin:0;display:grid;justify-items:center;gap:10px}
    .tb{display:flex;gap:40px;padding:26px 48px;background:#1C1C1C;color:#8E8790;align-items:center}
    .tb span{display:flex;gap:18px;align-items:center;padding:10px 16px;border-radius:8px}
    .sw{display:flex;height:70px}.sw div{flex:1;display:flex;align-items:flex-end;padding:10px;font-size:10px}
  </style></head><body>
  <div class="row"><div class="p d"><img src="${b64('assets/brand/sakura-logo-horizontal-dark.svg')}" height="74"><p style="margin-top:28px">Primary logo · dark</p></div>
  <div class="p l"><img src="${b64('assets/brand/sakura-logo-horizontal-light.svg')}" height="74"><p style="margin-top:28px">Primary logo · light</p></div></div>
  <div class="icons">${sizes.map((s) => `<figure><img src="${b64('assets/icons/app-icon-' + s + '.png')}" width="${s}" height="${s}"><figcaption>${s}</figcaption></figure>`).join('')}<figure style="margin-left:auto"><figcaption>App · desktop shortcut</figcaption></figure></div>
  <div class="tb"><span style="background:#202020">${[16, 24, 32].map((s) => `<img src="${b64('assets/icons/taskbar-icon-' + s + '.png')}" width="${s}">`).join('')}</span><span style="background:#F3F3F3">${[16, 24, 32].map((s) => `<img src="${b64('assets/icons/taskbar-icon-' + s + '.png')}" width="${s}">`).join('')}</span>Taskbar · dark & light</div>
  <div class="sw">${[['#FF5C9D', 'Sakura pink', '#1A0710'], ['#F6F1F3', 'Pearl white', '#5C545B'], ['#0A090B', 'Deep black', '#9D929A'], ['#2A2329', 'Graphite', '#C9BFC6'], ['#A996FF', 'Accent', '#1E1230']].map(([c, n, t]) => `<div style="background:${c};color:${t}">${n} ${c}</div>`).join('')}</div>
  </body></html>`);
  await sheet.waitForTimeout(400);
  await sheet.screenshot({ path: path.join(ROOT, 'assets/brand/brand-sheet.png'), fullPage: true });
  await b.close();
  console.log('Screenshots written to docs/screenshots and assets/brand/brand-sheet.png');
})();
