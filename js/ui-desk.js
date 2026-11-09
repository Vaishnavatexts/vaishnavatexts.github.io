/* Vaishnava Texts: desktop mode. On a wide window (or Settings > Screen layout: Desktop) <html> gets the class "desk":
   light toolbars instead of phone app bars, the logo in the tab rail, a sidebar you can drag wider or narrower,
   and Settings / Verse order open as a window over the app instead of replacing the sidebar. Looks live in css/desk.css. */
'use strict';
(function (GB) {
  const { h, $ } = GB;
  const H = document.documentElement;
  const SIDE = { min: 280, max: 560, def: 360 };

  function sideW() { const w = +GB.prefs.sideW; return w >= SIDE.min && w <= SIDE.max ? w : SIDE.def; }
  function applySide() { const app = $('#app'); if (app) app.style.setProperty('--sideW', Math.min(sideW(), Math.max(SIDE.min, window.innerWidth - 560)) + 'px'); }

  // sidebar edge: drag to resize, double-click to reset
  function grip() {
    let g = $('#sideGrip'); if (g) return g;
    g = h('div#sideGrip', { title: 'Drag to resize · double-click to reset', role: 'separator', 'aria-orientation': 'vertical' });
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); g.setPointerCapture(e.pointerId); H.classList.add('side-drag');
      const app = $('#app'), x0 = e.clientX, w0 = parseFloat(getComputedStyle(app).getPropertyValue('--sideW')) || sideW();
      let w = w0;
      const move = ev => { w = Math.round(Math.max(SIDE.min, Math.min(SIDE.max, w0 + ev.clientX - x0))); app.style.setProperty('--sideW', w + 'px'); window.dispatchEvent(new Event('gb:layout')); };
      const up = () => { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); H.classList.remove('side-drag');
        GB.setPref('sideW', w); window.dispatchEvent(new Event('resize')); };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    });
    g.addEventListener('dblclick', () => { GB.setPref('sideW', SIDE.def); applySide(); window.dispatchEvent(new Event('resize')); });
    $('#app').append(g); return g;
  }

  // window-style pages go back into the sidebar when the window gets narrow, and the other way round
  function rehome() {
    const L = GB.left; if (!L || !L.stack) return;
    const desk = H.classList.contains('desk'); const m = $('#deskModal');
    for (const p of L.stack) {
      const inModal = m && m.contains(p.el);
      if (!desk && inModal) { $('#left').append(p.el); p.el.classList.remove('dm-page'); }
    }
    if (m) m.classList.toggle('on', desk && L.stack.some(p => m.contains(p.el)));
  }

  // sidebar collapse: rail button, the reader's toolbar button, or Ctrl/⌘ + \ ; tapping a tab opens it again
  const D = GB.desk = {};
  D.collapsed = () => H.classList.contains('desk') && H.classList.contains('side-off');
  function setCollapsed(on, save) {
    H.classList.toggle('side-off', !!on); if (save !== false) GB.setPref('sideCollapsed', !!on);
    document.querySelectorAll('.side-tog').forEach(b => { b.title = on ? 'Show sidebar (Ctrl+\\)' : 'Hide sidebar (Ctrl+\\)'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const l = $('#left'); if (l) l.inert = !!on && H.classList.contains('desk');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 280);
  }
  D.toggle = () => setCollapsed(!H.classList.contains('side-off'));
  D.expand = () => { if (H.classList.contains('side-off')) setCollapsed(false); };
  D.toggleBtn = () => h('button.hdr-btn.side-tog', { type: 'button', title: (H.classList.contains('side-off') ? 'Show' : 'Hide') + ' sidebar (Ctrl+\\)', 'aria-label': 'Toggle sidebar', 'aria-pressed': H.classList.contains('side-off') ? 'true' : 'false', onclick: D.toggle, html: GB.icons.svg('sidebar') });
  function railBtn() {
    const r = $('#rail'); if (!r || r.querySelector('.rail-side')) return;
    if (!r.dataset.sideHook) { r.dataset.sideHook = '1'; new MutationObserver(() => { if (!r.querySelector('.rail-side')) railBtn(); }).observe(r, { childList: true }); }
    r.append(h('button.rail-side.side-tog', { type: 'button', title: 'Hide sidebar (Ctrl+\\)', 'aria-label': 'Toggle sidebar', onclick: D.toggle, html: GB.icons.svg('sidebar') }));
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#rail .tab')) D.expand(); });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === '\\' && H.classList.contains('desk')) { e.preventDefault(); D.toggle(); } });

  let last = null;
  GB.deskSync = function () {
    const d = !!GB.isWide(); applySide();
    if (d !== last) { last = d; H.classList.toggle('desk', d); if (d) { grip(); railBtn(); setCollapsed(!!GB.prefs.sideCollapsed, false); } else { const l = $('#left'); if (l) l.inert = false; } rehome(); window.dispatchEvent(new Event('gb:layout')); }
  };
  window.addEventListener('resize', GB.debounce ? GB.debounce(GB.deskSync, 60) : GB.deskSync);
  const ap = GB.applyPrefs; GB.applyPrefs = function () { ap(); GB.deskSync(); };

  // Settings as a window: a section list on the left, the settings on the right
  const sp = GB.settingsPage;
  GB.settingsPage = function () {
    sp();
    const pg = GB.left.find('settings'); if (!pg || !H.classList.contains('desk') || pg.el.querySelector('.dm-nav')) return;
    const nav = h('nav.dm-nav', { 'aria-label': 'Settings sections' });
    // where a heading sits inside the scrolling list, measured from the screen (offsetTop depends on which ancestor is positioned)
    const at = el => pg.body.scrollTop + el.getBoundingClientRect().top - pg.body.getBoundingClientRect().top;
    const build = () => {
      nav.innerHTML = '';
      const cats = Array.from(pg.body.querySelectorAll('.pref-cat'));
      // the section is looked up when the button is pressed: changing any setting redraws the whole list,
      // and a reference kept from before would point at a removed element (the buttons then did nothing)
      cats.forEach((c, i) => nav.append(h('button.dm-nav-b' + (i === 0 ? '.on' : ''), { type: 'button', text: c.textContent, onclick: () => {
        const cur = pg.body.querySelectorAll('.pref-cat')[i]; if (!cur) return;
        pg.body.scrollTo({ top: Math.max(0, at(cur) - 4), behavior: 'smooth' }); } })));
    };
    const spy = () => {
      const cats = Array.from(pg.body.querySelectorAll('.pref-cat')); let k = 0;
      cats.forEach((c, i) => { if (at(c) - 40 <= pg.body.scrollTop) k = i; });
      if (pg.body.scrollTop + pg.body.clientHeight >= pg.body.scrollHeight - 4) k = cats.length - 1;
      Array.from(nav.children).forEach((b, i) => b.classList.toggle('on', i === k));
    };
    build(); pg.body.addEventListener('scroll', spy, { passive: true });
    new MutationObserver(() => { if (nav.children.length !== pg.body.querySelectorAll('.pref-cat').length) build(); spy(); }).observe(pg.body, { childList: true });
    const wrap = h('div.dm-split'); pg.body.before(wrap); wrap.append(nav, pg.body);
  };

  GB.deskSync();
})(window.GB);
