/* Vaishnava Texts: DOM helpers, text helpers and small UI primitives (menus, sheets, dialogs, toasts). */
'use strict';
window.GB = window.GB || {};
(function (GB) {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function h(tag, props, ...kids) {
    const m = String(tag).match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i) || [0, tag, ''];
    const el = document.createElement(m[1] || 'div');
    (m[2].match(/[.#][\w-]+/g) || []).forEach(t => t[0] === '.' ? el.classList.add(t.slice(1)) : (el.id = t.slice(1)));
    if (props) for (const k in props) {
      const v = props[k]; if (v == null || v === false) continue;
      if (k === 'class') { String(v).split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c)); }
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.slice(0, 2) === '--') el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); }
    return el;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const decodeEnt = s => String(s || '').replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, d) => String.fromCodePoint(parseInt(d, 16)))
    .replace(/&nbsp;/g, '\u00a0').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const stripTags = s => decodeEnt(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>\s*/gi, ' ').replace(/<[^>]+>/g, '')).replace(/[ \t\r\n]+/g, ' ').trim().normalize('NFC');
  // Length-preserving fold (per UTF-16 unit) for diacritic/case-insensitive matching and highlighting.
  const foldMap = new Map();
  function foldChar(ch) {
    let f = foldMap.get(ch); if (f !== undefined) return f;
    const c = ch.charCodeAt(0);
    if (c < 128) f = ch.toLowerCase();
    else if (c >= 0x900 && c <= 0x97f) f = ch;
    else { const d = ch.normalize('NFD'); const b = d.charCodeAt(0); f = (d.length > 1 && b < 128) ? d[0].toLowerCase() : (c >= 0x300 && c <= 0x36f ? '\u0300' : ch.toLowerCase()); if (f.length !== 1) f = ch; }
    foldMap.set(ch, f); return f;
  }
  function fold(s) { let o = ''; for (let i = 0; i < s.length; i++) o += foldChar(s[i]); return o; }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DEV = /[\u0900-\u097F]/;
  const pad2 = n => String(n).padStart(2, '0');
  function fmtDate(ts) {
    const d = new Date(ts); const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getDay()] + ' ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fmtDuration(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return 'few seconds';
    if (m < 60) return m + ' mins';
    const hh = Math.floor(m / 60), mm = m % 60; return hh + ' h ' + (mm ? mm + ' mins' : '');
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function download(name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'application/json' })), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function pickFiles(accept, multiple) {
    return new Promise(res => {
      const i = h('input', { type: 'file', accept: accept || '', multiple: multiple ? true : null, style: { display: 'none' } });
      i.onchange = () => { res(Array.from(i.files || [])); i.remove(); };
      document.body.append(i); i.click();
    });
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' } }); ta.value = t; document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} ta.remove(); return ok;
    }
  }
  const img = (name, cls, alt) => h('img', { src: 'img/ui/' + name, class: cls || '', alt: alt || '', draggable: 'false' });

  // ---------- UI primitives ----------
  const layer = () => $('#overlays');
  function toast(msg, ms) {
    const t = h('div.toast', { text: msg }); layer().append(t);
    requestAnimationFrame(() => t.classList.add('on'));
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, ms || 2200);
  }
  // Popup menu in the app's style. items: {label, icon (img name or svg), onClick, sub:[...], header:true, checked, disabled, divider}
  function menu(anchor, items, opts) {
    opts = opts || {};
    closeMenus();
    const scrim = h('div.menu-scrim', { onclick: () => close() });
    const box = h('div.popmenu' + (opts.cls ? '.' + opts.cls : ''));
    function close() { scrim.remove(); box.remove(); if (opts.onClose) opts.onClose(); }
    function fill(list, back) {
      box.innerHTML = '';
      if (back) box.append(h('div.pm-item.pm-back', { onclick: e => { e.stopPropagation(); fill(back.items, back.back); } }, h('span.pm-ico', { html: GB.icons.svg('back') }), h('span.pm-label', { text: back.title || '' })));
      for (const it of list) {
        if (!it) continue;
        if (it.divider) { box.append(h('div.pm-div')); continue; }
        if (it.header) { box.append(h('div.pm-head', { text: it.label })); continue; }
        const ico = it.icon ? (it.icon.indexOf('.') > 0 ? img(it.icon, 'pm-png') : h('span.pm-ico', { html: GB.icons.svg(it.icon) })) : h('span.pm-ico.empty');
        const row = h('div.pm-item' + (it.disabled ? '.disabled' : ''), {
          onclick: e => {
            e.stopPropagation(); if (it.disabled) return;
            if (it.sub) { fill(it.sub, { items: list, back, title: it.label }); return; }
            close(); if (it.onClick) it.onClick();
          }
        }, ico, h('span.pm-label', { text: it.label }), it.sub ? h('span.pm-arrow', { text: '›' }) : null,
          it.checked != null ? h('span.pm-check' + (it.checked ? '.on' : '')) : null);
        box.append(row);
      }
    }
    fill(items);
    layer().append(scrim, box);
    // position
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: (anchor && anchor.x) || 0, right: (anchor && anchor.x) || 0, top: (anchor && anchor.y) || 0, bottom: (anchor && anchor.y) || 0 };
    const W = window.innerWidth, H = window.innerHeight;
    const bw = Math.min(box.offsetWidth || 260, W - 16), bh = Math.min(box.offsetHeight, H - 16);
    let x = opts.align === 'left' ? r.left : r.right - bw; x = Math.max(8, Math.min(W - bw - 8, x));
    let y = r.bottom + 2; if (y + bh > H - 8) y = Math.max(8, r.top - bh - 2);
    if (opts.at) { x = Math.max(8, Math.min(W - bw - 8, opts.at.x)); y = Math.max(8, Math.min(H - bh - 8, opts.at.y)); }
    box.style.left = x + 'px'; box.style.top = y + 'px';
    return { close };
  }
  function closeMenus() { $$('.menu-scrim, .popmenu').forEach(e => e.remove()); }
  // Bottom sheet (refs, word occurrences, compare selector)
  function sheet(opts) {
    const scrim = h('div.sheet-scrim', { onclick: e => { if (e.target === scrim) close(); } });
    const box = h('div.sheet' + (opts.cls ? '.' + opts.cls : ''), null, h('div.sheet-grip'));
    if (opts.title != null) box.append(h('div.sheet-title', null, typeof opts.title === 'string' ? h('span', { text: opts.title }) : opts.title));
    const body = h('div.sheet-body'); box.append(body);
    if (opts.content) body.append(opts.content);
    scrim.append(box); layer().append(scrim);
    requestAnimationFrame(() => scrim.classList.add('on'));
    let closed = false;
    function close() { if (closed) return; closed = true; scrim.classList.remove('on'); setTimeout(() => scrim.remove(), 220); GB.ui.popEsc(close); if (opts.onClose) opts.onClose(); }
    GB.ui.pushEsc(close);
    // drag down to close
    let y0 = null; const grip = box.firstChild;
    grip.addEventListener('pointerdown', e => { y0 = e.clientY; grip.setPointerCapture(e.pointerId); });
    grip.addEventListener('pointermove', e => { if (y0 != null) box.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)'; });
    grip.addEventListener('pointerup', e => { if (y0 != null && e.clientY - y0 > 80) close(); else box.style.transform = ''; y0 = null; });
    return { el: box, body, close };
  }
  // Android-like alert dialog
  function dialog(opts) {
    const scrim = h('div.dlg-scrim', { onclick: e => { if (e.target === scrim && opts.cancelable !== false) close(null); } });
    const box = h('div.dlg' + (opts.cls ? '.' + opts.cls : ''));
    if (opts.title) box.append(h('div.dlg-title', { text: opts.title }));
    const body = h('div.dlg-body'); if (opts.body) body.append(opts.body); if (opts.text) body.append(h('div.dlg-text', { text: opts.text }));
    box.append(body);
    let resolve; const p = new Promise(r => (resolve = r));
    if (opts.buttons && opts.buttons.length) {
      const bar = h('div.dlg-buttons');
      for (const b of opts.buttons) bar.append(h('button.dlg-btn', { type: 'button', text: b.label, onclick: () => { const v = b.value !== undefined ? b.value : b.label; if (b.onClick && b.onClick() === false) return; close(v); } }));
      box.append(bar);
    }
    scrim.append(box); layer().append(scrim);
    function close(v) { scrim.remove(); GB.ui.popEsc(escClose); resolve(v); if (opts.onClose) opts.onClose(v); }
    const escClose = () => close(null);
    GB.ui.pushEsc(escClose);
    const f = box.querySelector('input,textarea'); if (f) setTimeout(() => f.focus(), 30);
    return { el: box, body, close, result: p };
  }
  function confirmDlg(title, text, ok, cancel) {
    return dialog({ title, text, buttons: [{ label: cancel || 'Cancel', value: false }, { label: ok || 'OK', value: true }] }).result;
  }
  function promptDlg(title, value, hint) {
    const inp = h('input.dlg-input', { type: 'text', value: value || '', placeholder: hint || '' });
    const d = dialog({ title, body: inp, buttons: [{ label: 'Cancel', value: null }, { label: 'OK', onClick: () => {} }] });
    const okBtn = d.el.querySelectorAll('.dlg-btn')[1];
    let result = null;
    okBtn.onclick = () => { result = inp.value; d.close(result); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { result = inp.value; d.close(result); } });
    return d.result.then(v => (v === 'OK' ? inp.value : v));
  }
  GB.errMsg = function (e, what) {
    const m = String((e && e.message) || e || '');
    if (/XMLHttpRequest|Failed to load|Failed to fetch|NetworkError|IOERR/i.test(m))
      return 'Offline: this part of the book is not saved on this device yet. Open it once while online to read it offline.';
    return (what ? what + ': ' : '') + m;
  };
  const escStack = [];
  GB.ui = {
    toast, menu, closeMenus, sheet, dialog, confirm: confirmDlg, prompt: promptDlg,
    pushEsc(fn) { escStack.push(fn); }, popEsc(fn) { const i = escStack.lastIndexOf(fn); if (i >= 0) escStack.splice(i, 1); },
    handleEsc() { if (document.querySelector('.popmenu')) { closeMenus(); return true; } const fn = escStack[escStack.length - 1]; if (fn) { fn(); return true; } return false; }
  };
  Object.assign(GB, { $, $$, h, esc, decodeEnt, stripTags, fold, debounce, sleep, DEV, fmtDate, fmtDuration, fmtSize, uid, download, pickFiles, copyText, img });
})(window.GB);
