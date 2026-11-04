# SAKURA PANEL

A graphics control panel for Windows, styled after Japanese cherry blossoms.

![Dashboard](docs/screenshots/01-dashboard.png)

> **Status:** the complete interface, brand identity and theme system are done. **No GPU driver backend is connected yet.** Settings are saved and the apply cycle works end to end, but the values come from `SP.telemetry` and `SP.state.apply()` in place of a real driver. The title bar shows *Demo telemetry* until a backend replaces them.

## Run

```bash
npm install
npm start            # Electron window (Windows-style native caption buttons, tray, taskbar icon)
npm run dist         # Windows installer (NSIS) with desktop + Start-menu shortcuts
```

The UI also runs on its own: open `src/index.html` in Chromium or Edge.

```bash
npm test                     # 21 end-to-end checks in headless Chromium
node tests/electron-bridge.js
npm run brand                # regenerate every logo / icon / .ico from scripts/brand.js
node scripts/showcase.js     # regenerate docs/screenshots and the brand sheet
```

## Brand identity

![Brand sheet](assets/brand/brand-sheet.png)

The mark is a geometric blossom with five petals. Each petal has the cherry-blossom notch and is split into a light facet and a deep facet, which gives a folded, origami look. A negative-space core sits in the middle. Every asset is generated from one parametric definition in `scripts/brand.js`. The wordmark is converted to outlines, so the logo files don't need a font installed.

| Asset | File |
|---|---|
| Full logo (dark / light, horizontal / stacked) | `assets/brand/sakura-logo-*.svg` |
| Mark (colour / mono `currentColor`) | `assets/brand/sakura-mark*.svg`, `sakura-mark-1024.png` |
| Application icon: tile, 16–256 px. Sizes 16–32 px use a heavier glyph made for small sizes | `assets/icons/sakura-panel.ico`, `app-icon-*.png`, `app-icon.svg` |
| Desktop shortcut icon | `assets/icons/desktop-shortcut.ico` (installer shortcuts use the exe icon, which is the same file) |
| Windows taskbar icon (transparent, reads on dark and light taskbars) | `assets/icons/taskbar.ico`, `taskbar-icon-*.png` |

Typography: **Outfit** for display and wordmark, **Inter** for UI text. Both are bundled under the SIL OFL (`src/fonts/`). Base palette: Sakura pink `#FF5C9D`, pearl white `#F6F1F3`, deep black `#0A090B`, graphite `#2A2329`, soft-violet accent `#A996FF`. Pink is kept for active states and highlights. Surfaces stay neutral.

Inside the app the blossom is drawn inline. Its two facets come from the active theme, so the mark is grey and white in *Black & White* and blue in *Ice Sakura*.

## Themes

There are 12 built-in themes. **Midnight Sakura** is the default.

Sakura Pink · Midnight Sakura · Pure Sakura · Dark Blossom · Crimson Sakura · Lavender Sakura · Ice Sakura · Black & White · Graphite · Rose Gold · Deep Red · Minimal Sakura

A theme is a flat set of tokens (`src/js/themes.js` → `SP.TOKEN_SCHEMA`):

- **Brand:** primary, secondary, accent
- **Surfaces:** background, background gradient, sidebar, panel, raised panel, panel opacity
- **Text and lines:** text, muted text, borders
- **Controls:** button, button text, slider track / fill / thumb
- **Effects:** hover tint and strength, animation colour, glow intensity

`theme-engine.js` turns these tokens into CSS variables, including derived ones such as soft fills, focus rings and shadows. Every page uses only those variables, so each theme looks the same across all nine pages.

**Theme Studio** lets you:
- browse every theme, preview it (click) and apply it (double-click or **Apply theme**)
- customise every token, with a live preview and an optional live preview across the whole app
- pick a quick sakura or monochrome accent
- see a low-contrast warning while editing
- create, duplicate, delete, rename and save themes
- edit a built-in theme (saved as an override you can reset)
- import and export `.sakura-theme.json` files (validated, max 64 KB)
- restore the default theme

The active theme is saved and painted before the first frame on the next launch. In Electron, the native caption buttons and the window background are recoloured to match.

Theme file format:

```json
{ "format": "sakura-panel-theme", "version": 1, "name": "My Sakura", "mode": "dark",
  "tokens": { "primary": "#FF5C9D", "background": "#0A090B", "panelOpacity": 0.94, "...": "..." } }
```

## Pages

| Page | What it covers |
|---|---|
| Dashboard | Status, quick adjustments, activity, display summary, one-click theme switch, profiles |
| Color Control | Brightness, contrast, gamma, vibrance and hue, with a live reference image and transfer curve. Advanced: per-channel gamma and output format |
| Display Settings | Monitor arrangement, resolution, refresh rate, rotation, VRR, HDR. Advanced: scaling, overscan |
| Game Profiles | Per-program overrides (preset, latency, FPS cap, V-Sync, power, colour) |
| Presets | Six built-in looks with filtered previews, plus your own saved presets |
| Advanced Settings | Essential 3D settings first. Advanced: image quality, frame pacing, shaders |
| Performance | Live chart with toggleable series, power limit, cooling. Advanced: clock offsets |
| Theme Studio | See above |
| System Settings | Startup, tray, start page, detail level, animation level, UI scale, export/reset, about |

**UX:**
- **Simple / Advanced** detail switch: Simple hides expert controls.
- Settings search (**Ctrl K**): finds hidden controls and highlights them.
- Hardware-style settings are staged. A modified dot marks each changed row, and an **Apply / Discard** bar appears (Ctrl Enter applies).
- UI preferences apply instantly.

**Motion:** page fades, a sliding nav indicator, animated slider fills, spring toggles, expanding sections, toasts, an "applied" flash, a themed splash and theme crossfades. Animations use transform, opacity and colour only: no blur, no particles. Animation levels are Full / Reduced / Off, and the app respects `prefers-reduced-motion`. Telemetry updates once a second and pauses when no page is watching it.

## Structure

```
electron/      main.js (window, native caption overlay, tray, single instance, window state), preload.js (validated bridge)
src/           index.html, css/, js/ (themes, theme-engine, ui components, state, data, app shell, pages/)
assets/        brand/ and icons/ (generated)
scripts/       brand.js (asset generator), showcase.js (screenshots)
tests/         e2e.js, electron-bridge.js
```

**Connecting real hardware:**
1. Replace `SP.telemetry` (`src/js/data.js`) and the body of `SP.state.apply()` (`src/js/state.js`) with calls through `preload.js` to a native driver module.
2. Remove the *Demo telemetry* chip.
