/* Vaishnava Texts: text screen. One text per page in a 3-slot pager that
   flows across chapters (verse by verse), or continuous reading where verses and chapters run on in one lazy-loaded
   scroll; horizontal paging for small books; chapter drawer; selection actions (Highlight, Comment, Question, Quote);
   verse actions (heart, second language, references, notes, share). */
'use strict';
(function (GB) {
  const { h, $, img } = GB;
  const lib = GB.lib, L = GB.left;
  const R = GB.reader = {};
  let crumbEl, root, el, head, prog, sbar, pager, slots, contEl, loadingEl, drawer, scrim, emptyEl, selbar, hint;
  let cur = null, prevPos = null, nextPos = null, needles = null, sIdx = 0, sCount = 0, hz = false, ignore = 0, busy = false;
  const textCache = new Map();
  const N = () => (GB.prefs.night ? '_d' : '_o');
  R.current = () => cur;
  R.isPaged = () => hz;
  R.build = function () {
    root = $('#reader'); root.innerHTML = '';
    // let horizontal swipes pass through the text (vertical reading) and keep touch gestures for paging (horizontal reading)
    document.head.append(h('style', { text: '.rd-scroll{overscroll-behavior-y:contain;overscroll-behavior-x:auto;touch-action:pan-y pan-x}.rd-pager.hz .rd-scroll{touch-action:none}' }));
    emptyEl = h('div.rd-empty', null, img('splash_icon.png', 'rd-empty-img'), h('div.rd-empty-t', { text: 'Open a text from your library' }));
    head = h('header.hdr.rd-head');
    prog = h('div.rd-prog', null, h('i.p1'), h('i.p2'));
    sbar = h('div.rd-search', { hidden: true }, h('span.rs-q'), h('span.rs-n'),
      h('button.rs-b', { title: 'Previous', onclick: () => searchStep(-1) }, h('img.rs-up')), h('button.rs-b', { title: 'Next', onclick: () => searchStep(1) }, h('img.rs-dn')), h('button.rs-b', { title: 'Close', onclick: clearSearch }, h('img.rs-x')));
    pager = h('div.rd-pager'); slots = [0, 1, 2].map(() => h('div.rd-slot', null, h('div.rd-scroll')));
    pager.append(...slots);
    contEl = h('div.rd-cont', { hidden: true });
    const eL = h('button.rd-edge.l', { title: 'Previous text (←)', onclick: () => go(-1) }, img('ic_go_left.png')), eR = h('button.rd-edge.r', { title: 'Next text (→)', onclick: () => go(1) }, img('ic_go_right.png'));
    loadingEl = h('div.rd-loading', { hidden: true }, GB.loader());
    scrim = h('div.rd-scrim', { hidden: true, onclick: closeDrawer }); drawer = h('div.rd-drawer');
    crumbEl = h('div.rd-crumbs');
    el = h('div.rd', { hidden: true }, head, crumbEl, prog, sbar, h('div.rd-stage', null, pager, contEl, eL, eR, loadingEl), scrim, drawer);
    root.append(emptyEl, el);
    let t = null;
    pager.addEventListener('scroll', () => { if (ignore) return; clearTimeout(t); t = setTimeout(settle, 160); }, { passive: true });
    pager.addEventListener('click', onClick); contEl.addEventListener('click', onClick);
    contEl.addEventListener('scroll', () => { if (cont && !cont.lock) { clearTimeout(cont.t); cont.t = setTimeout(contTrack, 120); } }, { passive: true });
    pager.addEventListener('pointerdown', swipeStart); pager.addEventListener('pointerup', swipeEnd);
    document.addEventListener('selectionchange', GB.debounce(onSel, 200));
    setInterval(() => { if (cur && !el.hidden && document.visibilityState === 'visible' && (GB.isWide() || document.body.classList.contains('reading'))) GB.reading.addTime(cur.B, 15000); }, 15000);
    window.addEventListener('resize', GB.debounce(() => { if (cur && !contOn()) { center(); if (hz) hzLayout(); } }, 120));
    // keep the current verse in place while the sidebar animates open or closed
    const widths = () => { const w = (contOn() ? contEl : pager).clientWidth || el.clientWidth; el.classList.toggle('rd-w520', w >= 520); el.classList.toggle('rd-w640', w >= 640); el.classList.toggle('rd-w860', w >= 860); };
    if (window.ResizeObserver) new ResizeObserver(() => { widths(); if (cur && !contOn() && !busy) center(); }).observe(el);
    icons();
  };
  function icons() {
    const n = N();
    const d = GB.prefs.night ? '_d' : '';
    sbar.querySelector('.rs-up').src = 'img/ui/ic_srch_arrow_up' + d + '.png'; sbar.querySelector('.rs-dn').src = 'img/ui/ic_srch_arrow_down' + d + '.png'; sbar.querySelector('.rs-x').src = 'img/ui/ic_srch_arrow_cross' + d + '.png';
  }
  function show() { emptyEl.hidden = true; el.hidden = false; document.body.classList.add('reading'); GB.screen.enter(); }
  R.close = function () { document.body.classList.remove('reading'); closeDrawer(); clearSel(); GB.screen.leave(); if (!GB.isWide()) { /* keep state for reopening */ } };
  const loading = on => { loadingEl.hidden = !on; };
  // ---------- open ----------
  R.open = async function (B, ch, i, opts) {
    opts = opts || {}; if (!B || !ch) return;
    needles = opts.needles || null; sIdx = 0; if (!needles) sbar.hidden = true;
    if (!opts.background) show(); loading(true); closeDrawer(); hideSelbar();
    try {
      const rows = await lib.chapterTexts(B, ch);
      if (!rows.length) { loading(false); GB.ui.toast('This chapter has no texts'); return; }
      i = Math.max(0, Math.min(i || 0, rows.length - 1));
      cur = { B, ch, i, row: rows[i], rows };
      hz = !isVerseBook(B);   // books of verses scroll; small books page horizontally
      await renderAll(opts);
      { const v = scrollOf(slots[1]).firstChild; if (v && !contOn()) { v.classList.remove('v-in'); void v.offsetWidth; v.classList.add('v-in'); } }
      await GB.reading.touch(B, ch, i, rows[i], rows.length, { mode: hz ? 'horizontal' : contOn() ? 'cont' : 'vertical' });
      GB.history.add(B, ch, rows[i]); setHash(); GB.chapter.markCurrent(); syncHome();
      if (hz) maybeHint();
    } catch (e) { console.error(e); loading(false); GB.ui.toast(GB.errMsg(e, 'Could not open text'), 4000); }
    loading(false);
  };
  const isVerseBook = B => !!(B.hasSongs || B.hasSanskrit || ['BG', 'SB', 'CC'].includes(B.abbr));
  R.openSaved = async function (B, e) {
    if (!B) return; const ch = lib.findChapter(B, e.song, e.ch) || B.chapters[0]; if (!ch) return;
    const rows = await lib.chapterTexts(B, ch); const i = Math.max(0, lib.findTextIndex(rows, e.no));
    R.open(B, ch, i, { noAsk: true, scroll: e.scroll });
  };
  function syncHome() { if (GB.left.stack.length <= 1 && GB.home.tab === 'L' && GB.home.sub === 'reading') GB.home.render(); }
  R.rerender = async function () { icons(); if (!cur) return; if (contOn() && cont) { await contRerender(); setHead(); return; } const s = scrollOf(slots[1]); const top = s.scrollTop; await renderAll({}); scrollOf(slots[1]).scrollTop = top; };
  R.refreshNotes = () => R.rerender();
  const scrollOf = slot => slot.firstChild;
  async function getText(D, id) {
    const k = D.id + '|' + id; if (textCache.has(k)) return textCache.get(k);
    const t = await lib.text(D, id); textCache.set(k, t); if (textCache.size > 40) textCache.delete(textCache.keys().next().value); return t;
  }
  function sameWork(B) { return lib.books.filter(x => x !== B && ((B.compare && x.compare === B.compare) || (B.abbr && x.abbr === B.abbr))); }
  R.sameWork = sameWork;
  // ---------- second language: the same verse in another language edition of this work ----------
  function secondBook(B) {
    const c = sameWork(B).filter(x => x.lang !== B.lang); if (!c.length) return null;
    return c.find(x => x.key === GB.prefs.secondBook) || c.find(x => x.lang === 'eng') || c[0];
  }
  R.secondBook = secondBook;
  R.secondChoices = B => sameWork(B).filter(x => x.lang !== B.lang);
  async function secondText(B2, pos) {
    const ch2 = lib.findChapter(B2, pos.ch.song, pos.ch.ch); if (!ch2) return null;
    const rows2 = await lib.chapterTexts(B2, ch2); const i2 = lib.findTextIndex(rows2, pos.row.no); if (i2 < 0) return null;
    const t = await getText(ch2.part.D, rows2[i2].id); return t ? { t, B: B2 } : null;
  }
  const posOf = new WeakMap();
  // one verse element for a position; used by the pager slots and by continuous reading
  async function buildVerse(B, pos, o) {
    o = o || {};
    const t = await getText(pos.ch.part.D, pos.row.id);
    if (!t) { const v = h('div.verse', null, h('p', { text: 'Text not found.' })); posOf.set(v, pos); return v; }
    const notes = GB.notes.forText(B, pos.ch, pos.row); const B2 = secondBook(B);
    // second language: wait briefly; if that edition is still loading (first use pulls its index), show this verse now and add the second one when it lands
    const sp = B2 && GB.prefs.second ? secondText(B2, pos).catch(() => null) : null;
    const LATE = {}; let second = sp ? await Promise.race([sp, new Promise(r => setTimeout(() => r(LATE), 250))]) : null;
    const late = second === LATE; if (late) second = null;
    const make = sec => GB.render.verse(t, { B, ch: pos.ch, row: pos.row, label: GB.numbered(B) ? lib.label(B, pos.ch.song, pos.ch.ch, pos.row.no) : '', wbwHidden: R.wbwHidden, notes, needles: o.needles || null,
      fav: notes.some(n => n.type === 'fav'), noteCount: notes.filter(n => n.type === 'note' || n.type === 'quest').length, canSecond: !!B2, second: sec, mode: o.mode });
    const v = make(second);
    if (late) {
      const wait = h('div.alt-wait', null, h('i'), h('span', { text: 'Loading ' + ((lib.LANG_NAMES && lib.LANG_NAMES[B2.lang]) || 'second language') + '…' }));
      const hd = v.querySelector('.vhead'); if (hd) hd.after(wait);
      sp.then(sec => {
        wait.remove(); if (!sec || !GB.prefs.second) return;
        const nv = make(sec); const sc = v.closest('.rd-scroll, .rd-cont'); const top = sc ? sc.scrollTop : 0;
        v.replaceChildren(...nv.childNodes); v.className = nv.className; addRefs(v);
        if (sc) sc.scrollTop = top;
      });
    }
    posOf.set(v, pos);
    function addRefs(v) { lib.refs(B, pos.ch, pos.row).then(list => { if (!list.length) return; const tb = v.querySelector('#toolbar'); if (!tb || tb.querySelector('[data-act="refs"]')) return;
      const rb = GB.render.tool('refs', 'refs', 'References', false, { 'data-n': String(list.length) }); rb.classList.add('t-in'); tb.prepend(rb); }).catch(() => {}); }
    addRefs(v);
    return v;
  }
  async function fillSlot(slot, pos, isCur, opts) {
    const sc = scrollOf(slot); sc.scrollTop = 0; sc.scrollLeft = 0;
    if (!pos) { sc.innerHTML = ''; slot.dataset.empty = '1'; return; }
    slot.dataset.empty = '';
    const B = cur.B;
    const v = await buildVerse(B, pos, { needles: isCur ? needles : null, mode: 'verse' });
    sc.innerHTML = ''; sc.append(v);
    if (isCur) {
      if (needles) { sCount = v.querySelectorAll('.srch_res').length; showSearchBar(); }
      if (opts && opts.noteId) { const sp = v.querySelector('[data-note="' + opts.noteId + '"]'); if (sp) setTimeout(() => sp.scrollIntoView({ block: 'center' }), 60); }
      else if (opts && opts.scroll) setTimeout(() => { sc.scrollTop = opts.scroll * (sc.scrollHeight - sc.clientHeight); }, 30);
      sc.onscroll = GB.debounce(() => { if (cur && cur.row === pos.row && !hz) { GB.reading.set(B, { scroll: sc.scrollHeight > sc.clientHeight ? sc.scrollTop / (sc.scrollHeight - sc.clientHeight) : 0 }); pageNum(); } }, 400);
    }
  }
  async function renderAll(opts) {
    setHead(); pager.classList.toggle('hz', hz); el.classList.toggle('hzmode', hz);
    el.classList.toggle('contmode', contOn()); pager.hidden = contOn(); contEl.hidden = !contOn();
    if (contOn()) { await contOpen(opts || {}); progress(); return; }
    cont = null; contEl.innerHTML = '';
    const [p, n] = await Promise.all([lib.neighbour(cur.B, cur.ch, cur.i, -1), lib.neighbour(cur.B, cur.ch, cur.i, 1)]);
    prevPos = p; nextPos = n;
    await fillSlot(slots[1], { ch: cur.ch, i: cur.i, row: cur.row }, true, opts);
    center(); progress();
    fillSlot(slots[0], prevPos); fillSlot(slots[2], nextPos);
    if (hz) hzLayout();
  }
  function center() { ignore++; pager.scrollLeft = slots[1].offsetLeft; requestAnimationFrame(() => requestAnimationFrame(() => { ignore--; })); }
  function settle() {
    const w = pager.clientWidth || 1; const idx = Math.round(pager.scrollLeft / w);
    if (idx <= 0) { if (prevPos) shift(-1); else center(); }
    else if (idx >= 2) { if (nextPos) shift(1); else center(); }
  }
  async function shift(dir) {
    if (busy) return; busy = true; hideSelbar();
    try {
      const old = { ch: cur.ch, i: cur.i, row: cur.row }; const target = dir > 0 ? nextPos : prevPos;
      if (dir > 0) { const s = slots.shift(); slots.push(s); pager.append(s); } else { const s = slots.pop(); slots.unshift(s); pager.prepend(s); }
      center();
      const rows = await lib.chapterTexts(cur.B, target.ch);
      cur = { B: cur.B, ch: target.ch, i: target.i, row: target.row, rows };
      // re-render the new current slot so search highlight / refs badge / scroll handler belong to it
      await fillSlot(slots[1], target, true, { scroll: hz ? 0 : (dir < 0 ? 0 : 0) });
      if (hz) { hzLayout(); if (dir < 0) hzGoLast(); }
      setHead(); progress();
      const nb = await lib.neighbour(cur.B, cur.ch, cur.i, dir);
      if (dir > 0) { prevPos = old; nextPos = nb; fillSlot(slots[2], nb); fillSlot(slots[0], old); }
      else { nextPos = old; prevPos = nb; fillSlot(slots[0], nb); fillSlot(slots[2], old); }
      GB.reading.touch(cur.B, cur.ch, cur.i, cur.row, rows.length); GB.history.add(cur.B, cur.ch, cur.row); setHash(); GB.chapter.markCurrent();
      const cp = L.top(); if (cp && cp.kind === 'chapter' && cp.ch !== cur.ch && GB.isWide()) GB.chapter.open(cur.B, cur.ch, cur.i);
    } finally { busy = false; }
  }
  function go(dir) {
    if (!cur || busy) return; if (contOn()) return contGo(dir);
    const target = dir > 0 ? nextPos : prevPos; if (!target) return;
    if (hz) { shift(dir); return; }
    pager.scrollTo({ left: slots[1 + dir].offsetLeft, behavior: 'smooth' });
  }
  R.go = go;
  // ---------- continuous reading: verses flow, each chapter runs into the next; loaded a few verses at a time ----------
  let cont = null;
  const contOn = () => !hz && GB.parts.mode() === 'cont';
  R.contOn = contOn;
  const BATCH = 5, KEEP = 45;
  async function contItem(B, pos, o) {
    const rows = await lib.chapterTexts(B, pos.ch); pos.rows = rows;
    const v = await buildVerse(B, pos, Object.assign({ mode: 'cont' }, o));
    const wrap = h('div.cv');
    if (pos.i === 0) wrap.append(h('div.cont-ch', null, h('div.cont-chn', { text: (B.hasSongs || pos.ch.song ? lib.chapterLabel(B, pos.ch) : String(pos.ch.ch)) }), h('div.cont-cht', { text: GB.ut(pos.ch.title || '') })));
    wrap.append(v); wrap._pos = pos; return wrap;
  }
  async function contOpen(opts) {
    const B = cur.B; const gen = {};
    cont = { B, gen, items: [], upDone: false, downDone: false, busyUp: false, busyDown: false, lock: 0, t: 0 };
    contEl.innerHTML = '';
    const top = h('div.cont-sent.up'), list = h('div.cont-list'), bot = h('div.cont-sent.down', null, GB.loader('small'));
    contEl.append(top, list, bot); cont.list = list; cont.bot = bot;
    const start = { ch: cur.ch, i: cur.i, row: cur.row };
    const first = await contItem(B, start, { needles });
    if (cont.gen !== gen) return;
    list.append(first); cont.items.push(first);
    if (needles) { sCount = first.querySelectorAll('.srch_res').length; showSearchBar(); }
    await contDown(BATCH);
    contEl.scrollTop = 0;
    if (opts.noteId) { const sp = first.querySelector('[data-note="' + opts.noteId + '"]'); if (sp) setTimeout(() => sp.scrollIntoView({ block: 'center' }), 60); }
    if (cont.io) cont.io.disconnect();
    cont.io = new IntersectionObserver(ents => { for (const en of ents) { if (!en.isIntersecting || !cont) continue; if (en.target === top) contUp(3); else contDown(BATCH); } }, { root: contEl, rootMargin: '900px 0px' });
    setTimeout(() => { if (cont && cont.gen === gen) { cont.io.observe(top); cont.io.observe(bot); } }, 400);
  }
  async function contDown(n) {
    if (!cont || cont.busyDown || cont.downDone) return; cont.busyDown = true; const c = cont;
    try {
      for (let k = 0; k < n; k++) {
        const last = c.items[c.items.length - 1]._pos; const nb = await lib.neighbour(c.B, last.ch, last.i, 1);
        if (c !== cont) return;
        if (!nb) { c.downDone = true; c.bot.innerHTML = ''; c.bot.append(h('div.cont-end', { text: 'End of the book' })); break; }
        const it = await contItem(c.B, nb); if (c !== cont) return; c.list.append(it); c.items.push(it);
      }
      if (c.items.length > KEEP) {                       // drop verses far above, keep the view where it is
        const drop = c.items.splice(0, c.items.length - KEEP); let hgt = 0; drop.forEach(d => { hgt += d.offsetHeight; }); c.lock++;
        drop.forEach(d => d.remove()); contEl.scrollTop -= hgt; c.upDone = false; requestAnimationFrame(() => { c.lock--; });
      }
    } finally { c.busyDown = false; }
  }
  async function contUp(n) {
    if (!cont || cont.busyUp || cont.upDone) return; cont.busyUp = true; const c = cont;
    try {
      for (let k = 0; k < n; k++) {
        const firstPos = c.items[0]._pos; const nb = await lib.neighbour(c.B, firstPos.ch, firstPos.i, -1);
        if (c !== cont) return;
        if (!nb) { c.upDone = true; break; }
        const it = await contItem(c.B, nb); if (c !== cont) return;
        const before = contEl.scrollHeight; c.lock++; c.list.prepend(it); c.items.unshift(it);
        contEl.scrollTop += contEl.scrollHeight - before; requestAnimationFrame(() => { c.lock--; });
      }
      if (c.items.length > KEEP) { const drop = c.items.splice(KEEP); drop.forEach(d => d.remove()); c.downDone = false; c.bot.innerHTML = ''; c.bot.append(GB.loader('small')); }
    } finally { c.busyUp = false; }
  }
  // the verse at the top of the view is the current one: title, progress, bookmark and history follow it
  async function contTrack() {
    if (!cont || !contOn()) return; const top = contEl.getBoundingClientRect().top + 56;
    const it = cont.items.find(x => x.getBoundingClientRect().bottom > top) || cont.items[0]; if (!it) return;
    const p = it._pos; if (cur && p.row === cur.row) return;
    cur = { B: cont.B, ch: p.ch, i: p.i, row: p.row, rows: p.rows };
    setHead(); progress(); setHash(); GB.chapter.markCurrent();
    contSave();
  }
  const contSave = GB.debounce(() => { if (!cur) return; GB.reading.touch(cur.B, cur.ch, cur.i, cur.row, cur.rows.length, { mode: 'cont' }); GB.history.add(cur.B, cur.ch, cur.row); syncHome(); }, 1200);
  function contGo(dir) {
    if (!cont) return; const k = cont.items.findIndex(x => x._pos.row === cur.row); const t = cont.items[k + dir];
    if (t) contEl.scrollTo({ top: t.offsetTop - 4, behavior: 'smooth' }); else if (dir > 0) contDown(BATCH); else contUp(3);
  }
  async function contRerender() {
    const c = cont; const anchor = c.items.find(x => x._pos.row === cur.row) || c.items[0]; const off = anchor ? anchor.getBoundingClientRect().top - contEl.getBoundingClientRect().top : 0;
    const fresh = await Promise.all(c.items.map(x => contItem(c.B, x._pos)));
    if (c !== cont) return;
    c.lock++; c.items.forEach((x, k) => x.replaceWith(fresh[k])); c.items = fresh;
    const a2 = fresh.find(x => x._pos.row === cur.row) || fresh[0]; if (a2) contEl.scrollTop = a2.offsetTop - off;
    requestAnimationFrame(() => { c.lock--; });
  }
  R.setMode = async function (m) {
    GB.setPref('readMode', m === 'cont' ? 'cont' : 'verse');
    if (cur) { const { B, ch, i } = cur; const background = !GB.isWide() && !document.body.classList.contains('reading'); await R.open(B, ch, i, { noAsk: true, background }); }
  };
  // ---------- title bar, progress ----------
  function refText() { const { B, ch, row } = cur; if (Number(ch.ch) === 0) { const pv = GB.ut(row.preview || '').slice(0, 60); return pv && pv !== ch.title ? (ch.title || '') + ' · ' + pv : (ch.title || pv); } return lib.label(B, ch.song, ch.ch, row.no).split(' ').pop() + ' ' + (ch.title || ''); }
  function setHead() {
    head.innerHTML = ''; const { B } = cur;
    head.append(h('button.hdr-logo', { title: 'Contents', onclick: openDrawer }, img('headermenuicon.png')),
      h('div.t2.rd-titles', { title: 'Show/Hide Sanskrit', onclick: () => { GB.parts.toggleSanskrit(); R.rerender(); } },
        h('div.t2a', null, h('span.tri', { text: '▾' }), GB.ut(B.title)), h('div.t2b', { text: GB.ut(GB.numbered(B) ? refText() : (cur.ch.title || refText())) })));
    if (GB.desk) head.prepend(GB.desk.toggleBtn());

    const right = h('div.hdr-right');
    if (!GB.isWide()) right.append(GB.hbtn('back', 'Back', () => GB.back(), 'rd-back'));
    if (GB.canGoto(B)) right.append(GB.hbtn('goto', 'Go to verse', () => GB.gotoVerse(cur), 'rd-goto'));
    right.append(h('button.hdr-btn.hdr-aa', { title: 'Reading options', 'aria-label': 'Reading options', onclick: () => GB.readPanel() }, h('span.aa', { text: 'Aa' })));
    right.append(h('div.more-wrap', null, GB.hbtn('more', 'Menu', e => textMenu(e.currentTarget)), h('span.pagenum')));
    head.append(right); pageNum();
  }
  function progress() {
    const { B, ch, i, rows } = cur; const p = GB.reading.progressOf(B, ch, i, rows.length);
    prog.querySelector('.p1').style.width = (p * 100).toFixed(1) + '%';
    const p2 = prog.querySelector('.p2'); p2.hidden = !GB.prefs.doubleProgress; p2.style.width = ((i + 1) / rows.length * 100).toFixed(1) + '%';
    prog.classList.toggle('double', !!GB.prefs.doubleProgress);
  }
  function pageNum() {
    const pn = head.querySelector('.pagenum'); if (!pn || !GB.prefs.showPageNumbers || !cur) { if (pn) pn.textContent = ''; return; }
    const sc = scrollOf(slots[1]);
    if (hz) { const w = sc.clientWidth || 1; pn.textContent = (Math.round(sc.scrollLeft / w) + 1) + '/' + Math.max(1, Math.round(sc.scrollWidth / w)); }
    else { const hgt = sc.clientHeight || 1; pn.textContent = (Math.floor(sc.scrollTop / hgt) + 1) + '/' + Math.max(1, Math.ceil(sc.scrollHeight / hgt)); }
  }
  async function bookmark() { await GB.reading.touch(cur.B, cur.ch, cur.i, cur.row, cur.rows.length); GB.ui.toast('Bookmark set at ' + lib.label(cur.B, cur.ch.song, cur.ch.ch, cur.row.no)); }
  function textMenu(anchor) {
    const P = GB.prefs;
    GB.ui.menu(anchor, [
      { label: 'Reading options', icon: 'font', onClick: () => GB.readPanel() },
      { label: 'Set bookmark', icon: 'ic_bookmark.png', onClick: bookmark },
      { label: 'Search in this book', icon: 'cab_search.png', onClick: () => GB.search.dialog({ book: cur.B }) },
      { label: 'History', icon: 'ic_screen_manager.png', onClick: () => GB.historyPage() },
      { label: P.night ? 'Day theme' : 'Night theme', icon: P.night ? 'ic_sun.png' : 'ic_menu_night.png', onClick: GB.toggleNight },
      { label: 'Notes', icon: 'ic_menu_comment.png', sub: [{ label: 'Favourite', icon: 'heart', onClick: toggleFav }, { label: 'Add note or question', icon: 'ic_menu_comment.png', onClick: () => GB.noteEdit({ type: 'note', ref: GB.notes.ref(cur.B, cur.ch, cur.row) }) }, { label: 'All notes in this book', icon: 'ic_menu_list.png', onClick: () => GB.bookNotes(cur.B) }] },
      sameWork(cur.B).length ? { label: 'Compare editions', icon: 'ic_menu_compare.png', onClick: () => GB.compare.selector(cur, 'compare') } : null,
      { label: 'Text', icon: 'ic_copy.png', sub: [{ label: 'Share as picture', icon: 'share', onClick: () => GB.shareCard(cur, curVerse()) }, { label: speaking() ? 'Stop reading aloud' : 'Read aloud', icon: 'ic_read_aloud.png', onClick: readAloud }, { label: 'Copy text', icon: 'ic_copy.png', onClick: copyText }, { label: 'Copy link', icon: 'ic_url.png', onClick: async () => { await GB.copyText(deepLink()); GB.ui.toast('Link copied'); } }, { label: 'Open in new window', icon: 'ic_chapter_link.png', onClick: () => window.open(deepLink(), '_blank') }] },
      { label: 'Library', icon: 'ic_menu_books.png', onClick: () => { L.home('L'); R.close(); } },
      { label: 'Settings', icon: 'ic_mmenu_settings.png', onClick: () => GB.settingsPage() }].filter(Boolean));
  }
  async function toggleHz() {
    hz = !hz; await GB.reading.set(cur.B, { mode: hz ? 'horizontal' : 'vertical' }); GB.reading.map.get(cur.B.key) || (await GB.reading.touch(cur.B, cur.ch, cur.i, cur.row, cur.rows.length, { mode: hz ? 'horizontal' : 'vertical' }));
    await R.rerender(); if (hz) maybeHint();
  }
  const speaking = () => window.speechSynthesis && speechSynthesis.speaking;
  function readAloud() {
    if (!window.speechSynthesis) { GB.ui.toast('Reading aloud is not available in this browser'); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
    const v = curVerse(); if (!v) return; const txt = ['#verseTransl2', '#versePurport'].map(s => { const e = v.querySelector(s); return e ? e.innerText : ''; }).join('\n\n');
    const u = new SpeechSynthesisUtterance(txt); u.lang = cur.B.lang === 'hin' ? 'hi-IN' : cur.B.lang === 'rus' ? 'ru-RU' : 'en-US'; speechSynthesis.speak(u);
  }
  async function copyText() {
    const v = curVerse(); if (!v) return; const part = s => { const e = v.querySelector(s); return e && !e.hidden ? e.innerText.trim() : ''; };
    const t = [lib.label(cur.B, cur.ch.song, cur.ch.ch, cur.row.no), part('#verseSanskrit'), part('#verseTranslit'), part('#verseTransl2'), part('#versePurport')].filter(Boolean).join('\n\n');
    await GB.copyText(t); GB.ui.toast('Text copied');
  }
  function deepLink() {
    const { B, ch, row } = cur; const tail = encodeURIComponent(B.lang) + '/' + encodeURIComponent(B.abbr || B.title) + '/' + (B.hasSongs ? ch.song + '/' : '') + ch.ch + '/' + encodeURIComponent(row.no);
    return GB.paths ? new URL(tail, document.baseURI).href : location.href.split('#')[0] + '#/' + tail;
  }
  function setHash() { try { history.replaceState(history.state, '', deepLink()); } catch (e) {} }
  R.deepLink = () => cur ? deepLink() : '';
  // ---------- drawer (chapters) ----------
  function openDrawer() {
    const { B } = cur; drawer.innerHTML = '';
    drawer.append(h('div.dr-head', null, img(GB.prefs.night ? 'book_cover_d.png' : 'book_cover_o.png', 'dr-cover'), h('div.dr-meta', null, h('div.dr-author', { text: GB.ut(B.author) }), h('div.dr-title', { text: GB.ut(B.title) }))),
      h('div.dr-row.dr-lib', { onclick: () => { closeDrawer(); L.home('L'); R.close(); } }, h('span.dr-num', { html: GB.icons.svg('lib') }), h('span.dr-t', { text: 'Library' })));
    let lastSong = null;
    for (const ch of B.chapters) {
      if (B.hasSongs && ch.song !== lastSong) { lastSong = ch.song; const s = B.songs.find(x => x.song === ch.song); drawer.append(h('div.dr-song', { text: GB.songInfo(B, s || ch.song).title })); }
      const on = ch === cur.ch;
      drawer.append(h('div.dr-row' + (on ? '.on' : ''), { onclick: () => { closeDrawer(); R.open(B, ch, 0, { noAsk: true }); if (GB.isWide()) GB.chapter.open(B, ch, 0); } }, h('span.dr-num', { text: String(ch.ch) }), h('span.dr-t', { text: GB.ut(ch.title) })));
    }
    drawer.classList.add('on'); scrim.hidden = false; GB.ui.pushEsc(closeDrawer);
    const on = drawer.querySelector('.dr-row.on'); if (on) on.scrollIntoView({ block: 'center' });
  }
  function closeDrawer() { if (!drawer || !drawer.classList.contains('on')) return; drawer.classList.remove('on'); scrim.hidden = true; GB.ui.popEsc(closeDrawer); }
  // ---------- page buttons / horizontal paging ----------
  function pageStep(dir) {
    if (!cur) return; if (contOn()) { contEl.scrollBy({ top: dir * contEl.clientHeight * 0.9, behavior: 'smooth' }); return; }
    const sc = scrollOf(slots[1]);
    if (hz) { const w = sc.clientWidth; const max = sc.scrollWidth - w; const x = Math.round(sc.scrollLeft / w) * w;
      if (dir > 0 && x >= max - 4) { go(1); return; } if (dir < 0 && x <= 4) { go(-1); return; }
      sc.scrollTo({ left: x + dir * w, behavior: 'smooth' }); setTimeout(pageNum, 350); return; }
    const atEnd = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 3, atTop = sc.scrollTop <= 2;
    if ((dir > 0 && atEnd) || (dir < 0 && atTop)) { if (GB.prefs.pageButtonsCrossChapters) go(dir); return; }
    sc.scrollBy({ top: dir * sc.clientHeight * 0.9, behavior: 'smooth' });
  }
  R.pageStep = pageStep;
  function hzLayout() { const sc = scrollOf(slots[1]); const v = sc.querySelector('.verse'); if (!v) return; v.style.setProperty('--pw', sc.clientWidth + 'px'); pageNum(); }
  function hzGoLast() { const sc = scrollOf(slots[1]); requestAnimationFrame(() => { sc.scrollLeft = sc.scrollWidth; pageNum(); }); }
  async function maybeHint() {
    if (await GB.store.kvGet('hzHint', false)) return;
    if (hint) hint.remove();
    hint = h('div.hz-hint', { onclick: () => { hint.remove(); hint = null; GB.store.kvSet('hzHint', true); } },
      h('div.hz-z', { text: 'Tap: previous page' }), h('div.hz-z.c', { text: 'Tap: show or hide the title bar' }), h('div.hz-z', { text: 'Tap: next page' }), h('img.hz-x', { src: 'img/ui/ic_horizontal_hint_close.svg' }));
    el.querySelector('.rd-stage').append(hint);
  }
  let sx = null, sy = null;
  // paged reading: swipe turns the page. Vertical reading: touch swipes are native (scroll snap); with a mouse, drag on the empty side margins
  let sTarget = null;
  let sLeft = 0;
  function swipeStart(e) { sTarget = e.target; sx = e.clientX; sy = e.clientY; sLeft = pager.scrollLeft; }
  function swipeEnd(e) {
    if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    const flick = Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5;
    if (hz) { if (flick && getSelection().isCollapsed) { swipedAt = Date.now(); pageStep(dx < 0 ? 1 : -1); } return; }
    if (!flick || Math.abs(pager.scrollLeft - sLeft) > 8) return;            // the browser already scrolled the pager: nothing to add
    const margin = sTarget && sTarget.classList && (sTarget.classList.contains('rd-scroll') || sTarget.classList.contains('rd-slot'));
    if (e.pointerType !== 'mouse' || (margin && Math.abs(dx) > 100)) go(dx < 0 ? 1 : -1);
  }
  let swipedAt = 0;
  function hzTap(e) {
    if (Date.now() - swipedAt < 400 || !getSelection().isCollapsed) return;
    const r = pager.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width;
    if (x < 0.3) pageStep(-1); else if (x > 0.7) pageStep(1); else el.classList.toggle('nohead');
  }
  // ---------- clicks inside the verse ----------
  function onClick(e) {
    const vv = e.target.closest('.verse'); if (vv) focusVerse(vv);
    const act = e.target.closest('[data-act]'); if (act) { if (act.dataset.act === 'word' && !getSelection().isCollapsed) return; e.preventDefault(); doAct(act.dataset.act, act); return; }
    const hl = e.target.closest('[data-note]'); if (hl && getSelection().isCollapsed) { noteMenu(hl.dataset.note, e); return; }
    const a = e.target.closest('a[href]'); if (a) { e.preventDefault(); linkClick(a); return; }
    if (hz) hzTap(e);
  }
  async function toggleFav() {
    const ex = GB.notes.forText(cur.B, cur.ch, cur.row).find(n => n.type === 'fav');
    if (ex) { await GB.notes.remove(ex.id); GB.ui.toast('Removed from favourites'); }
    else { const v = curVerse() && curVerse().querySelector('#verseTransl2'); await GB.notes.save({ type: 'fav', ref: GB.notes.ref(cur.B, cur.ch, cur.row), quote: v ? v.textContent.trim() : (cur.row.preview || ''), tags: [] }); GB.ui.toast('Added to favourites'); }
    R.rerender(); GB.refreshAll();
  }
  function doAct(act, node) {
    if (act === 'fav') return toggleFav();
    if (act === 'compare') return GB.compare.selector(cur, 'compare');
    if (act === 'second') { GB.setPref('second', !GB.prefs.second); return R.rerender(); }
    if (act === 'refs') return GB.refsSheet(cur);
    if (act === 'notes') return notesSheet();
    if (act === 'share') return GB.shareCard(cur, node.closest('.verse'));
    if (act === 'word') { const a = node.querySelector('a[href]'); if (a) return linkClick(a); const w = node.textContent.trim(); if (w) GB.word.open(cur.ch.part.D, '', w); return; }
    if (act === 'wbw') {
      R.wbwHidden = !R.wbwHidden; GB.store.kvSet('wbwHidden', R.wbwHidden);
      (contOn() ? contEl : el).querySelectorAll('.verse').forEach(v => { const b = v.querySelector('.wbw-box'), f = v.querySelector('.wbw-fold'); if (b) b.hidden = R.wbwHidden; if (f) { f.classList.toggle('open', !R.wbwHidden); f.setAttribute('aria-expanded', R.wbwHidden ? 'false' : 'true'); f.title = R.wbwHidden ? 'Show word for word' : 'Hide word for word'; } });
    }
  }
  // the verse the user is acting on becomes the current one (continuous reading shows many)
  function focusVerse(v) {
    const p = posOf.get(v); if (!p || !cur || p.row === cur.row) return;
    cur = { B: cur.B, ch: p.ch, i: p.i, row: p.row, rows: p.rows || (p.ch === cur.ch ? cur.rows : [p.row]) };
  }
  R.focusVerse = focusVerse;
  function curVerse() {
    if (!cur) return null;
    if (contOn()) { for (const v of contEl.querySelectorAll('.verse')) { const p = posOf.get(v); if (p && p.row === cur.row) return v; } return contEl.querySelector('.verse'); }
    return scrollOf(slots[1]).querySelector('.verse');
  }
  R.curVerse = curVerse;
  function notesSheet() {
    const list = GB.notes.forText(cur.B, cur.ch, cur.row); const box = h('div');
    if (!list.length) box.append(h('div.help-row', { text: 'No notes on this text yet. Select words in the text to highlight, comment or ask a question.' }));
    list.forEach(n => box.append(GB.noteCard(n)));
    box.append(h('div.sheet-actions', null, h('button.btn', { onclick: () => { s.close(); GB.noteEdit({ type: 'note', ref: GB.notes.ref(cur.B, cur.ch, cur.row) }); } }, GB.ico('comment'), h('span', { text: 'Add note or question' }))));
    const s = GB.ui.sheet({ title: 'Notes · ' + lib.label(cur.B, cur.ch.song, cur.ch.ch, cur.row.no), content: box });
  }
  function noteMenu(id, e) {
    const n = GB.notes.list.find(x => x.id === id); if (!n) return;
    GB.ui.menu(null, [{ header: true, label: GB.notes.TYPES[n.type] + (n.text ? ': ' + n.text.slice(0, 40) : '') },
      { label: n.type === 'highl' || n.type === 'quote' ? 'Add comment / topics' : 'Edit', icon: 'edit', onClick: () => GB.noteEdit(n) },
      { label: 'Remove', icon: 'trash', onClick: async () => { await GB.notes.remove(n.id); R.rerender(); GB.refreshAll(); } }], { at: { x: e.clientX, y: e.clientY + 8 } });
  }
  async function linkClick(a) {
    const href = a.getAttribute('href') || '', label = a.textContent.trim();
    const L = lib.parseLink(href, label, { song: cur.ch.song, ch: cur.ch.ch });
    if (L.kind === 'word') return GB.word.open(cur.ch.part.D, href, label);
    if (L.kind === 'text') {
      const r = L.abbr ? await lib.resolve(L.abbr, L.nums, cur.B.lang, L.lang) : await lib.resolveIn(cur.B, L.nums);
      if (r) return R.open(r.B, r.ch, r.i, { noAsk: true });
      GB.ui.toast(lib.linkName(L, cur.B) + ' is not in your library'); return;
    }
    if (L.kind === 'dead') { GB.ui.toast('This link has no target in the file'); return; }
    linkFallback(href);
  }
  function linkFallback(href) {
    const items = [{ header: true, label: href.length > 60 ? href.slice(0, 57) + '…' : href }, { label: 'Copy link', icon: 'copy', onClick: async () => { await GB.copyText(href); GB.ui.toast('Link copied'); } }];
    if (/^https?:/i.test(href)) items.push({ label: 'Open in browser', icon: 'open', onClick: () => window.open(href, '_blank', 'noopener') });
    if (navigator.share) items.push({ label: 'Share', icon: 'share', onClick: () => navigator.share({ url: href }).catch(() => {}) });
    GB.ui.menu(null, items, { at: { x: innerWidth / 2 - 130, y: innerHeight / 3 } });
  }
  // ---------- in-text search bar ----------
  function showSearchBar() {
    sbar.hidden = false; sbar.querySelector('.rs-q').textContent = needles.join(' '); sbar.querySelector('.rs-n').textContent = sCount ? (sIdx + 1) + '/' + sCount : '0';
    if (sCount) mark(0, true);
  }
  function mark(k, first) {
    const v = contOn() ? contEl : scrollOf(slots[1]); v.querySelectorAll('.srch_res_HL').forEach(x => x.classList.remove('srch_res_HL'));
    const t = v.querySelector('#srch_' + (k + 1)); if (!t) return; t.classList.add('srch_res_HL'); t.scrollIntoView({ block: first ? 'center' : 'nearest', behavior: first ? 'auto' : 'smooth' });
    sbar.querySelector('.rs-n').textContent = (k + 1) + '/' + sCount;
  }
  function searchStep(d) { if (!sCount) return; sIdx = (sIdx + d + sCount) % sCount; mark(sIdx); }
  function clearSearch() { needles = null; sbar.hidden = true; R.rerender(); }
  // ---------- selection actions ----------
  const BLOCK_SEL = '#verseSanskrit,#verseTranslit,#verseTranslWBW,#verseTransl2,#versePurport';
  function onSel() {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed || !cur) return hideSelbar();
    const r = s.getRangeAt(0); const node = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    if (!slots[1].contains(node) && !contEl.contains(node) && !(node.closest && node.closest('.cmp-pane'))) return hideSelbar();
    if (!s.toString().trim()) return hideSelbar();
    // keep what was selected: on phones a tap on the action bar can collapse the selection before the click lands
    selCache = { a: selAnchor(), t: s.toString().trim(), v: node.closest ? node.closest('.verse') : null };
    showSelbar(r);
  }
  let selCache = null;
  const touchUI = () => matchMedia('(pointer: coarse)').matches || !GB.isWide();
  function clearSel() { try { getSelection().removeAllRanges(); } catch (e) {} selCache = null; hideSelbar(); }
  function selAnchor() {
    const s = getSelection(); if (!s.rangeCount) return null; const r = s.getRangeAt(0);
    const sn = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode;
    const block = sn.closest(BLOCK_SEL) || (r.endContainer.parentNode && r.endContainer.parentNode.closest && r.endContainer.parentNode.closest(BLOCK_SEL)); if (!block) return null;
    let start = GB.render.offsetIn(block, r.startContainer, r.startOffset); if (start < 0 || !block.contains(r.startContainer)) start = 0;
    let end = block.contains(r.endContainer) ? GB.render.offsetIn(block, r.endContainer, r.endOffset) : block.textContent.length;
    const text = block.textContent; while (start < end && /\s/.test(text[start])) start++; while (end > start && /\s/.test(text[end - 1])) end--;
    if (end <= start) return null;
    return { block: block.id, start, end, quote: text.slice(start, end) };
  }
  function showSelbar(range) {
    if (!selbar) {
      // desktop: a floating bar over the selection. Touch screens: an action bar across the top.
      const b = (label, fn, icon, cls) => h('button.sb-b' + (cls || ''), { onmousedown: e => e.preventDefault(), onclick: fn, title: label },
        icon ? (/\.png$/.test(icon) ? img(icon) : GB.ico(icon)) : null, h('span', { text: label }));
      selbar = h('div.selbar', { role: 'toolbar', 'aria-label': 'Selected text' },
        b('Done', clearSel, 'check', '.sb-done'),
        b('Copy', selCopy, 'copy', '.sb-copy'), b('Highlight', () => addSel('highl'), 'cab_highl.png'), b('Comment', () => addSel('note'), 'cab_comment.png'),
        b('Question', () => addSel('quest'), 'qmark.png'), b('Quote', () => addSel('quote'), 'ic_copy_quote.png'),
        h('button.sb-b.sb-more', { title: 'More', onmousedown: e => e.preventDefault(), onclick: e => selMore(e.currentTarget) }, GB.ico('more'), h('span.sb-ml', { text: 'More' })));
      $('#overlays').append(selbar);
    }
    const cab = touchUI();
    selbar.classList.toggle('cab', cab);
    if (selbar.hidden !== false) { selbar.hidden = false; GB.ui.pushEsc(clearSel); }
    if (cab) { selbar.style.left = selbar.style.top = ''; return; }
    const rc = range.getBoundingClientRect(); const bw = selbar.offsetWidth || 420, bh = selbar.offsetHeight || 44;
    let x = Math.max(6, Math.min(innerWidth - bw - 6, rc.left + rc.width / 2 - bw / 2)); let y = rc.top - bh - 10; if (y < 60) y = rc.bottom + 10;
    selbar.style.left = x + 'px'; selbar.style.top = Math.min(innerHeight - bh - 6, y) + 'px';
  }
  function hideSelbar() { if (selbar && !selbar.hidden) { selbar.hidden = true; GB.ui.popEsc(clearSel); } }
  async function addSel(type) {
    const vs = (() => { const s = getSelection(); if (s.rangeCount) { const n = s.getRangeAt(0).startContainer; const e = n.nodeType === 1 ? n : n.parentNode; if (e && e.closest) return e.closest('.verse'); } return selCache && selCache.v; })();
    if (vs) focusVerse(vs);
    const a = selAnchor() || (selCache && selCache.a); if (!a) return; clearSel();
    const n = { type, ref: GB.notes.ref(cur.B, cur.ch, cur.row), anchor: { block: a.block, start: a.start, end: a.end }, quote: a.quote, tags: [] };
    if (type === 'note' || type === 'quest') { GB.noteEdit(n); return; }
    await GB.notes.save(n); R.rerender(); GB.refreshAll(); GB.ui.toast(type === 'quote' ? 'Added to favourite quotes' : 'Highlighted');
  }
  const selText = () => getSelection().toString().trim() || (selCache && selCache.t) || '';
  async function selCopy() { const t = selText(); clearSel(); await GB.copyText(t); GB.ui.toast('Copied'); }
  function selMore(anchor) {
    const t = selText(); const ref = lib.label(cur.B, cur.ch.song, cur.ch.ch, cur.row.no);
    GB.ui.menu(anchor, [
      { label: 'Copy with reference', icon: 'copy', onClick: async () => { await GB.copyText('"' + t + '" (' + ref + ')'); GB.ui.toast('Copied'); } },
      { label: 'Copy with link', icon: 'link', onClick: async () => { await GB.copyText('"' + t + '" (' + ref + ')\n' + deepLink()); GB.ui.toast('Copied'); } },
      { label: 'Search in this book', icon: 'search', onClick: () => GB.search.run({ q: t, book: cur.B }) },
      { label: 'Search all books', icon: 'search', onClick: () => GB.search.run({ q: t }) },
      { label: 'Select all', icon: 'list', onClick: () => { const v = curVerse(); const r = document.createRange(); r.selectNodeContents(v); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } },
      navigator.share ? { label: 'Share', icon: 'share', onClick: () => navigator.share({ text: '"' + t + '" (' + ref + ')' }).catch(() => {}) } : null].filter(Boolean));
  }
  // ---------- phones: full screen while reading (pr_hide_android_status_bar) and keep the screen on ----------
  GB.screen = (function () {
    let lock = null, want = false;
    async function wake() {
      if (!want || !GB.prefs.keepAwake || !navigator.wakeLock || document.visibilityState !== 'visible' || lock) return;
      try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch (e) { lock = null; }
    }
    function sleep() { if (lock) { lock.release().catch(() => {}); lock = null; } }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
    return {
      enter() {
        want = true; wake();
        if (GB.prefs.hideStatusBar && !GB.isWide() && document.fullscreenEnabled && !document.fullscreenElement)
          document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      },
      leave() { want = false; sleep(); if (document.fullscreenElement && GB.prefs.hideStatusBar) document.exitFullscreen().catch(() => {}); },
      pref() { if (!want) return; if (GB.prefs.keepAwake) wake(); else sleep(); }
    };
  })();
  // keyboard
  R.key = function (e) {
    if (!cur || el.hidden) return false;
    if (!GB.isWide() && !document.body.classList.contains('reading')) return false;
    if (e.key === 'ArrowRight') { go(1); return true; } if (e.key === 'ArrowLeft') { go(-1); return true; }
    if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { pageStep(1); return true; } if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { pageStep(-1); return true; }
    return false;
  };
})(window.GB);
