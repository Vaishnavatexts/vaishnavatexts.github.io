/* Vaishnava Texts: search (dialog + results), references, word occurrences, compare / translate,
   image viewer, settings, browsing history, about. */
'use strict';
(function (GB) {
  const { h, $, img } = GB;
  const lib = GB.lib, L = GB.left;
  const devCls = s => (/[\u0900-\u097F]/.test(s || '') ? '.devui' : '');
  // ================= search =================
  const S = GB.search = { last: { exact: false, sort: 'none', scope: 'all', where: 'book' } };
  S.dialog = async function (ctx) {
    ctx = ctx || {}; const st = S.last; const hist = await GB.store.kvGet('searchHistory', []);
    const inp = h('input.sd-in', { type: 'search', placeholder: 'Word or phrase', list: 'gbSearchHist', autocomplete: 'off', spellcheck: 'false' }); inp.value = ctx.q || st.q || '';
    const dl = h('datalist#gbSearchHist', null, hist.map(q => h('option', { value: q })));
    const exact = h('input', { type: 'checkbox' }); exact.checked = !!st.exact;
    const useIdx = h('input', { type: 'checkbox' }); useIdx.checked = GB.prefs.useIndex;
    const radios = (name, opts, val) => h('div.sd-radios', null, opts.map(([v, t]) => { const r = h('input', { type: 'radio', name, value: v }); r.checked = v === val; return h('label', null, r, h('span', { text: t })); }));
    const sort = radios('sdsort', [['none', 'In book order'], ['count', 'Most matches first'], ['dist', 'Closest words first']], st.sort);
    const scope = radios('sdscope', [['all', 'Everywhere'], ['verses', 'Translations'], ['comments', 'Purports'], ['sanskrit', 'Sanskrit']], st.scope);
    const where = ctx.book ? radios('sdwhere', [['book', 'This book'], ['all', 'All books']], st.where) : null;
    const go = () => { const q = inp.value.trim(); if (!q) { inp.focus(); return; } const v = n => (d.el.querySelector('input[name=' + n + ']:checked') || {}).value;
      Object.assign(S.last, { q, exact: exact.checked, sort: v('sdsort'), scope: v('sdscope'), where: where ? v('sdwhere') : S.last.where }); GB.setPref('useIndex', useIdx.checked);
      d.close(); S.run({ q, book: ctx.book && (!where || v('sdwhere') === 'book') ? ctx.book : null, exact: exact.checked, sort: v('sdsort'), scope: v('sdscope') }); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const body = h('div.sd', null, h('div.sd-hint', { text: 'Add * for word forms, for example adhikar*' }), h('label.sd-cb', null, exact, h('span', { text: 'Exact phrase' })),
      h('div.sd-row', null, inp, dl, h('button.sd-go', { title: 'Search', onclick: go }, img('ic_go4seach.png'))),
      h('div.sd-cols', null, sort, scope), where, h('label.sd-cb', null, useIdx, h('span', { text: 'Use search index (fast; off = slow scan that also finds parts of words)' })),
      ctx.book ? h('div.sd-book', { text: GB.ut(ctx.book.title) }) : null);
    const d = GB.ui.dialog({ title: 'Search', body, cls: 'searchdlg', buttons: [{ label: 'Cancel', value: null }, { label: 'Search', onClick: () => { go(); return false; } }] });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  };
  const COLS = { all: [5, 6, 7], verses: [6], comments: [7], sanskrit: [5] };
  const PLACE = { 5: 'synonyms', 6: 'translation', 7: 'purport' };
  S.run = async function (o) {
    o = Object.assign({ sort: 'none', scope: 'all' }, o);
    const hist = await GB.store.kvGet('searchHistory', []); await GB.store.kvSet('searchHistory', [o.q].concat(hist.filter(x => x !== o.q)).slice(0, 30));
    const needles = o.exact ? [o.q.replace(/"/g, '')] : GBFTS.needles(o.q);
    const count = h('span.sr-count', { text: '…' });
    const pg = GB.page({ kind: 'search', title: 'Search results', subtitle: o.q + (o.book ? '  ·  ' + o.book.title : ''), cls: 'searchpage',
      actions: [count, GB.hbtn('search', 'New search', () => S.dialog({ book: o.book, q: o.q }))] });
    const top = L.top(); if (top && top.kind === 'search') L.replaceTop(pg); else L.push(pg);
    const list = h('div.sr-list'); pg.body.append(list);
    const status = h('div.loading-row', { text: 'Searching…' }); pg.body.append(status);
    const results = [];
    try {
      const parts = []; for (const B of (o.book ? [o.book] : lib.books)) for (const p of B.parts) parts.push({ B, p });
      const byD = new Map(); for (const x of parts) { if (!byD.has(x.p.D)) byD.set(x.p.D, []); byD.get(x.p.D).push(x); }
      for (const [D, xs] of byD) {
        const useFts = GB.prefs.useIndex && D.hasFts;
        if (useFts) {
          let ast = GBFTS.parse(o.q, { entityMode: D.entityMode, exact: o.exact }); if (!ast) continue; const userAst = ast;
          if (o.book) ast = { t: 'and', kids: [ast, { t: 'or', kids: xs.map(x => ({ t: 'term', tokens: [String(x.p.bookId)], cols: [1] })) }] };
          const r = await GBDB.fts(D.num, ast, COLS[o.scope], o.sort === 'dist' ? userAst : null) || [];
          for (const [docid, hits, pc, dist] of r) results.push({ D, docid, hits, pc, dist });
        } else {
          const words = o.exact ? [o.q.replace(/"/g, '')] : needles; if (!words.length) continue;
          const colsSql = { all: ['transl2', 'comment', 'transl1', 'translit'], verses: ['transl2'], comments: ['comment'], sanskrit: ['transl1', 'translit'] }[o.scope];
          const conds = words.map(() => '(' + colsSql.map(c => 'x.' + c + ' LIKE ?').join(' OR ') + ')').join(' AND ');
          const bind = []; words.forEach(w => colsSql.forEach(() => bind.push('%' + w + '%')));
          let bsql = ''; if (o.book) { bsql = ' AND n.book_id IN (' + xs.map(() => '?').join(',') + ')'; xs.forEach(x => bind.push(x.p.bookId)); }
          status.textContent = 'Scanning ' + D.name + '…';
          const rows = await lib.q(D, 'SELECT n._id AS id, n.book_id AS b, n.song AS s, n.ch_no AS c, n.txt_no AS t FROM textnums n JOIN texts x ON x._id = n._id WHERE ' + conds + bsql + ' ORDER BY n._id LIMIT 3000', bind);
          for (const r of rows) results.push({ D, textId: r.id, b: r.b, s: r.s, c: r.c, t: r.t, hits: 1, pc: {} });
        }
      }
    } catch (e) { console.error(e); status.textContent = GB.errMsg(e, 'Search failed'); return; }
    const dv = r => (r.dist == null ? 1e9 : r.dist);
    if (o.sort === 'count') results.sort((a, b) => b.hits - a.hits);
    else if (o.sort === 'dist') results.sort((a, b) => (dv(a) - dv(b)) || (b.hits - a.hits));
    count.textContent = String(results.length); status.remove();
    if (!results.length) { list.append(h('div.help-row', { text: 'Nothing found. Try fewer words, add * for word variants, or switch the search index off to find parts of words.' })); return; }
    let shown = 0;
    const more = h('button.btn.more', { text: 'Show more', onclick: () => page() });
    async function page() {
      more.remove(); const chunk = results.slice(shown, shown + 40); shown += chunk.length;
      const byD = new Map(); chunk.forEach(r => { if (!byD.has(r.D)) byD.set(r.D, []); byD.get(r.D).push(r); });
      for (const [D, rs] of byD) {
        const fts = rs.filter(r => r.docid != null), plain = rs.filter(r => r.docid == null);
        if (fts.length) { const rows = await lib.q(D, 'SELECT docid, c1book_id AS b, c2song AS s, c3ch_no AS c, c4txt_no AS t, c5translit AS c5, c6transl2 AS c6, c7comment AS c7 FROM textindex_content WHERE docid IN (' + fts.map(() => '?').join(',') + ')', fts.map(r => r.docid));
          const m = new Map(rows.map(x => [x.docid, x])); fts.forEach(r => { const x = m.get(r.docid); if (x) Object.assign(r, { b: x.b, s: x.s, c: x.c, t: x.t, txt: { 5: x.c5, 6: x.c6, 7: x.c7 } }); }); }
        if (plain.length) { const rows = await lib.q(D, 'SELECT _id, transl1 AS c5, transl2 AS c6, comment AS c7 FROM texts WHERE _id IN (' + plain.map(() => '?').join(',') + ')', plain.map(r => r.textId));
          const m = new Map(rows.map(x => [x._id, x])); plain.forEach(r => { const x = m.get(r.textId); if (x) r.txt = { 5: x.c5, 6: x.c6, 7: x.c7 }; }); }
      }
      for (const r of chunk) list.append(resultRow(r, needles, o));
      if (shown < results.length) list.append(more);
    }
    page();
  };
  function resultRow(r, needles, o) {
    const bk = r.D.books.find(b => b._id == r.b); const B = bk ? lib.books.find(x => x.parts.some(p => p.D === r.D && p.bookId == bk._id)) : null;
    if (!B) return h('div.sr-row.dim', { text: 'Text from a book that is not in your library' });
    const ch = lib.findChapter(B, r.s, r.c);
    let place = Object.keys(r.pc || {}).sort().map(k => PLACE[k]).filter(Boolean)[0];
    let col = place === 'purport' ? 7 : place === 'synonyms' ? 5 : 6;
    let text = r.txt ? GB.stripTags(r.txt[col] || '') : '';
    if (!place && r.txt) { for (const c of [6, 7, 5]) { const t = GB.stripTags(r.txt[c] || ''); if (needles.some(n => GB.fold(t).includes(GB.fold(n)))) { text = t; place = PLACE[c]; break; } } if (!text) text = GB.stripTags(r.txt[6] || r.txt[7] || ''); }
    const label = lib.label(B, r.s, r.c, r.t);
    return h('div.sr-row' + (ch ? '' : '.dim'), { onclick: ch ? async () => { const rows = await lib.chapterTexts(B, ch); const i = lib.findTextIndex(rows, r.t); if (i >= 0) GB.reader.open(B, ch, i, { needles, noAsk: true }); } : null },
      h('div.sr-top', null, h('span.sr-title', { text: label }), r.hits > 1 ? h('span.sr-seq', { text: '×' + r.hits }) : null),
      h('div.sr-sub' + devCls(ch && ch.title), { text: GB.ut(ch ? ch.title : '') }),
      place ? h('div.sr-place', { text: place }) : null,
      h('div.sr-entry' + devCls(text), { html: GB.render.snippet(GB.ut(text), needles) }));
  }
  // ================= references =================
  GB.refsSheet = async function (cur) {
    const box = h('div', null, h('div.loading-row', { text: 'Loading…' }));
    const s = GB.ui.sheet({ title: 'References · ' + lib.label(cur.B, cur.ch.song, cur.ch.ch, cur.row.no), content: box });
    const list = await lib.refs(cur.B, cur.ch, cur.row); box.innerHTML = '';
    if (!list.length) { box.append(h('div.help-row', { text: 'No references to this text.' })); return; }
    for (const r of list) {
      const row = h('div.ref-row.dim', null, h('div.ref-num', { text: (r.abbr ? r.abbr + ' ' : '') + r.nums.join('.') }), r.text ? h('div.ref-text' + devCls(r.text), { text: GB.ut(GB.stripTags(r.text)) }) : null, r.chapterName ? h('div.ref-ch', { text: GB.ut(r.chapterName) }) : null);
      box.append(row);
      (async () => {   // fail closed: only rows that resolve to a loaded book become clickable
        let target = null;
        if (r.refId && r.D) target = await lib.locate(r.D, r.refId);
        if (!target && r.abbr && r.nums.length) target = await lib.resolve(r.abbr, r.nums, cur.B.lang);
        if (target) { row.classList.remove('dim'); row.append(h('span.ref-go', { text: '»' })); row.onclick = () => { s.close(); const sc = Number(r.scroll); GB.reader.open(target.B, target.ch, target.i, sc > 0 && sc < 100 && !r.refId ? { noAsk: true, scroll: sc / 100 } : { noAsk: true }); }; }
      })();
    }
  };
  // ================= word occurrences =================
  GB.word = {};
  GB.word.open = async function (D, link, word) {
    const box = h('div.word-box'); const cnt = h('span.word-n', { text: '' });
    const s = GB.ui.sheet({ title: h('span', null, h('span.word-w', { text: GB.ut(GB.decEnt(word || link)) }), ' ', cnt), content: box });
    let offset = 0, total = 0; const more = h('button.btn.more', { text: 'Show more', onclick: () => load() });
    async function load() {
      more.remove(); const busy = h('div.loading-row', { text: 'Loading…' }); box.append(busy);
      let r; try { r = await lib.wordInfo(D, link, word, offset, 40); } catch (e) { busy.textContent = GB.errMsg(e); return; }
      busy.remove(); total = r.total; cnt.textContent = total + ' occurrence' + (total === 1 ? '' : 's');
      if (!total) { box.append(h('div.help-row', { text: 'This word is not in the dictionary tables or word-by-word translations of this book file.' })); return; }
      for (const x of r.rows) {
        const row = h('div.wo-row.dim', null, h('div.wo-ref', { text: x.name || '…' }), h('div.wo-w' + devCls(x.word), { text: GB.ut(GB.decEnt(x.word || '')) }), h('div.wo-m' + devCls(x.meaning), { text: GB.ut(x.meaning || '') }));
        box.append(row);
        lib.locateOcc(D, x).then(t => { if (!t) return; row.querySelector('.wo-ref').textContent = lib.label(t.B, t.ch.song, t.ch.ch, t.row.no); row.classList.remove('dim'); row.onclick = () => { s.close(); GB.reader.open(t.B, t.ch, t.i, { noAsk: true, needles: [x.word || word] }); }; }).catch(() => {});
      }
      offset += r.rows.length; if (offset < total) box.append(more);
    }
    load();
  };
  // ================= compare / translate =================
  const CMP = GB.compare = {};
  CMP.candidates = async function (cur, mode) {
    const out = [];
    for (const B2 of GB.reader.sameWork(cur.B)) {
      if (mode === 'translate' && B2.lang === cur.B.lang) continue;
      const ch2 = lib.findChapter(B2, cur.ch.song, cur.ch.ch); if (!ch2) continue;
      const rows2 = await lib.chapterTexts(B2, ch2); const i2 = lib.findTextIndex(rows2, cur.row.no); if (i2 < 0) continue;
      out.push({ B: B2, ch: ch2, i: i2, row: rows2[i2] });
    }
    return out;
  };
  CMP.selector = async function (cur, mode) {
    const box = h('div.cmp-sel', null, h('div.loading-row', { text: 'Looking for matching texts…' }));
    const s = GB.ui.sheet({ title: mode === 'translate' ? 'Translate' : 'Compare', content: box, cls: 'cmpsheet' });
    const list = await CMP.candidates(cur, mode); box.innerHTML = '';
    if (!list.length) { box.append(h('div.help-row', { text: mode === 'translate' ? 'No translation of this text in another language is in your library.' : 'No other edition or translation of this text is in your library.' })); return; }
    for (const c of list) {
      box.append(h('div.cs-row', null, h('div.cs-main', null, h('div.cs-code', { text: lib.label(c.B, c.ch.song, c.ch.ch, c.row.no) + ' · ' + (lib.LANG_NAMES[c.B.lang] || c.B.lang) }), h('div.cs-sub' + devCls(c.B.title), { text: GB.ut(c.B.title + ' — ' + (c.row.preview || '').slice(0, 90)) })),
        h('button.cs-btn', { text: '1', title: 'Open full screen', onclick: () => { s.close(); GB.reader.open(c.B, c.ch, c.i, { noAsk: true }); } }),
        h('button.cs-btn', { text: '2', title: 'Open side by side', onclick: () => { s.close(); CMP.split({ B: cur.B, ch: cur.ch, i: cur.i }, c); } })));
    }
  };
  CMP.split = async function (a, b) {
    const old = $('.cmp'); if (old) old.remove();
    let sync = true, skt = true; const panes = [a, b];
    const title = h('span.cmp-title', { text: 'Compare' });
    const bar = h('div.cmp-bar', null, h('button.cmp-b', { title: 'Close', onclick: close }, GB.ico('close')), title,
      h('button.cmp-b', { title: 'Previous text', onclick: () => step(-1) }, GB.ico('back')), h('button.cmp-b', { title: 'Next text', onclick: () => step(1) }, GB.ico('fwd')),
      h('button.cmp-b', { title: 'Swap', onclick: () => { panes.reverse(); draw(); } }, img('ic_compare_swap.svg')),
      h('button.cmp-b.on', { title: 'Sanskrit', onclick: e => { skt = !skt; e.currentTarget.classList.toggle('on', skt); wrap.classList.toggle('noskt', !skt); } }, img('ic_compare_sanskrit.png')),
      h('button.cmp-b.on', { title: 'Scroll sync', onclick: e => { sync = !sync; e.currentTarget.classList.toggle('on', sync); GB.ui.toast(sync ? 'Scroll sync on' : 'Scroll sync off'); } }, img('ic_compare_scroll_sync.svg')),
      h('button.cmp-b', { title: 'Full screen', onclick: e => { wrap.classList.toggle('full'); } }, GB.ico('expand')));
    const pA = h('div.cmp-pane'), pB = h('div.cmp-pane'); const wrap = h('div.cmp', null, bar, h('div.cmp-body', null, pA, pB));
    $('#reader').append(wrap); GB.ui.pushEsc(close);
    function close() { wrap.remove(); GB.ui.popEsc(close); }
    let lock = false;
    const onScroll = (src, dst) => () => { if (!sync || lock) return; lock = true; const r = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight); dst.scrollTop = r * (dst.scrollHeight - dst.clientHeight); requestAnimationFrame(() => { lock = false; }); };
    pA.onscroll = onScroll(pA, pB); pB.onscroll = onScroll(pB, pA);
    async function paint(pane, pos) {
      const rows = await lib.chapterTexts(pos.B, pos.ch); const row = rows[pos.i]; const t = await lib.text(pos.ch.part.D, row.id);
      pane.innerHTML = ''; pane.append(h('div.cmp-label', { text: lib.label(pos.B, pos.ch.song, pos.ch.ch, row.no) + ' · ' + GB.ut(pos.B.title) }), GB.render.verse(t, { B: pos.B, ch: pos.ch, row, notes: GB.notes.forText(pos.B, pos.ch, row) }));
    }
    async function draw() { await Promise.all([paint(pA, panes[0]), paint(pB, panes[1])]); }
    async function step(d) {
      const n0 = await lib.neighbour(panes[0].B, panes[0].ch, panes[0].i, d); if (!n0) return;
      const rows = await lib.chapterTexts(n0.ch.book || panes[0].B, n0.ch); const row = rows[n0.i];
      const ch1 = lib.findChapter(panes[1].B, n0.ch.song, n0.ch.ch); let i1 = -1, rows1 = [];
      if (ch1) { rows1 = await lib.chapterTexts(panes[1].B, ch1); i1 = lib.findTextIndex(rows1, row.no); }
      panes[0] = { B: panes[0].B, ch: n0.ch, i: n0.i }; if (i1 >= 0) panes[1] = { B: panes[1].B, ch: ch1, i: i1 };
      draw(); pA.scrollTop = 0; pB.scrollTop = 0;
    }
    draw();
  };
  // ================= image viewer =================
  GB.viewer = {};
  GB.viewer.open = function (B, items, i) {
    const im = h('img.vw-img', { alt: '' }); const cap = h('div.vw-cap');
    const wrap = h('div.viewer', null, im, cap,
      h('button.vw-b.vw-x', { title: 'Close', onclick: close }, GB.ico('close')),
      items.length > 1 ? h('button.vw-b.vw-p', { title: 'Previous', onclick: () => show(i - 1) }, GB.ico('back')) : null,
      items.length > 1 ? h('button.vw-b.vw-n', { title: 'Next', onclick: () => show(i + 1) }, GB.ico('fwd')) : null,
      h('button.vw-b.vw-t', { title: 'Open text', onclick: async () => { const it = items[i]; const ch = lib.findChapter(B, it.song, it.ch); if (!ch) return; const rows = await lib.chapterTexts(B, ch); const k = lib.findTextIndex(rows, it.no); if (k >= 0) { close(); GB.reader.open(B, ch, k, { noAsk: true }); } } }, h('span', { text: 'Open text' })));
    im.onclick = () => wrap.classList.toggle('zoom');
    $('#overlays').append(wrap); GB.ui.pushEsc(close);
    const key = e => { if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); };
    document.addEventListener('keydown', key);
    function close() { wrap.remove(); GB.ui.popEsc(close); document.removeEventListener('keydown', key); }
    async function show(k) { if (k < 0 || k >= items.length) return; i = k; const it = items[i]; im.src = ''; im.src = (await lib.imageUrl(it.D, it.imageId)) || ''; const ch = lib.findChapter(B, it.song, it.ch); cap.textContent = lib.label(B, it.song, it.ch, it.no) + (ch ? ' · ' + GB.ut(ch.title) : '') + (it.desc ? ' — ' + it.desc : '') + '   (' + (i + 1) + '/' + items.length + ')'; }
    show(i);
  };
  // ================= settings =================
  const SET = [
    ['Appearance'],
    ['night', 'Night theme', 'bool', ''],
    ['accent', 'Accent', 'accent', ''],
    ['layout', 'Screen layout', [['auto', 'Automatic (by window width)'], ['desktop', 'Side by side: tabs, list and text'], ['mobile', 'One screen at a time, tabs at the bottom']], 'Works on any screen size'],
    ['fontSize', 'Text size', 'num', 'In pixels', 10, 40],
    ['textAlign', 'Alignment', [['left', 'Left'], ['justify', 'Justified'], ['center', 'Centred']], 'Devanagari is never justified'],
    ['Reading'],
    ['readMode', 'Reading mode', [['verse', 'Verse by verse'], ['cont', 'Continuous (verses and chapters run on)']], 'Books of verses. Small books always turn pages'],
    ['!parts', 'What to show', 'act', 'Sanskrit, transliteration, word for word, translation, purport: Aa in the reader, per mode'],
    ['second', 'Second language', 'bool', 'The same verse from another language edition in your library'],
    ['secondLayout', 'Second language layout', [['stack', 'Stacked'], ['side', 'Side by side (wide screens)']], 'Phones always stack'],
    ['wbwStyle', 'Word-for-word style', [['table', 'Table'], ['classic', 'Running text']], 'How the word-for-word meanings are laid out'],
    ['hideDevanagari', 'Hide Devanagari', 'bool', 'Keep only the transliteration of the verse'],
    ['doubleProgress', 'Two progress bars', 'bool', 'Chapter and book progress under the title bar. Off = book only'],
    ['keepAwake', 'Keep the screen on', 'bool', 'The screen does not dim or lock while a text is open'],
    ['hideStatusBar', 'Full screen while reading', 'bool', 'Hides the system bars on phones and tablets'],
    ['openHistoryOnLaunch', 'Open history on start', 'bool', 'Show your recent texts when the app opens'],
    ['Chapter list'],
    ['chNotesIcons', 'Note markers', 'bool', 'Small icons for favourites, highlights, notes and questions'],
    ['chFullVerseNo', 'Full verse numbers', 'bool', 'Include the chapter number'],
    ['chapters2col', 'Chapters in two columns', 'bool', ''],
    ['Reading time'],
    ['readHours', 'Hours you read in three days', 'num', 'Used for the time-left estimate', 1, 72],
    ['readSpeed', 'Reading speed', 'num', 'Hundreds of characters per minute', 1, 60],
    ['Advanced'],
    ['!order', 'Verse order', 'act', 'Reorder the parts of a verse and switch each one on or off'],
    ['fontStep', 'Text size step', [[0.5, '0.5'], [1, '1'], [1.5, '1.5'], [2, '2']], 'How much Larger text and Smaller text change the size'],
    ['diacritics', 'Diacritics font', 'bool', 'Gaura Times with full diacritics. Off = plain font'],
    ['matchScript', 'Script-aware type', 'bool', 'Hindi prose in Tiro Devanagari Hindi, Sanskrit verse in Tiro Devanagari Sanskrit, real bold weights and roomier Devanagari spacing'],
    ['useIndex', 'Use the search index', 'bool', 'Fast full-text search with the index inside the book file. Off = slower scan that also finds parts of words'],
    ['Notes and files'],
    ['!backup', 'Back up notes', 'act', 'Save notes, folders, reading list and history as a .json file'],
    ['!restore', 'Restore notes', 'act', 'Merge or replace notes from a .json backup'],
    ['!library', 'Book files', 'act', 'Add or remove book files'],
    ['!about', 'About', 'act', '']];
  GB.settingsPage = function () {
    const ex = L.find('settings'); if (ex) { while (L.top() !== ex) L.pop(); return; }
    const pg = GB.page({ kind: 'settings', title: 'Settings', cls: 'settingspage' });
    const fill = () => {
      pg.body.innerHTML = '';
      for (const it of SET) {
        if (it.length === 1) { pg.body.append(h('div.pref-cat', { text: it[0] })); continue; }
        const [k, title, type, sum, min, max] = it; if (k === '!library' && lib.hosted) continue;
        const P = GB.prefs; let ctl = null, val = null, onclick = null;
        if (type === 'bool') { ctl = h('span.sw' + (P[k] ? '.on' : '')); onclick = () => change(k, !P[k]); }
        else if (type === 'num') { ctl = h('span.num', null, h('button.num-b', { text: '−', onclick: e => { e.stopPropagation(); change(k, Math.max(min, +P[k] - 1)); } }), h('b', { text: String(P[k]) }), h('button.num-b', { text: '+', onclick: e => { e.stopPropagation(); change(k, Math.min(max, +P[k] + 1)); } })); }
        else if (type === 'act') { onclick = () => ({ '!backup': () => GB.notes.backup(), '!restore': () => GB.restoreUI(), '!library': () => { GB.home.sub = 'mine'; L.home('L'); }, '!about': GB.about, '!order': () => GB.verseOrderPage(), '!parts': () => GB.readPanel() })[k](); }
        else if (type === 'accent') { const A = GB.ACCENTS[P.accent] || GB.ACCENTS.tulasi; val = A.name; ctl = h('span.adot.on.mini', { style: { '--c': A.day, '--cn': A.night } }); onclick = () => choose(k, title, Object.values(GB.ACCENTS).map(x => [x.key, x.name])); }
        else { const cur = type.find(o => o[0] == P[k]); val = cur ? cur[1] : String(P[k]); onclick = () => choose(k, title, type); }
        pg.body.append(h('div.pref' + (onclick ? '.click' : ''), { onclick }, h('div.pref-main', null, h('div.pref-t', { text: title }), sum ? h('div.pref-s', { text: sum }) : null, val ? h('div.pref-v', { text: val }) : null), ctl));
      }
    };
    function change(k, v) { GB.setPref(k, v); GB.applyPrefs(); if (k === 'readMode') GB.reader.setMode(v); else if (['night', 'accent', 'second', 'secondLayout', 'wbwStyle', 'hideDevanagari', 'matchScript', 'doubleProgress', 'diacritics'].includes(k)) GB.reader.rerender(); if (k === 'accent') { GB.home.render(); GB.refreshAll(); } if (k === 'night') GB.home.render(); if (k === 'layout') { if (GB.isWide()) document.body.classList.remove('reading'); GB.home.render(); window.dispatchEvent(new Event('resize')); } fill(); }
    function choose(k, title, opts) {
      const body = h('div.choose', null, opts.map(([v, t]) => { const r = h('input', { type: 'radio', name: 'ch' + k }); r.checked = GB.prefs[k] == v; return h('label.choose-row', { onclick: () => { d.close(); change(k, v); } }, r, h('span', { text: t })); }));
      const d = GB.ui.dialog({ title, body, buttons: [{ label: 'Cancel', value: null }] });
    }
    pg.refresh = fill; fill(); L.push(pg);
  };
  GB.applyPrefs = function () {
    const P = GB.prefs, b = document.body;
    b.classList.toggle('night', !!P.night); b.classList.toggle('simplefont', !P.diacritics); b.dataset.align = P.textAlign;
    document.documentElement.style.setProperty('--fs', P.fontSize + 'px');
    document.documentElement.style.setProperty('--nfs', Math.max(12, Math.round(P.fontSize * 0.86)) + 'px');
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = P.night ? '#111a1d' : '#22423a';
    const H = document.documentElement; H.classList.toggle('lay-m', P.layout === 'mobile'); H.classList.toggle('lay-d', P.layout === 'desktop');
    if (GB.screen) GB.screen.pref();
  };
  GB.toggleNight = function () { GB.setPref('night', !GB.prefs.night); GB.applyPrefs(); GB.reader.rerender(); GB.refreshAll(); };
  GB.fontStep = function (d) { const P = GB.prefs; GB.setPref('fontSize', Math.max(10, Math.min(40, Math.round((P.fontSize + d * P.fontStep) * 2) / 2))); GB.applyPrefs(); GB.ui.toast('Font size ' + GB.prefs.fontSize); };
  // ================= browsing history =================
  GB.historyPage = function () {
    const ex = L.find('history'); if (ex) { while (L.top() !== ex) L.pop(); ex.refresh(); return; }
    const pg = GB.page({ kind: 'history', title: 'History', actions: [GB.hbtn('trash', 'Clear', async () => { if (await GB.ui.confirm('History', 'Clear the browsing history?')) { await GB.history.clear(); fill(); } })] });
    const fill = () => {
      pg.body.innerHTML = '';
      if (!GB.history.list.length) pg.body.append(h('div.help-row', { text: 'Texts you open will be listed here.' }));
      for (const e of GB.history.list.slice(0, 200)) {
        const B = lib.book(e.book);
        pg.body.append(h('div.hs-row' + (B ? '' : '.dim'), { onclick: B ? async () => { const ch = lib.findChapter(B, e.song, e.ch); if (!ch) return; const rows = await lib.chapterTexts(B, ch); const i = lib.findTextIndex(rows, e.no); if (i >= 0) GB.reader.open(B, ch, i, { noAsk: true }); } : null },
          h('div.hs-top', null, h('span.hs-label', { text: e.label }), h('span.hs-time', { text: GB.fmtDate(e.ts) })),
          h('div.hs-sub' + devCls(e.chTitle), { text: GB.ut(e.title + (e.chTitle ? ' · ' + e.chTitle : '')) }),
          e.preview ? h('div.hs-prev' + devCls(e.preview), { text: GB.ut(e.preview) }) : null,
          h('button.hs-x', { title: 'Remove', onclick: async ev => { ev.stopPropagation(); await GB.history.remove(e.id); fill(); } }, GB.ico('close'))));
      }
    };
    pg.refresh = fill; fill(); L.push(pg);
  };
  GB.about = function () {
    const n = lib.books.length, f = lib.dbs.size;
    GB.ui.dialog({ title: 'About', body: h('div.about', null, img('gitabase_reader_icon.png', 'about-ic'),
      h('p', null, h('b', { text: GB.APP_NAME })), ...(GB.BRAND ? [h('p.about-q', { text: '“' + GB.BRAND.quote + '”' }), h('p.about-qs', { text: GB.BRAND.source })] : []),
      h('p', { text: 'A quiet reader for scripture: verse, word-for-word, translation and purport, with notes, topics and full-text search. It opens .db book files and works offline; your files, notes and reading list stay in this browser.' }),
      h('p', { text: (lib.hosted ? 'Online library: ' : 'Library: ') + f + ' file(s), ' + n + ' book(s). Notes: ' + GB.notes.list.length + '.' }),
      h('p.small', { text: 'SQLite 3.54.1 (WebAssembly) · type: Gaura Times, Reader Display (from Noto Serif Display), Roboto, Tiro Devanagari Hindi & Sanskrit, Noto Serif Devanagari · icons and pictures drawn for this app.' })), buttons: [{ label: 'OK' }] });
  };
})(window.GB);
