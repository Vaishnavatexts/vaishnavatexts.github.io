/* Vaishnava Texts: app shell (page stack, back handling, tab rail) and the home tabs:
   L My Library (Books / Reading / My books), F favourites, Q questions, N notes, T topics, D dictionary. */
'use strict';
(function (GB) {
  const { h, $, $$, img } = GB;
  const lib = GB.lib;
  GB.ut = s => String(s == null ? '' : s).replace(/ ([।॥ः])/g, '\u00a0$1');          // UI strings from the books
  GB.decEnt = s => String(s == null ? '' : s).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&nbsp;/g, '\u00a0').replace(/&amp;/g, '&').normalize('NFC');
  GB.foldKey = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Settings > Layout: 'desktop' / 'mobile' force a view; 'auto' follows the window width (900 px)
  GB.isWide = () => GB.prefs.layout === 'desktop' ? true : GB.prefs.layout === 'mobile' ? false : window.matchMedia('(min-width: 900px)').matches;
  const ico = (name, cls) => h('span.ico' + (cls ? '.' + cls : ''), { html: GB.icons.svg(name) });
  GB.ico = ico;

  // ---------- switchers (Books/Reading, segmented controls): one highlight that slides to the chosen option ----------
  // Controls are rebuilt on every change, so the last position is kept per control and the highlight glides from there.
  const PILL = new Map();
  GB.pill = function (el, key) {
    el.classList.add('has-pill'); const p = document.createElement('i'); p.className = 'pill'; el.prepend(p);
    let motion = null;
    const place = anim => {
      const on = el.querySelector(':scope > .on'); if (!on || !el.isConnected) return false;
      const box = { x: on.offsetLeft, w: on.offsetWidth, y: on.offsetTop, hgt: on.offsetHeight }; if (!box.w) return false;
      const idx = Array.prototype.indexOf.call(el.children, on), last = PILL.get(key);
      const transform = b => 'translate(' + b.x + 'px,' + b.y + 'px)';
      // ResizeObserver also fires on attachment. Ignore identical geometry so it cannot cancel a glide.
      const same = last && last.idx === idx && last.x === box.x && last.y === box.y && last.w === box.w && last.hgt === box.hgt;
      if (!anim && same && el.classList.contains('pill-on')) return true;
      if (motion) { motion.cancel(); motion = null; }
      p.style.setProperty('transition', 'none', 'important');
      p.style.width = box.w + 'px'; p.style.height = box.hgt + 'px'; p.style.transform = transform(box);
      if (anim && last && last.idx !== idx && last.w && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        motion = p.animate([
          { transform: transform({ x: last.x, y: box.y }), width: last.w + 'px' },
          { transform: transform(box), width: box.w + 'px' }
        ], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
      PILL.set(key, Object.assign({ idx }, box)); el.classList.add('pill-on'); return true;
    };
    let tries = 0; const go = () => { if (!place(true) && ++tries < 6) requestAnimationFrame(go); };
    requestAnimationFrame(go);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (!el.isConnected) { ro.disconnect(); return; }
        if (el.classList.contains('pill-on')) place(false);
      });
      ro.observe(el);
    }
    return el;
  };

  // ---------- what to call a book's top level: Canto (SB), līlā (CC), year (Letters, Conversations), topic ----------
  const isSBlike = B => B.abbr === 'SB' || /bh[aā]gavat/i.test(B.title || '') || /भागवत/.test(B.title || '');
  GB.songInfo = function (B, key) {
    const s = key && typeof key === 'object' ? key : ((B.songs || []).find(x => String(x.song) === String(key)) || { song: key });
    const n = String(s.song); const sb = isSBlike(B); const word = B.lang === 'hin' ? 'स्कन्ध' : 'Canto';
    let name = GB.ut(s.name || '').trim(), sub = GB.ut(s.subtitle || '').trim(), title = name, count = '';
    let m = name.match(/^(?:Canto|Part)\s+(\d+)\s*[:.\-]\s*(.+)$/i); if (m) { title = m[2]; if (!sub) sub = 'Canto ' + m[1]; }
    m = name.match(/^(\d{4})\s*\(([^)]*)\)\s*(\d+)?$/); if (m) { title = m[1]; sub = sub || m[2].split(/,\s*/).slice(0, 4).join(' · ') + (m[2].split(',').length > 4 ? ' …' : ''); count = m[3] || ''; }
    if (!sub && sb && !/^\d+$/.test(title)) sub = B.lang === 'eng' ? 'Canto ' + n : n;
    if (!title) title = sb ? (B.lang === 'eng' ? 'Canto ' + n : word + ' ' + n) : n;
    if (sub === title) sub = '';
    const short = sb && B.lang === 'eng' ? 'Canto ' + n : (title.length <= 16 ? title : (sb ? word + ' ' + n : title.slice(0, 15) + '…'));
    const unit = /letter/i.test(B.title || '') ? 'letters' : /conversation/i.test(B.title || '') ? 'talks' : '';
    const all = sb ? (B.lang === 'hin' ? 'सभी स्कन्ध' : 'All cantos') : /l[iī]l[aā]/i.test(name) ? 'All līlās' : /^\d{4}$/.test(title) ? 'All years' : /topic/i.test(B.title || '') ? 'All topics' : 'All parts';
    return { sub, title, short, all, count: count && unit ? count + ' ' + (count === '1' ? unit.replace(/s$/, '') : unit) : count };
  };
  // numbered books (verse references make sense); Letters, Conversations, KRISHNA Book etc. use titles instead
  GB.numbered = B => !!(B && (GB.canGoto ? GB.canGoto(B) : ['BG', 'SB', 'CC'].includes(B.abbr)) || (B && B.hasSanskrit));
  GB.bookShort = B => { const t = GB.ut(B.title || '').replace(/^(Srila Prabhupada|Śrīla Prabhupāda|SP)\s+/i, ''); return t.length > 20 ? t.slice(0, 19) + '…' : t; };

  // ---------- page stack (left column on desktop, whole screen on phones) ----------
  const L = GB.left = { stack: [] };
  L.top = () => L.stack[L.stack.length - 1];
  // desktop: Settings-type pages open as a window over the app instead of replacing the sidebar
  const MODAL = { settings: 1, verseorder: 1, parts: 1, about: 1 };
  L.isModal = p => !!(p && MODAL[p.kind] && document.documentElement.classList.contains('desk'));
  function modalHost() {
    let m = $('#deskModal'); if (m) return m;
    m = h('div#deskModal', { onclick: e => { if (e.target === m) { while (L.isModal(L.top())) L.pop(); } } }, h('div.dm-win'));
    document.body.append(m); return m;
  }
  function syncModal() { const m = $('#deskModal'); if (m) m.classList.toggle('on', L.stack.some(L.isModal)); }
  L.push = page => {
    // On phones the reader is a full-screen layer above #left. Utility pages must
    // suspend that layer, then return to the unchanged verse when Back is pressed.
    if (!GB.isWide() && document.body.classList.contains('reading')) {
      page.returnToReader = true;
      GB.reader.close();
    }
    const t = L.top(); if (t && !L.isModal(page)) t.el.classList.add('under');
    if (L.isModal(page)) { const w = modalHost().firstChild; w.querySelectorAll('.page').forEach(x => x.classList.add('under')); w.append(page.el); page.el.classList.add('dm-page');
      const right = page.hdr && page.hdr.querySelector('.hdr-right'); if (right && !right.querySelector('.dm-x')) right.append(h('button.hdr-btn.dm-x', { title: 'Close (Esc)', onclick: () => { while (L.isModal(L.top())) L.pop(); }, html: GB.icons.svg('close') })); }
    else $('#left').append(page.el);
    L.stack.push(page); chrome(); syncModal();
    requestAnimationFrame(() => page.el.classList.add('in'));
    return page;
  };
  L.replaceTop = page => { if (L.stack.length > 1) { const p = L.stack.pop(); p.el.remove(); if (p.onClose) p.onClose(); } return L.push(page); };
  L.pop = () => {
    if (L.stack.length <= 1) return false;
    const p = L.stack.pop(); if (p.onClose) p.onClose(); leave(p.el);
    const t = L.top(); t.el.classList.remove('under'); if (t.refresh) t.refresh();
    if (p.returnToReader && GB.reader.current()) {
      document.body.classList.add('reading');
      GB.screen.enter();
    }
    chrome(); syncModal(); return true;
  };
  // a popped page slides out before it is removed (no delay when motion is reduced)
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function leave(el) {
    if (calm() || !el.isConnected || el.classList.contains('dm-page')) { el.remove(); return; }
    el.classList.add('out'); el.inert = true; let done = false; const fin = () => { if (!done) { done = true; el.remove(); } };
    el.addEventListener('animationend', fin, { once: true }); setTimeout(fin, 260);
  }
  L.home = tab => {
    while (L.stack.length > 1) { const p = L.stack.pop(); p.el.remove(); if (p.onClose) p.onClose(); }
    L.top().el.classList.remove('under');
    if (tab && tab !== HOME.tab) HOME.select(tab); else HOME.render();
    chrome(); syncModal();
  };
  L.find = kind => L.stack.find(p => p.kind === kind);
  function chrome() {
    document.body.classList.toggle('at-home', L.stack.length <= 1);
    const deskOn = document.documentElement.classList.contains('desk');
    $$('#rail .tab').forEach(t => t.classList.toggle('on', (L.stack.length <= 1 || !deskOn) && t.dataset.tab === HOME.tab));
    if (GB.nowbar) GB.nowbar.sync();
  }
  GB.chrome = chrome;
  // generic page with an app title bar
  GB.page = function (o) {
    const back = h('button.hdr-logo', { title: 'Back', onclick: () => GB.back() }, img('headermenuicon.png'), ico('back', 'hdr-backic'));
    const titles = h('div.t2', null, h('div.t2a', { text: GB.ut(o.title || '') }), o.subtitle != null ? h('div.t2b', { text: GB.ut(o.subtitle) }) : null);
    const right = h('div.hdr-right'); (o.actions || []).forEach(a => right.append(a));
    const hdr = h('header.hdr' + (o.big ? '.big' : ''), null, back, titles, right);
    const body = h('div.pc' + (o.bodyCls ? '.' + o.bodyCls : ''));
    const el = h('div.page' + (o.cls ? '.' + o.cls : ''), null, hdr, o.under || null, body);
    return { el, hdr, body, titles, kind: o.kind, refresh: o.refresh, onClose: o.onClose };
  };
  GB.hbtn = (iconName, title, onclick, cls) => h('button.hdr-btn' + (cls ? '.' + cls : ''), { title, onclick }, iconName.indexOf('.') > 0 ? img(iconName.replace(/\.(png|svg)$/, '_hdr.$1')) : ico(iconName));

  // ---------- back: overlays -> reader (phone) -> page stack -> home tab ----------
  GB.back = function () {
    if (GB.ui.handleEsc()) return true;
    if (document.body.classList.contains('reading') && !GB.isWide()) { GB.reader.close(); return true; }
    if (L.pop()) return true;
    if (HOME.tab !== 'L') { HOME.select('L'); return true; }
    return false;
  };
  GB.nav = {
    init() {
      try { history.pushState({ gb: 1 }, ''); } catch (e) {}
      window.addEventListener('popstate', () => { if (GB.back()) { try { history.pushState({ gb: 1 }, ''); } catch (e) {} } });
    }
  };

  // ---------- rail / bottom tabs: Library · Notebook · Search ----------
  GB.APP_NAME = GB.APP_NAME || 'Vaishnava Texts';   // shown in the menu and About; index.html and manifest.webmanifest carry it too
  const TABS = [{ k: 'L', icon: 'lib', title: 'Library' }, { k: 'N', icon: 'notebook', title: 'Notebook' }, { k: 'S', icon: 'search', title: 'Search' }];
  const OLD_TAB = { F: 'N', Q: 'N', T: 'N', D: 'S' };
  GB.TABS = TABS;
  function buildRail() {
    const r = $('#rail'); r.innerHTML = '';
    r.append(h('div.rail-logo', { 'aria-hidden': 'true' }, img('headermenuicon.png')));
    for (const t of TABS) r.append(h('button.tab', { 'data-tab': t.k, title: t.title, 'aria-label': t.title, onclick: () => L.home(t.k) }, h('span.tab-ico', { html: GB.icons.svg(t.icon) }), h('span.tab-l', { text: t.title })));
  }

  // ---------- home ----------
  const HOME = GB.home = { tab: 'L', sub: 'books', nbFilter: 'all', nbQuery: '', showFinished: false };
  let homeEl, hdrEl, bodyEl;
  HOME.build = function () {
    buildRail();
    hdrEl = h('header.hdr.home-hdr'); bodyEl = h('div.pc.home-body');
    homeEl = h('div.page.home.in', null, hdrEl, h('div.strip', null, h('span', { text: 'Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare' }), h('span.strip-dot', { text: ' · ' }), h('span', { text: 'Hare Rāma Hare Rāma Rāma Rāma Hare Hare' })), bodyEl);
    L.stack = []; $('#left').innerHTML = ''; L.push({ el: homeEl, kind: 'home', refresh: () => HOME.render() });
    HOME.render();
  };
  HOME.select = tab => { HOME.tab = OLD_TAB[tab] || tab; HOME.render(); chrome(); bodyEl.scrollTop = 0; bodyEl.classList.add('tab-in'); };
  HOME.render = function () {
    if (OLD_TAB[HOME.tab]) HOME.tab = OLD_TAB[HOME.tab];
    renderHeader();
    const keep = bodyEl.scrollTop; bodyEl.innerHTML = ''; bodyEl.className = 'pc home-body tab-' + HOME.tab;
    ({ L: renderL, N: renderNotebook, S: renderSearch })[HOME.tab](bodyEl);
    bodyEl.scrollTop = keep; chrome();
  };
  function renderHeader() {
    hdrEl.innerHTML = '';
    hdrEl.append(h('button.hdr-logo', { title: 'Menu', onclick: e => tabMenu(e.currentTarget) }, img('headermenuicon.png')));
    const t = { L: 'Library', N: 'Notebook', S: 'Search' }[HOME.tab];
    hdrEl.append(h('div.hdr-title', { text: t }));
    const right = h('div.hdr-right');
    const canGo = GB.gotoBooks && GB.gotoBooks().length;
    if (HOME.tab === 'L') { if (canGo) right.append(GB.hbtn('goto', 'Go to verse', () => GB.gotoVerse({}))); right.append(GB.hbtn('search', 'Search', () => L.home('S'))); }
    if (HOME.tab === 'N') right.append(GB.hbtn('plus', 'New', e => newMenu(e.currentTarget)));
    if (HOME.tab === 'S' && canGo) right.append(GB.hbtn('goto', 'Go to verse', () => GB.gotoVerse({})));
    hdrEl.append(right);
  }
  function curLang() { const ls = lib.langs(); if (GB.prefs.lang === '*') return ''; if (ls.includes(GB.prefs.lang)) return GB.prefs.lang; return ''; }
  HOME.curLang = curLang;
  function newMenu(anchor) {
    GB.ui.menu(anchor, [{ label: 'New note', icon: 'note', onClick: () => GB.noteEdit({ type: 'note', general: true, tags: HOME.folder ? [HOME.folder] : [] }) },
      { label: 'New question', icon: 'quest', onClick: () => GB.noteEdit({ type: 'quest', general: true, tags: HOME.folder ? [HOME.folder] : [] }) },
      { label: 'New folder', icon: 'folderPlus', onClick: addFolder }]);
  }
  function tabMenu(anchor) {
    const notesIO = [{ label: 'Back up notes', icon: 'ic_save_to_cloud.png', onClick: () => GB.notes.backup() }, { label: 'Restore notes', icon: 'ic_open_from_cloud.png', onClick: () => GB.restoreUI() }];
    const items = [{ header: true, label: GB.APP_NAME },
      { label: 'History', icon: 'ic_screen_manager.png', onClick: () => GB.historyPage() },
      GB.gotoBooks && GB.gotoBooks().length ? { label: 'Go to verse', icon: 'goto', onClick: () => GB.gotoVerse({}) } : null,
      lib.hosted ? null : { label: 'Add books', icon: 'ic_plus_orange.png', onClick: () => GB.addFilesUI() },
      { label: GB.prefs.night ? 'Day theme' : 'Night theme', icon: GB.prefs.night ? 'ic_sun.png' : 'ic_menu_night.png', onClick: GB.toggleNight },
      { label: 'Notes', icon: 'notebook', sub: notesIO.concat(HOME.tab === 'N' ? [{ label: 'Export all as Markdown', icon: 'export', onClick: () => GB.exportNotes(null) }] : []) },
      { label: 'Maintenance', icon: 'ic_sysutils.png', sub: [{ label: 'Clear search history', onClick: async () => { await GB.store.kvSet('searchHistory', []); GB.ui.toast('Search history cleared'); } }, { label: 'Clear browsing history', onClick: async () => { await GB.history.clear(); GB.ui.toast('Browsing history cleared'); } }] },
      { label: 'Settings', icon: 'ic_mmenu_settings.png', onClick: () => GB.settingsPage() },
      { label: 'About', icon: 'ic_mmenu_about.png', onClick: GB.about }];
    GB.ui.menu(anchor, items.filter(Boolean), { align: 'left' });
  }
  async function addFolder(parent) { const t = await GB.ui.prompt(typeof parent === 'string' ? 'New folder in ' + parent.split('/').pop() : 'New folder', '', 'folder name'); if (t) { await GB.notes.addTopic((typeof parent === 'string' ? parent + '/' : '') + t.replace(/\//g, '-')); refreshAll(); } }

  // ---------- L: library ----------
  function continueCard() {
    const e = Array.from(GB.reading.map.values()).filter(x => lib.book(x.id) && !x.finished).sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0];
    if (!e) return null; const B = lib.book(e.id); const pct = Math.round((e.progress || 0) * 100);
    return h('button.cont-card', { type: 'button', onclick: () => GB.reader.openSaved(B, e) },
      h('div.cc-k', { text: 'Continue reading' }),
      h('div.cc-main', null, h('div.cc-ref', { text: e.label }), h('div.cc-title', { text: GB.ut(e.title) })),
      e.preview ? h('div.cc-prev', { text: GB.ut(e.preview).slice(0, 180) }) : null,
      h('div.cc-bar', null, h('i', { style: { width: Math.max(2, pct) + '%' } })), h('span.cc-pct', { text: pct + '%' }));
  }
  function langChips() {
    const ls = lib.langs(); if (ls.length < 2) return null; const cur = curLang();
    const opt = (k, t) => h('button.chip2' + (cur === k ? '.on' : ''), { type: 'button', onclick: () => { GB.setPref('lang', k || '*'); GB.setPref('fileFilter', ''); HOME.render(); } }, t);
    return h('div.lang-chips', { role: 'group', 'aria-label': 'Language' }, opt('', 'All'), ls.map(l => opt(l, lib.LANG_NAMES[l] || l)));
  }
  function renderL(body) {
    const subs = [['books', 'Books'], ['reading', 'Reading']].concat(lib.hosted ? [] : [['mine', 'My books']]);
    // the switcher stays put at the top; the continue card sits under it
    body.append(GB.pill(h('div.subtabs', null, subs.map(([k, t]) => h('button.st' + (HOME.sub === k ? '.on' : ''), { onclick: () => { if (HOME.sub === k) return; HOME.sub = k; HOME.render(); } }, h('span', { text: t })))), 'subtabs'));
    if (HOME.sub === 'books') { const cc = continueCard(); if (cc) body.append(cc); }
    const list = h('div.stbody'); body.append(list);
    if (HOME.sub === 'books') { const lc = langChips(); if (lc) list.append(lc); }
    if (HOME.sub === 'reading') renderReading(list); else if (HOME.sub === 'mine' && !lib.hosted) renderMine(list); else renderBooks(list);
  }
  function emptyLib(list) {
    list.append(h('div.empty', null, img(GB.prefs.night ? 'my_books_empty_d.png' : 'my_books_empty.png', 'empty-img'),
      h('div.empty-t', { text: lib.hosted ? 'The online library is empty' : 'No book files yet' }),
      lib.hosted ? null : h('div.empty-s', { text: 'Add .db / .book files from your computer or phone. They stay in this browser, so you add them only once.' }),
      lib.hosted ? null : h('button.btn', { onclick: () => GB.addFilesUI() }, ico('plus'), h('span', { text: 'Add book files' })),
      lib.hosted ? null : h('div.empty-s.small', { text: 'Tip: you can also drop the files onto this window.' })));
    if (lib.broken && lib.broken.length) list.append(h('div.empty-s.err', { text: 'Could not reopen: ' + lib.broken.map(r => r.name).join(', ') }));
  }
  function renderBooks(list) {
    const lang = curLang(); let books = lib.books.filter(B => !lang || B.lang === lang);
    if (!lib.books.length) return emptyLib(list);
    for (const B of books) list.append(bookCard(B));
  }
  function bookCard(B) {
    const rd = GB.reading.get(B);
    if (B.hasSongs) {
      const row = h('div.cantos');
      for (const s of B.songs) {
        const mark = rd && String(rd.song) === s.song;
        const si = GB.songInfo(B, s);
        row.append(h('div.canto', { onclick: () => GB.book.open(B, s.song) },
          si.sub ? h('div.canto-sub', { text: si.sub }) : null,
          h('div.canto-title', { text: si.title }), si.count ? h('div.canto-sub.canto-n', { text: si.count }) : null,
          mark ? h('div.canto-mark', null, h('span', { text: rd.label.split(' ').pop() }), img('ic_bookmark_icon_short.png')) : null));
      }
      return h('div.vol', null, h('div.vol-author', { text: GB.ut(B.author) }), h('div.vol-title', { text: GB.ut(B.title), onclick: () => GB.book.open(B) }, offBadge(B)), row);
    }
    return h('div.bk', { onclick: () => GB.book.open(B) }, h('div.bk-author', { text: GB.ut(B.author) }), h('div.bk-title', { text: GB.ut(B.title) }),
      rd ? h('div.bk-mark', null, h('span', { text: rd.label.split(' ').pop() }), img(GB.prefs.night ? 'bookmark_open_dark.png' : 'bookmark_open.png')) : null,
      offBadge(B));
  }
  const offBadge = B => GB.offline && GB.offline.can(B) && GB.offline.has(B) ? h('span.off-badge', { title: 'Saved for offline reading', html: GB.icons.svg('offline') }) : null;
  function renderReading(list) {
    const all = Array.from(GB.reading.map.values()).filter(e => lib.book(e.id)).sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
    const fin = all.filter(e => e.finished), act = all.filter(e => !e.finished);
    const show = HOME.showFinished ? fin : act;
    if (!all.length) list.append(h('div.help-row', { text: 'Books you start reading appear here with your position, progress and reading time. Tap a card to continue.' }));
    for (const e of show) list.append(HOME.showFinished ? finishedCard(e) : readingCard(e));
    list.append(h('div.rswitch', { onclick: () => { HOME.showFinished = !HOME.showFinished; HOME.render(); } },
      h('span.rswitch-t', { text: HOME.showFinished ? 'Reading' : 'Finished' }), h('span.rswitch-c', { text: String(HOME.showFinished ? act.length : fin.length) }), ico('fwd', 'rswitch-a')));
  }
  function readingCard(e) {
    const B = lib.book(e.id); const pct = Math.round((e.progress || 0) * 100);
    const left = B ? Math.max(0, B.textSize * (1 - (e.progress || 0)) / (Math.max(1, GB.prefs.readSpeed) * 100) * 60000) : 0;
    return h('div.rcard', { onclick: () => GB.reader.openSaved(B, e) },
      h('div.rc-author', { text: GB.ut(e.author) }), h('div.rc-title', { text: GB.ut(e.title) }),
      h('div.rc-prog', null, h('span.rc-pct', { text: pct + '%' }), h('div.rc-bar', null, h('i', { style: { width: pct + '%' } }))),
      h('div.rc-meta', null, img(GB.prefs.night ? 'ic_time1_d.png' : 'ic_time1_o.png', 'rc-ic'), h('span', { text: GB.fmtDuration(e.timeSpent || 0) }), h('span.rc-code', { text: e.label }),
        h('span.rc-left', { text: GB.fmtDuration(left) }), img(GB.prefs.night ? 'ic_time2_d.png' : 'ic_time2_o.png', 'rc-ic')),
      h('div.rc-sub', { text: GB.ut(e.preview || e.chTitle || '') }),
      h('span.rc-mode', { html: GB.icons.svg(e.mode === 'horizontal' ? 'horizontal' : e.mode === 'cont' ? 'scroll' : 'single'), title: e.mode === 'horizontal' ? 'Pages' : e.mode === 'cont' ? 'Continuous' : 'Verse by verse' }),
      h('button.rc-del', { title: 'Delete', onclick: async ev => { ev.stopPropagation(); if (await GB.ui.confirm('Reading list', 'Remove "' + e.title + '" from the reading list?')) { await GB.reading.remove(e.id); HOME.render(); } } }, img(GB.prefs.night ? 'ic_icon_delete_d.png' : 'ic_icon_delete.png')));
  }
  function finishedCard(e) {
    return h('div.rcard.fin', { onclick: () => GB.reader.openSaved(lib.book(e.id), e) }, img(GB.prefs.night ? 'purnam_d.png' : 'purnam.png', 'rc-ribbon'),
      h('div.rc-author', { text: GB.ut(e.author) }), h('div.rc-title', { text: GB.ut(e.title) }), h('div.rc-time', { text: 'Reading time: ' + GB.fmtDuration(e.timeSpent || 0) + (e.finishedAt ? ' · finished ' + new Date(e.finishedAt).toLocaleDateString() : '') }));
  }
  function renderMine(list) {
    list.append(h('div.file-add', { onclick: () => GB.addFilesUI() }, img('ic_plus_orange.png'), h('span', { text: 'Add book files (.db, .book file)' })));
    const files = Array.from(lib.dbs.values());
    if (!files.length) list.append(h('div.help-row', { text: 'Files you add are kept inside this browser (IndexedDB) and are read page by page, so even 190 MB book files open instantly.' }));
    for (const D of files) {
      const books = lib.books.filter(B => B.parts.some(p => p.D === D)).map(B => B.title);
      list.append(h('div.file-row', null, ico('db', 'file-ic'), h('div.file-main', null, h('div.file-name', { text: D.name }),
        h('div.file-meta', { text: GB.fmtSize(D.size) + ' · ' + (lib.LANG_NAMES[D.lang] || D.lang) + (D.hasFts ? ' · search index' : '') }), h('div.file-books', { text: GB.ut(books.join(' · ')) })),
        h('button.file-del', { title: 'Remove from library', onclick: async () => { if (await GB.ui.confirm('Remove book file', 'Remove ' + D.name + ' from this browser? Your notes stay.', 'REMOVE')) { await lib.removeDb(D.id); HOME.render(); } } }, ico('trash'))));
    }
    if (lib.broken && lib.broken.length) list.append(h('div.empty-s.err', { text: 'Could not reopen: ' + lib.broken.map(r => r.name).join(', ') }));
  }
  GB.addFilesUI = () => { const i = $('#fileAdd'); i.value = ''; i.click(); };

  // ---------- note cards ----------
  const TYPE_ICON = { fav: 'heartOn', quote: 'quote', highl: 'marker', note: 'note', quest: 'quest' };
  GB.noteCard = function (n) {
    const top = h('div.nc-top', null, h('span.nc-type.k-' + n.type, { html: GB.icons.svg(TYPE_ICON[n.type] || 'note') }),
      n.ref ? h('span.nc-chip', { text: n.ref.label }) : h('span.nc-gen', { text: n.type === 'quest' ? 'Question' : 'Note' }), h('span.nc-date', { text: GB.fmtDate(n.created) }));
    const el = h('div.ncard.t-' + n.type, { onclick: () => openNote(n) }, top,
      n.subject ? h('div.nc-subject', { text: n.subject }) : null,
      n.text ? h('div.nc-comment', { text: n.text }) : null,
      n.quote ? h('div.nc-quote' + (n.type === 'fav' ? '.fav' : ''), { text: GB.ut(n.quote) }) : null,
      (n.tags && n.tags.length) ? h('div.nc-tags', null, n.tags.map(t => h('span.nc-folder', { html: GB.icons.svg('folder') + '<span>' + GB.esc(t.split('/').pop()) + '</span>' }))) : null,
      h('button.nc-edit', { title: 'Edit', onclick: e => { e.stopPropagation(); GB.noteEdit(n); } }, ico('edit')));
    return el;
  };
  async function openNote(n) {
    if (!n.ref) return GB.noteEdit(n);
    const B = lib.book(n.ref.book) || lib.resolveBook(n.ref.abbr, n.ref.lang);
    if (!B) { GB.ui.toast('The book of this note is not in your library'); return; }
    const ch = lib.findChapter(B, n.ref.song, n.ref.ch); if (!ch) { GB.ui.toast('Chapter not found in your library'); return; }
    const rows = await lib.chapterTexts(B, ch); const i = lib.findTextIndex(rows, n.ref.no); if (i < 0) return;
    GB.reader.open(B, ch, i, { noteId: n.id, noAsk: true });
  }
  function noteList(body, notes, emptyText) {
    if (!notes.length) { if (emptyText) body.append(h('div.help-row', { text: emptyText })); return; }
    notes.sort((a, b) => b.created - a.created).forEach(n => body.append(GB.noteCard(n)));
  }
  // ---------- N: Notebook (highlights, notes, questions, favourites; folders = the old topics) ----------
  const NB_F = [['all', 'All'], ['highl', 'Highlights'], ['note', 'Notes'], ['quest', 'Questions'], ['fav', '♥']];
  const nbTypes = f => ({ all: null, highl: ['highl', 'quote'], note: ['note'], quest: ['quest'], fav: ['fav'] })[f];
  function nbMatch(n, q) { if (!q) return true; const f = GB.fold(q); return [n.subject, n.text, n.quote, n.ref && n.ref.label, (n.tags || []).join(' ')].some(x => x && GB.fold(String(x)).includes(f)); }
  function nbFiltered(list) { const ts = nbTypes(HOME.nbFilter); return list.filter(n => (!ts || ts.includes(n.type)) && nbMatch(n, HOME.nbQuery)); }
  function nbTools(body, onChange) {
    const q = h('input.nb-q', { type: 'search', value: HOME.nbQuery, placeholder: 'Search your notes', 'aria-label': 'Search your notes' });
    q.addEventListener('input', GB.debounce(() => { HOME.nbQuery = q.value.trim(); onChange(); }, 200));
    body.append(h('div.nb-tools', null, h('div.nb-qbox', null, ico('search'), q),
      h('div.nb-chips', { role: 'group', 'aria-label': 'Show' }, NB_F.map(([k, t]) => h('button.chip2' + (HOME.nbFilter === k ? '.on' : '') + (k === 'fav' ? '.heart' : ''), { type: 'button', 'aria-label': k === 'fav' ? 'Favourites' : t, onclick: () => { HOME.nbFilter = k; onChange(true); } }, k === 'fav' ? h('span', { html: GB.icons.svg('heartOn') }) : t)))));
    return q;
  }
  function folderRows(body, parent) {
    const kids = GB.notes.children(parent);
    for (const t of kids) {
      const subs = GB.notes.children(t).length, cnt = GB.notes.inTopic(t, true).length;
      body.append(h('div.folder', { onclick: () => GB.topicPage(t) }, h('span.folder-ic', { html: GB.icons.svg('folder') }),
        h('div.folder-main', null, h('div.folder-name', { text: t.split('/').pop() }), h('div.folder-n', { text: (subs ? subs + (subs === 1 ? ' folder · ' : ' folders · ') : '') + cnt + (cnt === 1 ? ' item' : ' items') })),
        h('button.folder-more', { title: 'Folder actions', onclick: e => { e.stopPropagation(); folderMenu(e.currentTarget, t); } }, ico('more'))));
    }
    return kids.length;
  }
  function folderMenu(anchor, t) {
    GB.ui.menu(anchor, [{ label: 'Rename', icon: 'edit', onClick: async () => { const n = await GB.ui.prompt('Rename folder', t.split('/').pop()); if (n && n !== t.split('/').pop()) { const par = t.includes('/') ? t.slice(0, t.lastIndexOf('/') + 1) : ''; await GB.notes.renameTopic(t, par + n.replace(/\//g, '-')); refreshAll(); } } },
      { label: 'New folder inside', icon: 'folderPlus', onClick: () => addFolder(t) },
      { label: 'Export as Markdown', icon: 'export', onClick: () => GB.exportNotes(t) },
      { label: 'Print or save as PDF', icon: 'print', onClick: () => GB.printNotes(t) },
      { label: 'Delete folder', icon: 'trash', onClick: async () => { if (await GB.ui.confirm('Delete folder', 'Delete "' + t.split('/').pop() + '" and the folders inside it? The notes stay in your Notebook.', 'Delete')) { await GB.notes.deleteTopic(t); refreshAll(); } } }]);
  }
  function refreshAll() { for (const p of L.stack) if (p.refresh) p.refresh(); }
  GB.refreshAll = refreshAll;
  function renderNotebook(body) {
    HOME.folder = null;
    const list = h('div.nb-list');
    const draw = () => {
      list.innerHTML = ''; const searching = !!HOME.nbQuery || HOME.nbFilter !== 'all';
      if (!searching) { const n = folderRows(list, ''); if (n) list.append(h('div.nb-sep')); }
      const notes = nbFiltered(GB.notes.list);
      noteList(list, notes, GB.notes.list.length ? 'Nothing matches.' : 'Select words in a verse to highlight, comment or ask a question, or tap the heart on a verse. Everything you keep lands here. Tap + for a note of your own or a folder.');
    };
    const q = nbTools(body, chips => { if (chips) HOME.render(); else draw(); });
    body.append(list); draw();
    if (HOME.nbQuery) setTimeout(() => { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 0);
  }
  GB.topicPage = function (t) {
    const pg = GB.page({ kind: 'topic', title: t.split('/').pop(), subtitle: t.includes('/') ? t.split('/').slice(0, -1).join(' › ') : 'Folder',
      actions: [GB.hbtn('plus', 'New', e => GB.ui.menu(e.currentTarget, [{ label: 'New note here', icon: 'note', onClick: () => GB.noteEdit({ type: 'note', general: true, tags: [t] }) }, { label: 'New question here', icon: 'quest', onClick: () => GB.noteEdit({ type: 'quest', general: true, tags: [t] }) }, { label: 'New folder inside', icon: 'folderPlus', onClick: () => addFolder(t) }])),
        GB.hbtn('more', 'Folder actions', e => folderMenu(e.currentTarget, t))] });
    function fill() { pg.body.innerHTML = ''; const n = folderRows(pg.body, t); if (n) pg.body.append(h('div.nb-sep')); noteList(pg.body, GB.notes.inTopic(t, false), n ? '' : 'This folder is empty. Add notes to it from the note editor.'); }
    pg.refresh = fill; fill(); L.push(pg);
  };
  // ---------- export a folder (or everything) as Markdown, or print it ----------
  function notesFor(t) { return (t ? GB.notes.inTopic(t, true) : GB.notes.list.slice()).sort((a, b) => a.created - b.created); }
  function mdOf(t) {
    const out = ['# ' + (t ? t.split('/').join(' › ') : 'Notebook'), ''];
    for (const n of notesFor(t)) {
      out.push('## ' + (n.ref ? n.ref.label + ' · ' : '') + (GB.notes.TYPES[n.type] || 'Note') + (n.subject ? ': ' + n.subject : ''));
      if (n.quote) out.push('', '> ' + GB.ut(n.quote).replace(/\n+/g, '\n> '));
      if (n.text) out.push('', n.text);
      if (n.tags && n.tags.length) out.push('', '_Folders: ' + n.tags.join(', ') + '_');
      out.push('', '<sub>' + new Date(n.created).toLocaleString() + '</sub>', '');
    }
    return out.join('\n');
  }
  GB.exportNotes = t => { const name = (t ? t.split('/').pop() : 'notebook').replace(/[^\w\u0900-\u097F-]+/g, '_'); GB.download(name + '.md', mdOf(t)); };
  GB.printNotes = function (t) {
    const w = window.open('', '_blank'); if (!w) { GB.ui.toast('Allow pop-ups to print'); return; }
    const esc = GB.esc; const items = notesFor(t).map(n => '<section><h2>' + esc((n.ref ? n.ref.label + ' · ' : '') + (GB.notes.TYPES[n.type] || 'Note') + (n.subject ? ': ' + n.subject : '')) + '</h2>' + (n.quote ? '<blockquote>' + esc(GB.ut(n.quote)) + '</blockquote>' : '') + (n.text ? '<p>' + esc(n.text).replace(/\n/g, '<br>') + '</p>' : '') + '</section>').join('');
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(t || 'Notebook') + '</title><style>body{font:16px/1.5 Georgia,"Noto Serif Devanagari",serif;max-width:720px;margin:40px auto;padding:0 24px;color:#222}h1{font-size:26px}h2{font-size:17px;margin:26px 0 6px;color:#1c6b58}blockquote{margin:6px 0;padding-left:12px;border-left:3px solid #c18b2f;color:#463a1b}</style><h1>' + esc(t ? t.split('/').join(' › ') : 'Notebook') + '</h1>' + items);
    w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300);
  };
  // ---------- S: Search (texts, words, go to verse) ----------
  // links rows: ASCII input matches the ASCII slugs ("k/karpanya", "gb://pro/k/karpanya" or "karpanya"), so diacritics do
  // not matter; other scripts match the word column. Plain ranges, so hosted files use their index (no LIKE scans).
  async function dictLinks(D, qs) {
    const n = lib.has(D, 'links', 'num_items') ? ', num_items AS n' : '', wc = lib.has(D, 'links', 'word') ? 'word' : 'link';
    let col, key;
    if (/^[\x20-\x7e]+$/.test(qs)) {
      const p = GB.foldKey(qs).replace(/[^a-z0-9-]/g, ''); if (!p) return [];
      if (D.linkPre === undefined) { const r = await lib.q(D, 'SELECT link FROM links WHERE link IS NOT NULL AND link <> \'\' LIMIT 1'); const m = String((r[0] && r[0].link) || '').match(/^(gb:\/\/pro\/)?([a-z0-9]\/)?/i); D.linkPre = { scheme: m[1] || '', dir: !!m[2] }; }
      col = 'link'; key = D.linkPre.scheme + (D.linkPre.dir ? p[0] + '/' : '') + p;
    } else { col = wc; key = qs.normalize('NFC'); }
    const rows = await lib.q(D, 'SELECT ' + wc + ' AS w, link' + n + ' FROM links WHERE ' + col + ' >= ? AND ' + col + ' < ? ORDER BY ' + col + ' LIMIT 120', [key, key + '\uffff']);
    return rows.map(r => ({ w: r.w, link: r.link, n: r.n }));
  }
  const S_SCOPE = [['all', 'Everywhere'], ['verses', 'Translations'], ['comments', 'Purports'], ['sanskrit', 'Sanskrit']];
  let sQ = '';
  async function renderSearch(body) {
    const inp = h('input.s-in', { type: 'search', value: sQ, placeholder: 'Words, a phrase, or a verse like 2.13 or SB 10.14.8', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', 'aria-label': 'Search' });
    const scope = GB.search.last.scope || 'all';
    const go = () => { const q = inp.value.trim(); if (!q) { inp.focus(); return; } GB.search.last.scope = HOME.sScope || scope; GB.search.run({ q, scope: HOME.sScope || scope, sort: GB.search.last.sort || 'none' }); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    body.append(h('div.s-box', null, h('div.s-row', null, ico('search'), inp, h('button.s-go', { type: 'button', onclick: go, 'aria-label': 'Search texts' }, 'Search')),
      h('div.s-scope', { role: 'group', 'aria-label': 'Where' }, S_SCOPE.map(([k, t]) => h('button.chip2' + ((HOME.sScope || scope) === k ? '.on' : ''), { type: 'button', onclick: () => { HOME.sScope = k; HOME.render(); } }, t)),
        h('button.s-opt', { type: 'button', onclick: () => GB.search.dialog({ q: inp.value.trim() }) }, 'More options'))));
    const jump = h('div.s-jump'), words = h('div.s-words'), hist = h('div.s-hist');
    body.append(GB.gotoBooks && GB.gotoBooks().length ? h('button.s-goto', { type: 'button', onclick: () => GB.gotoVerse({}) }, ico('goto'), h('span', null, h('b', { text: 'Go to verse' }), h('span', { text: 'BG · SB · CC' })), h('span.rp-arr', { text: '›' })) : '', jump, words, hist);
    const histList = await GB.store.kvGet('searchHistory', []);
    const run = GB.debounce(async () => {
      sQ = inp.value.trim(); jump.innerHTML = ''; words.innerHTML = ''; hist.innerHTML = '';
      if (!sQ) { if (histList.length) { hist.append(h('div.s-h', { text: 'Recent' })); histList.slice(0, 8).forEach(x => hist.append(h('button.s-recent', { type: 'button', onclick: () => { inp.value = x; run(); go(); } }, ico('history'), h('span', { text: x })))); } return; }
      const r = GB.parseRef(sQ) ? await GB.resolveRef(sQ) : null;
      if (r) { const rows = await lib.chapterTexts(r.B, r.ch); const row = rows[r.i];
        jump.append(h('button.s-ref', { type: 'button', onclick: () => GB.reader.open(r.B, r.ch, r.i, { noAsk: true }) }, h('span.s-ref-l', { text: lib.label(r.B, r.ch.song, r.ch.ch, row.no) }), h('span.s-ref-p', { text: GB.ut(row.preview || '').slice(0, 160) }), h('span.rp-arr', { text: '›' }))); }
      if (sQ.length < 2 || /^\d/.test(sQ)) return;
      const lang = curLang(); const seen = new Set(); const found = [];
      for (const D of lib.dbs.values()) {
        if (lang && D.lang !== lang) continue; let ws = [];
        if (lib.has(D, 'links', 'link')) { try { ws = await dictLinks(D, sQ); } catch (e) {} }
        if (!ws.length) { try { ws = (await GBDB.wbwSuggest(D.num, sQ, 60)).map(([w, n]) => ({ w, n })); } catch (e) {} }
        for (const x of ws) { const k = D.lang + '|' + String(x.w).toLowerCase(); if (seen.has(k)) continue; seen.add(k); found.push({ D, x }); }
      }
      if (inp.value.trim() !== sQ) return;
      if (found.length) { words.append(h('div.s-h', { text: 'Sanskrit words' }));
        const wrap = h('div.s-wlist'); found.slice(0, 40).forEach(({ D, x }) => wrap.append(h('button.wchip', { type: 'button', onclick: () => GB.word.open(D, x.link || '', GB.decEnt(x.w)) }, h('span', { text: GB.ut(GB.decEnt(x.w)) }), x.n ? h('b', { text: String(x.n) }) : null))); words.append(wrap); }
    }, 220);
    inp.addEventListener('input', run); run();
    setTimeout(() => { if (GB.isWide()) inp.focus(); }, 50);
  }

  // ---------- note editor (subject, text, folders, question switch) ----------
  GB.noteEdit = function (n, ctx) {
    n = Object.assign({ type: 'note', tags: [] }, n);
    const isNew = !n.id;
    const subj = h('input.ne-subject', { type: 'text', value: n.subject || '', placeholder: 'subject' });
    const txt = h('textarea.ne-text', { placeholder: n.type === 'quest' ? 'your question' : 'your note' }); txt.value = n.text || '';
    const isQ = h('input', { type: 'checkbox' }); isQ.checked = n.type === 'quest';
    const tags = (n.tags || []).slice(); const chips = h('div.ne-chips');
    // folders: pick from the tree or make a new one (stored as the note's topic tags, "a/b" = b inside a)
    const pick = h('select.ne-folder', { 'aria-label': 'Add to folder' });
    function drawPick() { pick.innerHTML = ''; pick.append(h('option', { value: '', text: tags.length ? '+ Add to another folder' : '+ Add to a folder' }));
      GB.notes.allTopics().filter(t => !tags.some(x => x.toLowerCase() === t.toLowerCase())).forEach(t => pick.append(h('option', { value: t, text: '\u2003'.repeat(t.split('/').length - 1) + t.split('/').pop() })));
      pick.append(h('option', { value: '__new', text: 'New folder…' })); }
    function drawChips() { chips.innerHTML = ''; tags.forEach((t, i) => chips.append(h('span.chip.fchip2', null, h('span.ico', { html: GB.icons.svg('folder') }), t.split('/').join(' › '), h('button.chip-x', { type: 'button', title: 'Remove from folder', onclick: () => { tags.splice(i, 1); drawChips(); drawPick(); } }, '×')))); }
    pick.addEventListener('change', async () => { let v = pick.value; if (v === '__new') { const n = await GB.ui.prompt('New folder', '', 'folder name'); v = n ? n.replace(/\//g, '-').trim() : ''; if (v) await GB.notes.addTopic(v); }
      if (v && !tags.some(t => t.toLowerCase() === v.toLowerCase())) tags.push(v); drawChips(); drawPick(); });
    const addTag = () => {}; const tagIn = pick, dl = null;
    drawChips(); drawPick();
    const showQ = n.type === 'note' || n.type === 'quest';
    const body = h('div.ne', null,
      n.ref ? h('div.ne-ref', null, h('span.nc-chip', { text: n.ref.label + ' »' }), n.quote ? h('div.nc-quote', { text: GB.ut(n.quote) }) : null) : null,
      showQ ? h('label.ne-q', null, isQ, h('span', { text: 'Mark as question' })) : null,
      subj, txt, h('div.ne-tags', null, chips, tagIn, dl));
    const buttons = [];
    if (!isNew) buttons.push({ label: 'Delete', onClick: () => { GB.ui.confirm('Delete', 'Delete this ' + (GB.notes.TYPES[n.type] || 'note').toLowerCase() + '?', 'Delete').then(async ok => { if (ok) { await GB.notes.remove(n.id); d.close(); afterSave(); } }); return false; } });
    if (n.ref) buttons.push({ label: 'Open text', onClick: () => { setTimeout(() => openNote(n), 10); } });
    buttons.push({ label: 'Cancel', value: null }, { label: 'OK', onClick: () => { save(); } });
    const d = GB.ui.dialog({ title: isNew ? (n.type === 'quest' ? 'Add Question' : n.type === 'note' ? 'Add Note' : 'Edit') : 'Edit ' + (GB.notes.TYPES[n.type] || 'note'), body, buttons, cls: 'noteedit' });
    async function save() {
      addTag();
      if (showQ) n.type = isQ.checked ? 'quest' : 'note';
      n.subject = subj.value.trim(); n.text = txt.value.trim(); n.tags = tags;
      await GB.notes.save(n); afterSave();
    }
    function afterSave() { refreshAll(); if (GB.reader && GB.reader.refreshNotes) GB.reader.refreshNotes(); if (ctx && ctx.onSave) ctx.onSave(n); }
    setTimeout(() => (n.ref && !n.text ? txt : subj).focus(), 40);
    return d;
  };
  GB.restoreUI = () => { const i = $('#fileRestore'); i.value = ''; i.click(); };
  GB.doRestore = async file => {
    let obj; try { obj = JSON.parse(await file.text()); } catch (e) { GB.ui.toast('This file is not a notes backup'); return; }
    if (!obj || !Array.isArray(obj.notes)) { GB.ui.toast('This file is not a notes backup'); return; }
    const mode = await GB.ui.dialog({ title: 'Restore notes', text: obj.notes.length + ' notes in ' + file.name + '. Merge them with your notes, or replace your notes with them?', buttons: [{ label: 'Cancel', value: null }, { label: 'Replace', value: 'replace' }, { label: 'Merge', value: 'merge' }] }).result;
    if (!mode) return;
    if (mode === 'replace') {
      const w = await GB.ui.prompt('Type replace to confirm: your current notes will be overwritten', '');
      if (w == null) return; if (String(w).trim().toLowerCase() !== 'replace') { GB.ui.toast('Not replaced: the word did not match'); return; }
    }
    const n = await GB.notes.restore(obj, mode === 'replace'); GB.ui.toast(n + ' notes restored'); refreshAll();
  };
})(window.GB);
