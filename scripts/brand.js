/*
 * SAKURA PANEL — brand asset generator.
 *
 * Generates every logo / icon SVG from one parametric blossom definition,
 * converts the wordmark to outlined paths (no font dependency), rasterises
 * PNGs with the pre-installed Chromium and packs Windows .ico files.
 *
 *   node scripts/brand.js
 */
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const ROOT = path.resolve(__dirname, '..');
const BRAND = path.join(ROOT, 'assets', 'brand');
const ICONS = path.join(ROOT, 'assets', 'icons');
const APP_ASSETS = path.join(ROOT, 'src', 'assets');
[BRAND, ICONS, APP_ASSETS].forEach((d) => fs.mkdirSync(d, { recursive: true }));

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */
const C = {
  petalLight: '#FFC2DA',
  petalDeep: '#F0609B',
  petalSolid: '#FF7BB0',
  core: '#FFF4F8',
  ink: '#0B090C',
  tileTop: '#1D161C',
  tileBottom: '#09080A',
  pearl: '#F6F1F3',
  graphite: '#8E8790',
};

/* ------------------------------------------------------------------ */
/* Geometry — one petal pointing up inside a 100×100 box, centre 50,50 */
/* Each petal is split down its axis into two facets (light / deep),   */
/* which gives the folded, geometric "origami" read.                  */
/* ------------------------------------------------------------------ */
const PETAL_LEFT = 'M50 43 C45 38 35 28 35.4 18 C35.8 11 40.4 6.4 45 5 L50 11.2 Z';
const PETAL_RIGHT = 'M50 43 L50 11.2 L55 5 C59.6 6.4 64.2 11 64.6 18 C65 28 55 38 50 43 Z';
// Bolder silhouette for 16–32 px: wider body, deeper notch, single tone.
const PETAL_SMALL = 'M50 44.5 C43 39.5 31.6 28.5 32 17 C32.4 9.6 38.4 4 44.4 3.4 L50 12.6 L55.6 3.4 C61.6 4 67.6 9.6 68 17 C68.4 28.5 57 39.5 50 44.5 Z';

const ROT = [0, 72, 144, 216, 288];

function blossom({ faceted = true, small = false, light = C.petalLight, deep = C.petalDeep, solid = C.petalSolid, core = C.core, coreR = 4.2, mono = null } = {}) {
  const parts = ROT.map((r) => {
    const t = `rotate(${r} 50 50)`;
    if (mono) return `<path transform="${t}" d="${small ? PETAL_SMALL : PETAL_LEFT + ' ' + PETAL_RIGHT}" fill="${mono}"/>`;
    if (small || !faceted) return `<path transform="${t}" d="${small ? PETAL_SMALL : PETAL_LEFT + ' ' + PETAL_RIGHT}" fill="${solid}"/>`;
    return `<g transform="${t}"><path d="${PETAL_LEFT}" fill="${light}"/><path d="${PETAL_RIGHT}" fill="${deep}"/></g>`;
  }).join('');
  // The core is a pentagon-cut ring: negative space in the middle reads at every size.
  const coreEl = mono
    ? ''
    : `<circle cx="50" cy="50" r="${coreR}" fill="${core}"/>`;
  return `<g>${parts}${coreEl}</g>`;
}

const svg = (vb, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}>${body}</svg>\n`;

/* ------------------------------------------------------------------ */
/* Wordmark → outlined paths                                           */
/* ------------------------------------------------------------------ */
const fontFile = (w) => path.join(ROOT, 'node_modules/@fontsource/outfit/files', `outfit-latin-${w}-normal.woff`);
const loadFont = (w) => { const b = fs.readFileSync(fontFile(w)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const fontMedium = loadFont(500);
const fontLight = loadFont(300);

function textPath(font, text, x, baseline, size, tracking) {
  let cursor = x;
  const ds = [];
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    const p = g.getPath(cursor, baseline, size);
    ds.push(p.toPathData(2));
    cursor += (g.advanceWidth / font.unitsPerEm) * size + tracking;
  }
  return { d: ds.join(''), width: cursor - x - tracking };
}

function wordmark(x, baseline, size, colorA, colorB) {
  const track = size * 0.3;
  const a = textPath(fontMedium, 'SAKURA', x, baseline, size, track);
  const gap = size * 0.62;
  const b = textPath(fontLight, 'PANEL', x + a.width + gap, baseline, size, track);
  return {
    body: `<path d="${a.d}" fill="${colorA}"/><path d="${b.d}" fill="${colorB}"/>`,
    width: a.width + gap + b.width,
  };
}

/* ------------------------------------------------------------------ */
/* Compositions                                                        */
/* ------------------------------------------------------------------ */
const out = {};

// 1. Mark (faceted, transparent)
out['brand/sakura-mark.svg'] = svg('0 0 100 100', blossom());
// 2. Mark — monochrome (currentColor) for UI use and single-colour print
out['brand/sakura-mark-mono.svg'] = svg('0 0 100 100', blossom({ mono: 'currentColor' }));

// 3. Horizontal full logo, dark + light backgrounds
function horizontal(onDark) {
  const markSize = 64;
  const wm = wordmark(markSize + 22, 44.5, 26, onDark ? C.pearl : C.ink, onDark ? '#C9BFC6' : '#5C545B');
  const w = Math.ceil(markSize + 22 + wm.width + 2);
  const sub = textPath(fontLight, 'GRAPHICS CONTROL', markSize + 23, 60, 8.2, 8.2 * 0.62);
  return svg(`0 0 ${w} 68`,
    `<g transform="translate(0 2) scale(0.64)">${blossom(onDark ? {} : { light: '#F7A6C8', deep: '#DD4387', core: '#FFFFFF' })}</g>` +
    wm.body +
    `<path d="${sub.d}" fill="${onDark ? C.graphite : '#8B8189'}"/>`,
    `width="${w * 4}" height="${68 * 4}"`);
}
out['brand/sakura-logo-horizontal-dark.svg'] = horizontal(true);
out['brand/sakura-logo-horizontal-light.svg'] = horizontal(false);

// 4. Stacked logo (splash / about)
function stacked(onDark) {
  const wm = wordmark(0, 0, 22, onDark ? C.pearl : C.ink, onDark ? '#C9BFC6' : '#5C545B');
  const W = Math.ceil(Math.max(wm.width, 120) + 40);
  const wmX = (W - wm.width) / 2;
  const wm2 = wordmark(wmX, 152, 22, onDark ? C.pearl : C.ink, onDark ? '#C9BFC6' : '#5C545B');
  const markX = (W - 110) / 2;
  return svg(`0 0 ${W} 166`, `<g transform="translate(${markX} 4) scale(1.1)">${blossom(onDark ? {} : { light: '#F7A6C8', deep: '#DD4387', core: '#FFFFFF' })}</g>${wm2.body}`);
}
out['brand/sakura-logo-stacked-dark.svg'] = stacked(true);
out['brand/sakura-logo-stacked-light.svg'] = stacked(false);

// 5. App icon tile (desktop shortcut, Start menu, installer) — 48 px and up
const TILE_DEFS = `<defs>
  <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.tileTop}"/><stop offset="1" stop-color="${C.tileBottom}"/></linearGradient>
  <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FF5C9D" stop-opacity="0.32"/><stop offset="1" stop-color="#FF5C9D" stop-opacity="0"/></radialGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.02"/></linearGradient>
</defs>`;
out['icons/app-icon.svg'] = svg('0 0 256 256',
  TILE_DEFS +
  `<rect x="8" y="8" width="240" height="240" rx="56" fill="url(#tile)"/>` +
  `<rect x="8.75" y="8.75" width="238.5" height="238.5" rx="55.25" fill="none" stroke="url(#rim)" stroke-width="1.5"/>` +
  `<circle cx="128" cy="128" r="104" fill="url(#halo)"/>` +
  `<g transform="translate(40 40) scale(1.76)">${blossom()}</g>`);

// 6. Small tile (16–32 px): heavier petals, no gradients that turn to mud
out['icons/app-icon-small.svg'] = svg('0 0 32 32',
  `<rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#141015"/>` +
  `<g transform="translate(2.6 2.6) scale(0.268)">${blossom({ small: true, core: '#141015', coreR: 5.2 })}</g>`);

// 7. Taskbar glyph: transparent, bold, works on light and dark taskbars
out['icons/taskbar-icon.svg'] = svg('0 0 32 32',
  `<g transform="translate(0.4 0.4) scale(0.312)">${blossom({ small: true, solid: '#FF6FA8', core: '#FFF4F8', coreR: 5.4 })}</g>`);

// 8. UI copies used by the app itself
out['../src/assets/sakura-mark.svg'] = out['brand/sakura-mark.svg'];
out['../src/assets/app-icon.svg'] = out['icons/app-icon.svg'];

for (const [rel, data] of Object.entries(out)) {
  const file = path.join(ROOT, 'assets', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

/* ------------------------------------------------------------------ */
/* Raster + ICO                                                        */
/* ------------------------------------------------------------------ */
function packIco(pngs) {
  // pngs: [{size, buf}] — PNG-compressed ICO entries (Vista+).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(buf.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) {
    console.log('SVGs written. Playwright not found — skipping PNG/ICO rasterisation.');
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  async function render(svgText, size) {
    await page.setViewportSize({ width: size, height: size });
    const uri = 'data:image/svg+xml;base64,' + Buffer.from(svgText).toString('base64');
    await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${uri}" width="${size}" height="${size}" style="display:block"></body></html>`);
    await page.waitForFunction(() => document.images[0].complete);
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }

  const big = out['icons/app-icon.svg'];
  const small = out['icons/app-icon-small.svg'];
  const glyph = out['icons/taskbar-icon.svg'];

  const appSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const appPngs = [];
  for (const s of appSizes) {
    const buf = await render(s <= 32 ? small : big, s);
    appPngs.push({ size: s, buf });
    fs.writeFileSync(path.join(ICONS, `app-icon-${s}.png`), buf);
  }
  fs.writeFileSync(path.join(ICONS, 'app-icon-512.png'), await render(big, 512));
  fs.writeFileSync(path.join(ICONS, 'sakura-panel.ico'), packIco(appPngs));
  // Desktop shortcut icon = full tile at every size Explorer asks for.
  fs.copyFileSync(path.join(ICONS, 'sakura-panel.ico'), path.join(ICONS, 'desktop-shortcut.ico'));

  const taskSizes = [16, 20, 24, 32, 40, 48, 64, 256];
  const taskPngs = [];
  for (const s of taskSizes) {
    const buf = await render(s <= 48 ? glyph : out['brand/sakura-mark.svg'], s);
    taskPngs.push({ size: s, buf });
    fs.writeFileSync(path.join(ICONS, `taskbar-icon-${s}.png`), buf);
  }
  fs.writeFileSync(path.join(ICONS, 'taskbar.ico'), packIco(taskPngs));
  fs.copyFileSync(path.join(ICONS, 'app-icon-256.png'), path.join(APP_ASSETS, 'app-icon-256.png'));

  // Brand sheet PNGs
  fs.writeFileSync(path.join(BRAND, 'sakura-mark-1024.png'), await render(out['brand/sakura-mark.svg'], 1024));
  await browser.close();
  console.log('Brand assets written to assets/ and src/assets/');
})();
