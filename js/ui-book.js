/* Vaishnava Texts: book screen (contents / pictures / cards / diagrams / frescos; canto picker for
   books with songs) and the chapter screen (list of texts). */
'use strict';
(function (GB) {
  const { h, img } = GB;
  const lib = GB.lib, L = GB.left;
  const PAGE_CHARS = 1780;
  const isDev = s => /[\u0900-\u097F]/.test(s || '');
  const devCls = s => (isDev(s) ? '.devui' : '');
  function noteIcons(list) {
    if (!GB.prefs.chNotesIcons || !list.length) return null;
    const c = GB.notes.counts(list); const box = h('div.nicons');
    const add = (k, icon) => { if (c[k]) box.append(h('span.ni', null, img(icon), h('b', { text: String(c[k]) }))); };
    add('highl', 'ic_notes_highl.png'); add('quote', 'ic_notes_highl.png'); add('fav', 'ic_notes_fav.png'); add('note', 'ic_notes_comment.png'); add('quest', 'ic_notes_qmark.png');
    return box.children.length ? box : null;
  }
  GB.noteIcons = noteIcons;

  // ---------- book screen ----------
  GB.book = {};
  GB.book.open = function (B, song) {
    const st = { tab: 'contents', song: song != null ? String(song) : null };
    const existing = L.top(); if (existing && existing.kind === 'book' && existing.B === B) { existing.st.song = st.song; existing.st.tab = 'contents'; existing.refresh(); return; }
    const pg = GB.page({ kind: 'book', title: B.author || B.title, subtitle: B.author ? B.title : '', cls: 'bookpage',
      actions: [GB.canGoto(B) ? GB.hbtn('goto', 'Go to verse', () => GB.gotoVerse({ B })) : null, GB.hbtn('search', 'Search in this book', () => GB.search.dialog({ book: B })), GB.hbtn('more', 'Menu', e => bookMenu(e.currentTarget, B, st, pg))].filter(Boolean) });
    pg.B = B; pg.st = st;
    const tabs = h('div.btabs'); pg.el.insertBefore(tabs, pg.body);
    pg.refresh = () => render(pg, B, st, tabs);
    render(pg, B, st, tabs); L.push(pg);
  };
  function bookMenu(anchor, B, st, pg) {
    const rd = GB.reading.get(B);
    GB.ui.menu(anchor, [
      rd ? { label: 'Continue reading', icon: 'ic_bookmark_open.png', onClick: () => GB.reader.openSaved(B, rd) } : null,
      GB.canGoto(B) ? { label: 'Go to verse', icon: 'goto', onClick: () => GB.gotoVerse({ B }) } : null,
      GB.offline && GB.offline.can(B) ? { label: GB.offline.has(B) ? 'Saved for offline ✓' : 'Save for offline', icon: 'download', onClick: () => GB.offline.download(B) } : null,
      rd ? { label: 'Clear bookmark', icon: 'ic_remove_bookmark.png', onClick: async () => { await GB.reading.remove(B.key); pg.refresh(); } } : null,
      { label: GB.parts.sanskritOn() ? 'Hide Sanskrit' : 'Show Sanskrit', icon: 'ic_menu_sanskrit.png', onClick: () => { GB.parts.toggleSanskrit(); GB.reader.rerender(); } },
      { label: GB.prefs.night ? 'Day theme' : 'Night theme', icon: GB.prefs.night ? 'ic_sun.png' : 'ic_menu_night.png', onClick: GB.toggleNight },
      { label: 'Random text', icon: 'ic_random_text_o.png', onClick: async () => { const ch = B.chapters[Math.floor(Math.random() * B.chapters.length)]; const rows = await lib.chapterTexts(B, ch); GB.reader.open(B, ch, Math.floor(Math.random() * rows.length)); } },
      { label: 'All notes in this book', icon: 'ic_menu_list.png', onClick: () => GB.bookNotes(B) },
      { label: 'Settings', icon: 'ic_mmenu_settings.png', onClick: () => GB.settingsPage() },
      { label: 'Larger text', icon: 'ic_action_inct.png', onClick: () => GB.fontStep(1) },
      { label: 'Smaller text', icon: 'ic_menu_dec_font.png', onClick: () => GB.fontStep(-1) }].filter(Boolean));
  }
  function render(pg, B, st, tabs) {
    tabs.innerHTML = '';
    const kinds = [];   // v2: the gitabases carry no pictures; picture tabs removed
    if (kinds.length) {
      const all = [['contents', 'contents']].concat(kinds.map(k => ['k' + k, lib.KIND_TABS[k] || 'pictures']));
      for (const [k, t] of all) tabs.append(h('button.btab' + (st.tab === k ? '.on' : ''), { text: t, onclick: () => { st.tab = k; render(pg, B, st, tabs); } }));
      tabs.hidden = false;
    } else tabs.hidden = true;
    pg.body.innerHTML = ''; pg.body.scrollTop = 0;
    if (st.tab === 'contents') contents(pg.body, B, st, pg); else pictures(pg.body, B, Number(st.tab.slice(1)), pg);
  }
  function contents(body, B, st, pg) {
    const rd = GB.reading.get(B);
    if (B.hasSongs && st.song == null) {
      for (const s of B.songs) {
        const chs = lib.songChapters(B, s.song); const notes = GB.notes.forBook(B).filter(n => n.ref.song === s.song);
        const si = GB.songInfo(B, s);
        body.append(h('div.song-row', { onclick: () => { st.song = s.song; pg.refresh(); } },
          si.sub ? h('div.song-sub', { text: si.sub }) : null,
          h('div.song-title' + devCls(s.name), { text: si.title }),
          h('div.song-meta', { text: (si.count || (chs.length + (chs.length === 1 ? ' chapter' : ' chapters'))) + (s.size ? ' · ' + Math.round(s.size / PAGE_CHARS) + ' pgs' : '') }),
          noteIcons(notes), rd && rd.song === s.song ? h('div.song-mark', null, h('span', { text: rd.label.split(' ').pop() }), img(GB.prefs.night ? 'bookmark_open_dark.png' : 'bookmark_open.png')) : null));
      }
      return;
    }
    if (B.hasSongs) {
      const s = B.songs.find(x => x.song === st.song) || {};
      body.append(h('div.allsongs', null, h('button.link-back', { onclick: () => { st.song = null; pg.refresh(); } }, GB.ico('back'), h('span', { text: GB.songInfo(B, st.song).all })),
        h('span.cur-song' + devCls(s.name), { text: GB.songInfo(B, st.song).title })));
    }
    const grid = h('div.chgrid' + (GB.prefs.chapters2col ? '.two' : ''));
    for (const ch of lib.songChapters(B, B.hasSongs ? st.song : null)) {
      const pgs = Math.max(1, Math.round(ch.size / PAGE_CHARS)); const cur = rd && rd.song === String(ch.song) && rd.ch === String(ch.ch);
      grid.append(h('div.chcard' + (cur ? '.cur' : '') + (Number(ch.ch) === 0 ? '.wide' : ''), { onclick: () => GB.chapter.open(B, ch, null, true) },
        h('div.ch-top', null, GB.numbered(B) ? h('span.ch-num', { text: 'Chapter ' + ch.ch }) : h('span.ch-num', { text: '' }), ch.size ? h('span.ch-pgs', { text: pgs + ' pgs' }) : null),
        h('div.ch-title' + devCls(ch.title), { text: GB.ut(ch.title || ('Chapter ' + ch.ch)) }),
        noteIcons(GB.notes.forChapter(B, ch)), cur ? img('ic_bookmark_icon_short.png', 'ch-mark') : null));
    }
    body.append(grid);
  }
  // ---------- picture tabs ----------
  async function pictures(body, B, kind, pg) {
    const P = GB.prefs;
    const bar = h('div.picbar', null, h('button.picset-btn', { onclick: () => panel.hidden = !panel.hidden }, GB.ico('gear'), h('span', { text: 'Display' })));
    const panel = h('div.picset', { hidden: true },
      h('label', null, cb('picChapters'), ' Chapters'), h('label', null, cb('picNumbers'), ' Text Numbers'),
      h('div.picset-row', null, h('span', { text: 'Columns:' }), [1, 2, 3, 4].map(n => h('label', null, radio('picCols', n), ' ' + n))),
      h('div.picset-row', null, h('span', { text: 'Open:' }), [['slide', 'slide'], ['text', 'text'], ['image', 'image']].map(([v, t]) => h('label', null, radio('picOpen', v), ' ' + t))));
    function cb(k) { const i = h('input', { type: 'checkbox' }); i.checked = !!P[k]; i.onchange = () => { GB.setPref(k, i.checked); pictures(clear(), B, kind, pg); }; return i; }
    function radio(k, v) { const i = h('input', { type: 'radio', name: k }); i.checked = P[k] == v; i.onchange = () => { GB.setPref(k, v); pictures(clear(), B, kind, pg); }; return i; }
    function clear() { body.innerHTML = ''; return body; }
    body.append(bar, panel);
    const loading = h('div.loading-row', { text: 'Loading…' }); body.append(loading);
    const items = await lib.images(B, kind); loading.remove();
    if (!items.length) { body.append(h('div.help-row', { text: 'No images.' })); return; }
    const io = new IntersectionObserver(ents => ents.forEach(async en => {
      if (!en.isIntersecting) return; io.unobserve(en.target); const it = items[en.target.dataset.i];
      const url = await lib.imageUrl(it.D, it.imageId); if (url) en.target.style.backgroundImage = 'url("' + url + '")'; else en.target.classList.add('broken');
    }), { root: body, rootMargin: '300px' });
    let grid = null, lastKey = null;
    items.forEach((it, i) => {
      const k = it.song + '|' + it.ch;
      if (P.picChapters && k !== lastKey) {
        const ch = lib.findChapter(B, it.song, it.ch);
        body.append(h('div.pic-sec', null, h('span.pic-sec-n', { text: (B.hasSongs ? it.song + '.' : '') + it.ch }), h('span' + devCls(ch && ch.title), { text: GB.ut(ch ? ch.title : '') })));
        grid = null; lastKey = k;
      }
      if (!grid) { grid = h('div.pic-grid', { style: { '--cols': P.picCols } }); body.append(grid); }
      const th = h('div.pic', { 'data-i': i, title: it.desc || '', onclick: () => openPic(B, items, i) }, P.picNumbers ? h('span.pic-no', { text: lib.label(B, it.song, it.ch, it.no).split(' ').pop() }) : null);
      grid.append(th); io.observe(th);
    });
  }
  async function openPic(B, items, i) {
    const it = items[i];
    if (GB.prefs.picOpen === 'text') { const ch = lib.findChapter(B, it.song, it.ch); if (!ch) return; const rows = await lib.chapterTexts(B, ch); const k = lib.findTextIndex(rows, it.no); if (k >= 0) GB.reader.open(B, ch, k); return; }
    GB.viewer.open(B, GB.prefs.picOpen === 'image' ? [it] : items, GB.prefs.picOpen === 'image' ? 0 : i);
  }
  GB.bookNotes = function (B) {
    const pg = GB.page({ kind: 'booknotes', title: 'All notes', subtitle: B.title });
    const fill = () => { pg.body.innerHTML = ''; const list = GB.notes.forBook(B).sort((a, b) => (a.ref.label < b.ref.label ? -1 : 1)); if (!list.length) pg.body.append(h('div.help-row', { text: 'No notes in this book yet.' })); list.forEach(n => pg.body.append(GB.noteCard(n))); };
    pg.refresh = fill; fill(); L.push(pg);
  };

  // ---------- chapter screen (texts list) ----------
  GB.chapter = {};
  GB.chapter.open = async function (B, ch, focusI, autoOpen) {
    const top = L.top(); if (top && top.kind === 'chapter') L.pop();
    const prog = h('div.rprog', null, h('i'));
    const under = h('div.under-wrap', null, GB.crumbs(B, ch, null, 'chapter'), prog);
    const pg = GB.page({ kind: 'chapter', title: B.title, subtitle: GB.numbered(B) ? lib.chapterLabel(B, ch) + ' ' + (ch.title || '') : (ch.title || ''), under,
      actions: [GB.canGoto(B) ? GB.hbtn('goto', 'Go to verse', () => GB.gotoVerse({ B, ch })) : null, GB.hbtn('search', 'Search in this book', () => GB.search.dialog({ book: B })), GB.hbtn('more', 'Menu', e => chapterMenu(e.currentTarget, B, ch))].filter(Boolean) });
    pg.B = B; pg.ch = ch;
    L.push(pg);
    { const w = document.createElement('div'); w.className = 'sk-wrap'; w.append(GB.skeletonRows(9), GB.loader('gb-loader-list')); pg.body.append(w); }
    const rows = await lib.chapterTexts(B, ch);
    const rd = GB.reading.get(B);
    prog.firstChild.style.width = Math.round(((rd && rd.progress) || 0) * 100) + '%';
    const fill = () => {
      pg.body.innerHTML = ''; const cur = GB.reader.current();
      rows.forEach((r, i) => {
        const isCur = cur && cur.B === B && cur.ch === ch && cur.i === i;
        const num = Number(ch.ch) === 0 ? r.no : (GB.prefs.chFullVerseNo ? lib.label(B, ch.song, ch.ch, r.no).split(' ').pop() : 'TEXT ' + r.no);
        const seq = '';
        pg.body.append(h('div.txrow' + (isCur ? '.cur' : ''), { 'data-i': i, onclick: () => GB.reader.open(B, ch, i) },
          h('div.tx-top', null, GB.numbered(B) ? h('span.tx-num', { text: num }) : null, noteIcons(GB.notes.forText(B, ch, r)), seq ? h('span.tx-seq', { text: seq }) : null),
          h('div.tx-prev' + devCls(r.preview), { text: GB.ut(r.preview) })));
      });
      if (!rows.length) pg.body.append(h('div.help-row', { text: 'This chapter has no texts.' }));
      const c = pg.body.querySelector('.txrow.cur'); if (c) c.scrollIntoView({ block: 'center' });
    };
    pg.refresh = fill; fill();
    if (focusI != null) { const e = pg.body.querySelector('[data-i="' + focusI + '"]'); if (e) e.scrollIntoView({ block: 'center' }); }
    if (autoOpen && GB.isWide() && rows.length) {
      const i = rd && rd.song === String(ch.song) && rd.ch === String(ch.ch) ? Math.max(0, lib.findTextIndex(rows, rd.no)) : 0;
      GB.reader.open(B, ch, i);
    }
  };
  GB.chapter.markCurrent = function () {
    const pg = L.find('chapter'); if (!pg) return; const cur = GB.reader.current();
    pg.body.querySelectorAll('.txrow').forEach(r => r.classList.toggle('cur', !!cur && cur.B === pg.B && cur.ch === pg.ch && Number(r.dataset.i) === cur.i));
    const c = pg.body.querySelector('.txrow.cur'); if (c) { const b = pg.body.getBoundingClientRect(), r = c.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) c.scrollIntoView({ block: 'center' }); }
  };
  function chapterMenu(anchor, B, ch) {
    GB.ui.menu(anchor, [
      { label: 'Search', icon: 'ic_action_search.png', onClick: () => GB.search.dialog({ book: B }) },
      { label: 'History', icon: 'ic_screen_manager.png', onClick: () => GB.historyPage() },
      { label: 'Go to bookmark', icon: 'ic_bookmark_open.png', onClick: () => { const rd = GB.reading.get(B); if (rd) GB.reader.openSaved(B, rd); else GB.ui.toast('No bookmark in this book yet'); } },
      { label: 'Library', icon: 'ic_menu_books.png', onClick: () => L.home('L') },
      GB.canGoto(B) ? { label: 'Go to verse', icon: 'goto', onClick: () => GB.gotoVerse({ B, ch }) } : null,
      { label: GB.parts.sanskritOn() ? 'Hide Sanskrit' : 'Show Sanskrit', icon: 'ic_menu_sanskrit.png', onClick: () => { GB.parts.toggleSanskrit(); GB.reader.rerender(); } },
      { label: GB.prefs.night ? 'Day theme' : 'Night theme', icon: GB.prefs.night ? 'ic_sun.png' : 'ic_menu_night.png', onClick: GB.toggleNight },
      { label: 'All notes in this book', icon: 'ic_menu_list.png', onClick: () => GB.bookNotes(B) },
      { label: 'Settings', icon: 'ic_mmenu_settings.png', onClick: () => GB.settingsPage() },
      { label: 'Larger text', icon: 'ic_action_inct.png', onClick: () => GB.fontStep(1) },
      { label: 'Smaller text', icon: 'ic_menu_dec_font.png', onClick: () => GB.fontStep(-1) }].filter(Boolean));
  }
})(window.GB);
