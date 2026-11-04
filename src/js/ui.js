/* SAKURA PANEL — icons and UI components (all bound to SP.state where relevant). */
(function () {
  const SP = window.SP;

  /* ---------------- DOM helper ---------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  /* ---------------- icons (24px grid, 1.6 stroke) ---------------- */
  const I = {
    dashboard: '<rect x="3.5" y="3.5" width="7" height="8" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.6"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.6"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.6"/>',
    color: '<path d="M12 3.6c3.5 4 6 7.3 6 10.3a6 6 0 0 1-12 0c0-3 2.5-6.3 6-10.3z"/><path d="M8.8 14.2a3.3 3.3 0 0 0 3.2 3.2"/>',
    display: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
    gamepad: '<path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.9 3.9a2.2 2.2 0 0 1-3.7 1l-2-2.3h-4.6l-2 2.3a2.2 2.2 0 0 1-3.7-1l-.9-3.9A4 4 0 0 1 7 8z"/><path d="M8 10.8v3.2M6.4 12.4h3.2"/><path d="M15.4 11.6h.01M17.2 13.4h.01" stroke-width="2.4"/>',
    presets: '<path d="M12 3.5 3.5 8 12 12.5 20.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
    cube: '<path d="M12 3 20 7.5v9L12 21 4 16.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    activity: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.7 0-1 .8-1.6 1.8-1.6h2.2a3.7 3.7 0 0 0 3.7-3.7C20.5 6.8 16.7 3.5 12 3.5z"/><path d="M7.8 11h.01M10 7.3h.01M14.3 7.3h.01" stroke-width="2.4"/>',
    gear: '<circle cx="12" cy="12" r="2.8"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-12"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    edit: '<path d="M14.5 5.5l4 4L9 19H5v-4z"/>',
    save: '<path d="M5 4.5h11l3.5 3.5V19a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5z"/><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.9h.01" stroke-width="2.2"/>',
    warning: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4"/><path d="M12 16.9h.01" stroke-width="2.2"/>',
    bolt: '<path d="M13 3 5 13.5h6L10.5 21 19 10h-6z"/>',
    temp: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
    fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c0-3-1-6.4 1.8-6.4 2.4 0 2.5 3.6-1 6.6M13.6 12c3 0 6.4-1 6.4 1.8 0 2.4-3.6 2.5-6.6-1M12 13.6c0 3 1 6.4-1.8 6.4-2.4 0-2.5-3.6 1-6.6M10.4 12c-3 0-6.4 1-6.4-1.8 0-2.4 3.6-2.5 6.6 1"/>',
    chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
    memory: '<rect x="3.5" y="7" width="17" height="10" rx="1.5"/><path d="M7 10.5v3M10.5 10.5v3M14 10.5v3M17.5 10.5v3"/>',
    sparkle: '<path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8z"/>',
    folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    layers: '<rect x="4" y="4" width="11" height="11" rx="2"/><path d="M9 20h9a2 2 0 0 0 2-2V9"/>',
    minimize: '<path d="M6 12h12"/>',
    maximize: '<rect x="6" y="6" width="12" height="12" rx="1.2"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    star: '<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z"/>',
  };
  function icon(name, cls) {
    const span = document.createElement('span');
    span.className = 'sp-icon' + (cls ? ' ' + cls : '');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${I[name] || ''}</svg>`;
    return span;
  }

  const PETAL_A = 'M50 43 C45 38 35 28 35.4 18 C35.8 11 40.4 6.4 45 5 L50 11.2 Z';
  const PETAL_B = 'M50 43 L50 11.2 L55 5 C59.6 6.4 64.2 11 64.6 18 C65 28 55 38 50 43 Z';
  /** The SAKURA PANEL blossom, drawn inline so its facets follow the active theme. */
  function markSVG(cls) {
    const petals = [0, 72, 144, 216, 288].map((r) =>
      `<g class="petal" style="--r:${r}deg" transform="rotate(${r} 50 50)"><path d="${PETAL_A}" fill="var(--sp-mark-a)"/><path d="${PETAL_B}" fill="var(--sp-mark-b)"/></g>`).join('');
    return `<svg class="${cls || 'sp-mark'}" viewBox="0 0 100 100" aria-hidden="true">${petals}<circle cx="50" cy="50" r="4.2" fill="var(--sp-mark-core)"/></svg>`;
  }
  function mark(size) {
    const span = document.createElement('span');
    span.className = 'sp-mark-wrap';
    span.style.width = span.style.height = size + 'px';
    span.innerHTML = markSVG();
    return span;
  }

  /* ---------------- buttons ---------------- */
  function button(label, opts = {}) {
    const b = h('button', {
      type: 'button',
      class: 'sp-btn' + (opts.variant ? ' sp-btn-' + opts.variant : '') + (opts.size ? ' sp-btn-' + opts.size : '') + (opts.class ? ' ' + opts.class : ''),
      title: opts.title, 'aria-label': opts.ariaLabel || (label ? null : opts.title), disabled: opts.disabled,
      onclick: opts.onClick,
    }, opts.icon && !opts.iconAfter ? icon(opts.icon) : null, label ? h('span', null, label) : null, opts.icon && opts.iconAfter ? icon(opts.icon) : null);
    return b;
  }

  /* ---------------- bound controls ---------------- */
  const fmtDefault = (v, unit) => (unit === '%' ? Math.round(v) + '%' : v + (unit || ''));

  function slider(o) {
    const value = o.path ? SP.state.get(o.path) : o.value;
    const input = h('input', {
      type: 'range', min: o.min, max: o.max, step: o.step || 1, value,
      'aria-label': o.label, class: 'sp-range', disabled: o.disabled,
    });
    const out = h('output', { class: 'sp-range-value' });
    const wrap = h('div', { class: 'sp-slider' + (o.compact ? ' is-compact' : '') }, input, out);
    const fmt = o.format || ((v) => fmtDefault(v, o.unit));
    const paint = () => {
      const v = Number(input.value);
      const center = o.center != null ? o.center : null;
      const pct = ((v - o.min) / (o.max - o.min)) * 100;
      if (center != null) {
        const c = ((center - o.min) / (o.max - o.min)) * 100;
        wrap.style.setProperty('--a', Math.min(c, pct) + '%');
        wrap.style.setProperty('--p', Math.max(c, pct) + '%');
      } else {
        wrap.style.setProperty('--a', '0%');
        wrap.style.setProperty('--p', pct + '%');
      }
      out.textContent = fmt(v);
    };
    input.addEventListener('pointerdown', () => wrap.classList.add('is-dragging'));
    window.addEventListener('pointerup', () => wrap.classList.remove('is-dragging'));
    input.addEventListener('input', () => {
      paint();
      const v = Number(input.value);
      if (o.path) SP.state.set(o.path, v);
      if (o.onInput) o.onInput(v);
    });
    paint();
    wrap.setValue = (v) => { input.value = v; paint(); };
    return wrap;
  }

  function toggle(o) {
    const on = o.path ? !!SP.state.get(o.path) : !!o.value;
    const b = h('button', { type: 'button', role: 'switch', class: 'sp-switch', 'aria-checked': String(on), 'aria-label': o.label },
      h('span', { class: 'sp-switch-thumb' }));
    b.addEventListener('click', () => {
      const next = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(next));
      if (o.path) SP.state.set(o.path, next);
      if (o.onChange) o.onChange(next);
    });
    return b;
  }

  function select(o) {
    const cur = o.path ? SP.state.get(o.path) : o.value;
    const s = h('select', { class: 'sp-select', 'aria-label': o.label },
      o.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(cur) }, l)));
    s.addEventListener('change', () => {
      const raw = s.value;
      const v = typeof cur === 'number' ? Number(raw) : raw;
      if (o.path) SP.state.set(o.path, v);
      if (o.onChange) o.onChange(v);
    });
    return h('div', { class: 'sp-select-wrap' }, s, icon('chevronDown', 'sp-select-chev'));
  }

  function segmented(o) {
    const cur = String(o.path ? SP.state.get(o.path) : o.value);
    const ind = h('span', { class: 'sp-seg-ind', 'aria-hidden': 'true' });
    const seg = h('div', { class: 'sp-seg' + (o.full ? ' is-full' : ''), role: 'radiogroup', 'aria-label': o.label }, ind);
    const place = () => {
      const a = seg.querySelector('[aria-checked="true"]');
      if (!a || !a.offsetWidth) return;
      ind.style.width = a.offsetWidth + 'px';
      ind.style.transform = `translateX(${a.offsetLeft - 3}px)`;
    };
    o.options.forEach(([v, l]) => {
      const btn = h('button', { type: 'button', role: 'radio', 'aria-checked': String(String(v) === cur), class: 'sp-seg-btn' }, l);
      btn.addEventListener('click', () => {
        seg.querySelectorAll('.sp-seg-btn').forEach((x) => x.setAttribute('aria-checked', String(x === btn)));
        place();
        const val = typeof (o.path ? SP.state.get(o.path) : o.value) === 'number' ? Number(v) : v;
        if (o.path) SP.state.set(o.path, val);
        if (o.onChange) o.onChange(val);
      });
      seg.appendChild(btn);
    });
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(seg);
    requestAnimationFrame(place);
    return seg;
  }

  /* ---------------- layout ---------------- */
  function row(o) {
    return h('div', { class: 'sp-row' + (o.adv ? ' adv-only' : '') + (o.stack ? ' is-stack' : ''), 'data-path': o.path || null, 'data-search': o.label },
      h('div', { class: 'sp-row-text' },
        h('div', { class: 'sp-row-label' }, o.label, h('span', { class: 'sp-mod-dot', title: 'Changed — not applied yet' }), o.adv ? h('span', { class: 'sp-tag' }, 'Advanced') : null),
        o.desc ? h('div', { class: 'sp-row-desc' }, o.desc) : null),
      h('div', { class: 'sp-row-control' }, o.control));
  }

  function card(o) {
    return h('section', { class: 'sp-card' + (o.class ? ' ' + o.class : '') + (o.adv ? ' adv-only' : '') },
      (o.title || o.actions) ? h('header', { class: 'sp-card-head' },
        o.icon ? h('div', { class: 'sp-card-icon' }, icon(o.icon)) : null,
        h('div', { class: 'sp-card-titles' }, h('h3', null, o.title), o.desc ? h('p', null, o.desc) : null),
        o.actions ? h('div', { class: 'sp-card-actions' }, o.actions) : null) : null,
      h('div', { class: 'sp-card-body' }, o.body));
  }

  function expander(o) {
    const key = 'expander.' + o.id;
    const open = SP.store.get(key, !!o.open);
    const body = h('div', { class: 'sp-exp-body' }, h('div', { class: 'sp-exp-inner' }, o.body));
    const head = h('button', { type: 'button', class: 'sp-exp-head', 'aria-expanded': String(open) },
      o.icon ? h('span', { class: 'sp-exp-icon' }, icon(o.icon)) : null,
      h('span', { class: 'sp-exp-titles' }, h('span', { class: 'sp-exp-title' }, o.title), o.desc ? h('span', { class: 'sp-exp-desc' }, o.desc) : null),
      o.badge ? h('span', { class: 'sp-tag' }, o.badge) : null,
      icon('chevronDown', 'sp-exp-chev'));
    const el = h('div', { class: 'sp-exp' + (open ? ' is-open' : '') + (o.adv ? ' adv-only' : '') }, head, body);
    head.addEventListener('click', () => {
      const next = !el.classList.contains('is-open');
      el.classList.toggle('is-open', next);
      head.setAttribute('aria-expanded', String(next));
      SP.store.set(key, next);
    });
    return el;
  }

  function pageHeader(o) {
    return h('header', { class: 'sp-page-head' },
      h('div', { class: 'sp-page-titles' },
        h('div', { class: 'sp-eyebrow' }, o.eyebrow),
        h('h1', null, o.title),
        o.desc ? h('p', null, o.desc) : null),
      o.actions ? h('div', { class: 'sp-page-actions' }, o.actions) : null);
  }

  function stat(o) {
    return h('div', { class: 'sp-stat' },
      h('div', { class: 'sp-stat-top' }, icon(o.icon), h('span', null, o.label)),
      h('div', { class: 'sp-stat-value' }, h('span', { class: 'sp-stat-num', 'data-stat': o.id || null }, o.value), o.unit ? h('small', null, o.unit) : null),
      o.meter != null ? h('div', { class: 'sp-meter' }, h('span', { style: { width: o.meter + '%' }, 'data-meter': o.id || null })) : null);
  }

  /* ---------------- feedback ---------------- */
  let toastHost;
  function toast(msg, opts = {}) {
    if (!toastHost) { toastHost = h('div', { class: 'sp-toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastHost); }
    const t = h('div', { class: 'sp-toast is-' + (opts.type || 'success') },
      h('span', { class: 'sp-toast-icon' }, icon(opts.type === 'error' ? 'warning' : opts.type === 'info' ? 'info' : 'check')),
      h('span', null, msg));
    toastHost.appendChild(t);
    setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 260); }, opts.duration || 2600);
  }

  function dialog({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, input = null }) {
    return new Promise((resolve) => {
      const field = input ? h('input', { class: 'sp-input', value: input.value || '', maxlength: 40, 'aria-label': input.label || title }) : null;
      const close = (val) => { overlay.classList.add('is-leaving'); setTimeout(() => overlay.remove(), 180); document.removeEventListener('keydown', onKey); resolve(val); };
      const ok = button(confirmText, { variant: danger ? 'danger' : 'primary', onClick: () => close(field ? field.value.trim() || null : true) });
      const box = h('div', { class: 'sp-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', null, title),
        body ? h('p', null, body) : null,
        field ? h('label', { class: 'sp-field' }, h('span', null, input.label), field) : null,
        h('div', { class: 'sp-dialog-actions' }, button(cancelText, { variant: 'ghost', onClick: () => close(field ? null : false) }), ok));
      const overlay = h('div', { class: 'sp-overlay' }, box);
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(field ? null : false); });
      const onKey = (e) => { if (e.key === 'Escape') close(field ? null : false); if (e.key === 'Enter' && field) ok.click(); };
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      (field || ok).focus();
      if (field) field.select();
    });
  }

  /** Honest banner for settings that have no hardware backend yet. */
  function notConnected(what) {
    return h('div', { class: 'sp-note is-warn sp-notconnected' }, icon('info'),
      h('span', null, h('strong', null, 'Not connected to the GPU driver yet. '), what + ' Changes are saved, but nothing on your system changes. Display colour in ', h('button', { type: 'button', class: 'sp-link', onclick: () => SP.go('color') }, 'Color Control'), ' is live.'));
  }

  SP.ui = { h, icon, mark, markSVG, notConnected, button, slider, toggle, select, segmented, row, card, expander, pageHeader, stat, toast, dialog };
})();
