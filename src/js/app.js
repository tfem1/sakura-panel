/* SAKURA PANEL — application shell: title bar, navigation, router, search, apply bar. */
(function () {
  const SP = window.SP;
  const { h, icon, mark } = SP.ui;
  const root = document.documentElement;

  const GROUPS = [
    ['overview', 'Overview'],
    ['display', 'Display'],
    ['gaming', '3D & Gaming'],
    ['system', 'System'],
  ];
  const pages = SP.pages;
  const byId = Object.fromEntries(pages.map((p) => [p.id, p]));

  if (window.sakura) root.classList.add('is-electron');

  /* ---------------- UI preferences ---------------- */
  function applyPrefs() {
    const s = SP.state.applied.system;
    root.dataset.view = s.view;
    root.dataset.motion = s.motion;
    root.style.setProperty('--ui-scale', String(s.scale / 100));
    if (window.sakura && window.sakura.setPrefs) window.sakura.setPrefs({ tray: s.tray, startWithWindows: s.startWithWindows });
  }
  applyPrefs();

  /* ---------------- shell ---------------- */
  const navButtons = {};
  const nav = h('nav', { class: 'sp-nav', 'aria-label': 'Sections' },
    GROUPS.map(([g, label]) => h('div', { class: 'sp-nav-group' },
      h('div', { class: 'sp-nav-label' }, label),
      pages.filter((p) => p.group === g).map((p) => {
        const b = h('button', { type: 'button', class: 'sp-nav-item', title: p.title, onclick: () => go(p.id) }, icon(p.icon), h('span', null, p.title));
        navButtons[p.id] = b;
        return b;
      }))));

  const searchInput = h('input', { type: 'search', placeholder: 'Search settings', 'aria-label': 'Search settings', spellcheck: 'false' });
  const searchResults = h('div', { class: 'sp-search-results', role: 'listbox' });
  const search = h('div', { class: 'sp-search' }, icon('search'), searchInput, h('kbd', null, 'Ctrl K'), searchResults);

  const themeChipSw = h('span', { class: 'sp-theme-chip-sw' });
  const themeChipName = h('strong');
  const themeChip = h('button', { type: 'button', class: 'sp-theme-chip', title: 'Open Theme Studio', onclick: () => go('themes') },
    themeChipSw, h('div', null, h('small', null, 'Theme'), themeChipName), icon('chevron'));

  const viewSeg = h('div');
  function paintViewSeg() {
    viewSeg.replaceChildren(SP.ui.segmented({ label: 'Interface detail', value: SP.state.applied.system.view, options: [['simple', 'Simple'], ['advanced', 'Advanced']],
      onChange: (v) => { SP.state.set('system.view', v); if (current === 'system') SP.refresh(); } }));
  }
  paintViewSeg();

  const sidebar = h('aside', { class: 'sp-sidebar' }, search, nav,
    h('div', { class: 'sp-sidebar-foot' },
      h('div', { class: 'sp-viewmode' }, h('span', { class: 'sp-viewmode-label' }, 'Detail'), viewSeg),
      themeChip));

  const winBtn = (name, action, cls) => h('button', { type: 'button', class: cls || '', title: name[0].toUpperCase() + name.slice(1), 'aria-label': name,
    onclick: () => window.sakura && window.sakura.window && window.sakura.window(action) }, icon(name));

  const titlebar = h('header', { class: 'sp-titlebar' },
    mark(18),
    h('div', { class: 'sp-brand-word' }, h('b', null, 'SAKURA'), h('span', null, 'PANEL')),
    h('div', { class: 'sp-titlebar-spacer' }),
    h('div', { class: 'sp-titlebar-status', title: 'No hardware backend is connected — values are simulated.' }, h('i'), 'Demo telemetry'),
    h('div', { class: 'sp-winctrls' }, winBtn('minimize', 'minimize'), winBtn('maximize', 'maximize'), winBtn('close', 'close', 'is-close')));

  const scroller = h('div', { class: 'sp-scroll' });
  const applyCount = h('span');
  const applyBtn = SP.ui.button('Apply', { variant: 'primary', onClick: doApply });
  const applybar = h('div', { class: 'sp-applybar', role: 'region', 'aria-label': 'Pending changes' },
    h('div', { class: 'sp-applybar-text' }, h('i'), applyCount),
    SP.ui.button('Discard', { variant: 'ghost', onClick: () => SP.state.discard() }),
    applyBtn);
  const main = h('main', { class: 'sp-main' }, scroller, applybar);

  const app = h('div', { class: 'sp-app' }, titlebar, sidebar, main);
  document.body.prepend(app);

  /* ---------------- router ---------------- */
  let current = null;
  let cleanup = null;
  function go(id, opts = {}) {
    if (!byId[id]) id = 'dashboard';
    if (location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
    render(id, opts);
  }
  function render(id, opts = {}) {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    const page = byId[id];
    current = id;
    Object.entries(navButtons).forEach(([pid, b]) => { if (pid === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const el = h('div', { class: 'sp-page' + (opts.animate === false ? '' : ' is-entering'), 'data-page': id });
    try {
      cleanup = page.render(el) || null;
    } catch (e) {
      console.error(e);
      el.appendChild(h('div', { class: 'sp-note is-warn' }, icon('warning'), 'This page failed to load. ' + e.message));
    }
    scroller.replaceChildren(el);
    if (opts.keepScroll == null) scroller.scrollTop = 0;
    markModified();
    document.title = page.title + ' — SAKURA PANEL';
  }
  SP.go = go;
  SP.refresh = () => { const top = scroller.scrollTop; render(current, { animate: false, keepScroll: true }); scroller.scrollTop = top; };

  /* ---------------- pending changes ---------------- */
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function markModified() {
    scroller.querySelectorAll('.sp-row[data-path]').forEach((r) => {
      const p = r.dataset.path;
      let mod = false;
      try { mod = !same(SP.state.get(p), SP.state.getApplied(p)); } catch (e) { /* path not in state */ }
      r.classList.toggle('is-modified', mod);
    });
    const n = SP.state.changes();
    applyCount.textContent = n === 1 ? '1 unapplied change' : `${n} unapplied changes`;
    applybar.classList.toggle('is-visible', n > 0);
  }
  let rafPending = false;
  SP.state.on((type, d) => {
    if (type === 'discarded') { SP.refresh(); }
    if (type === 'applied' || type === 'discarded') { applyPrefs(); paintViewSeg(); }
    if (type === 'change' && d && d.path && d.path.startsWith('system.')) {
      applyPrefs();
      if (d.path === 'system.view') paintViewSeg();
    }
    if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; markModified(); }); }
  });

  async function doApply() {
    if (!SP.state.changes()) return;
    applybar.classList.add('is-applying');
    await SP.state.apply();
    applybar.classList.remove('is-applying');
    main.classList.remove('is-flash'); void main.offsetWidth; main.classList.add('is-flash');
    SP.ui.toast('Settings applied');
    markModified();
  }
  SP.applyNow = doApply;

  /* ---------------- theme chip ---------------- */
  function paintChip() {
    const t = SP.theme.active;
    themeChipName.textContent = t.name;
    themeChipSw.replaceChildren(...[t.tokens.background, t.tokens.panelRaised, t.tokens.primary, t.tokens.accent]
      .map((c) => h('i', { style: { background: c } })));
  }
  SP.theme.on(paintChip);
  paintChip();

  /* ---------------- search ---------------- */
  const index = pages.flatMap((p) => [{ label: p.title, page: p, primary: true }, ...(p.search || []).map((s) => ({ label: s, page: p }))]);
  let results = [], active = 0;
  function runSearch() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.classList.remove('is-open'); return; }
    results = index.filter((x) => x.label.toLowerCase().includes(q))
      .sort((a, b) => (b.label.toLowerCase().startsWith(q) - a.label.toLowerCase().startsWith(q)) || (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
      .slice(0, 9);
    active = 0;
    searchResults.replaceChildren(...(results.length ? results.map((r, i) => h('button', {
      type: 'button', role: 'option', class: i === 0 ? 'is-active' : '', onmousedown: (e) => { e.preventDefault(); pick(i); },
    }, icon(r.page.icon), h('span', null, r.label), h('small', null, r.primary ? 'Page' : r.page.title))) : [h('div', { class: 'sp-search-empty' }, 'No settings match “' + searchInput.value + '”')]));
    searchResults.classList.add('is-open');
  }
  function pick(i) {
    const r = results[i];
    if (!r) return;
    searchInput.value = ''; searchResults.classList.remove('is-open'); searchInput.blur();
    if (!r.primary && r.page.advancedTerms && r.page.advancedTerms.includes(r.label) && root.dataset.view === 'simple') {
      SP.state.set('system.view', 'advanced');
    }
    go(r.page.id);
    if (!r.primary) requestAnimationFrame(() => highlight(r.label));
  }
  function highlight(label) {
    const row = [...scroller.querySelectorAll('[data-search]')].find((el) => el.dataset.search === label && el.offsetParent !== null)
      || [...scroller.querySelectorAll('[data-search]')].find((el) => el.dataset.search === label);
    if (!row) return;
    const exp = row.closest('.sp-exp');
    if (exp && !exp.classList.contains('is-open')) exp.querySelector('.sp-exp-head').click();
    setTimeout(() => {
      row.scrollIntoView({ block: 'center', behavior: root.dataset.motion === 'off' ? 'auto' : 'smooth' });
      row.classList.remove('is-found'); void row.offsetWidth; row.classList.add('is-found');
    }, exp ? 260 : 0);
  }
  searchInput.addEventListener('input', runSearch);
  searchInput.addEventListener('focus', runSearch);
  searchInput.addEventListener('blur', () => setTimeout(() => searchResults.classList.remove('is-open'), 100));
  searchInput.addEventListener('keydown', (e) => {
    const items = searchResults.querySelectorAll('button');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
      items.forEach((b, i) => b.classList.toggle('is-active', i === active));
    } else if (e.key === 'Enter') { pick(active); } else if (e.key === 'Escape') { searchInput.value = ''; searchInput.blur(); }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doApply(); }
  });

  /* ---------------- boot ---------------- */
  window.addEventListener('hashchange', () => { const id = location.hash.replace('#/', ''); if (id !== current) render(byId[id] ? id : 'dashboard'); });
  const start = location.hash.replace('#/', '') || SP.state.applied.system.startPage;
  go(byId[start] ? start : 'dashboard', { animate: false });

  const splash = document.getElementById('splash');
  if (splash) {
    const t0 = performance.now();
    const minTime = root.dataset.motion === 'off' ? 0 : 750;
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      setTimeout(() => { splash.classList.add('is-done'); setTimeout(() => splash.remove(), 400); }, Math.max(0, minTime - (performance.now() - t0)));
    });
  }
})();
