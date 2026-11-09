/* Vaishnava Texts: verse page rendering (verse, word-for-word, translation, purport) and the Devanagari
   typography pass: per-block script detection, Hindi prose vs Sanskrit verse faces, spacing, danda/visarga fixes. */
'use strict';
(function (GB) {
  const { h } = GB;
  const R = GB.render = {};
  const DEVC = /[\u0900-\u097F]/g, LATC = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g;
  const HINDI_WORDS = /(?:^|[\s,(“"‘'])(?:है|हैं|का|की|के|में|और|से|को|यह|वह|नहीं|था|थे|थी|गया|गए|किया|करते|करता|होता|होते|लिए|भी|तथा|जो|कि|अपने|उनके|इस|उस|हम|आप|मैं|ने|पर|तो|ही|एक|अथवा|द्वारा|रूप)(?=[\s,।?!;:)”"’']|$)/g;
  // classify a Devanagari text: 'hin' prose or 'skt' verse
  function devKind(t) {
    const hw = (t.match(HINDI_WORDS) || []).length;
    if (hw >= 2) return 'hin';
    if (/॥/.test(t)) return 'skt';
    if (hw === 1 && t.length > 60) return 'hin';
    return 'skt';
  }
  R.devKind = devKind;
  const BLOCKS = 'P,DIV,LI,BLOCKQUOTE,CENTER,H1,H2,H3,H4,H5,H6,TD,TH,DD,DT,PRE,UL,OL,TABLE';
  function sanitize(root) {
    root.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button').forEach(e => e.remove());
    root.querySelectorAll('*').forEach(e => {
      for (const a of Array.from(e.attributes)) { if (/^on/i.test(a.name) || (a.name === 'href' && /^\s*javascript:/i.test(a.value))) e.removeAttribute(a.name); }
      if (e.tagName === 'IMG' && !e.classList.contains('wbw_img')) e.remove();   // images only in picture tabs, never inline
      if (e.tagName === 'FONT') { e.removeAttribute('face'); e.removeAttribute('size'); }
    });
  }
  // length-preserving text fixes so note anchors (character offsets) stay valid
  function fixText(s) {
    return s.replace(/ ([।॥ः])/g, '\u00a0$1');
  }
  function walkText(node, fn) {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let n; const list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fn);
  }
  // mark blocks: .dev (+ .hin/.skt) or .lat ; hint: 'skt' forces Sanskrit for Devanagari (verse blocks)
  function typo(el, hint) {
    walkText(el, n => { const v = fixText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
    if (!GB.prefs.matchScript) return;
    const blocks = Array.from(el.querySelectorAll(BLOCKS)).filter(b => !b.querySelector(BLOCKS.split(',').map(x => x.toLowerCase()).join(',')));
    if (!blocks.length) blocks.push(el);
    for (const b of blocks) mark(b, hint);
    if (blocks[0] !== el) {
      const t = el.textContent; const d = (t.match(DEVC) || []).length, l = (t.match(LATC) || []).length;
      if (d > l) el.classList.add('dev-root');
    }
  }
  function mark(b, hint) {
    const t = b.textContent || ''; const d = (t.match(DEVC) || []).length, l = (t.match(LATC) || []).length;
    if (!d && !l) return;
    if (d >= l) { b.classList.add('dev', hint === 'skt' ? 'skt' : devKind(t)); b.setAttribute('lang', b.classList.contains('skt') ? 'sa' : 'hi'); }
    else { b.classList.add('lat'); if (d) b.querySelectorAll('*').forEach(() => {}); }
  }
  R.typo = typo;
  function frag(html) { const d = document.createElement('div'); d.innerHTML = html || ''; sanitize(d); return d; }
  const empty = s => !s || !String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '').length;
  // word-by-word as a two-column table ("word — meaning;" pairs)
  function wbwTable(html) {
    const d = frag(html); const out = h('table.wbwTable');
    const parts = d.innerHTML.replace(/<\/?p[^>]*>/gi, ' ').split(/;\s*/);
    for (const p of parts) {
      // word — meaning; the BG 1972 file writes "--", Sam's English file " - "
      const m = p.split(/\s*(?:&#8212;|—|&mdash;|--|&#8211;&#8211;|–)\s*|\s+-\s+/); if (m.length < 2 || !m[0].replace(/<[^>]+>/g, '').trim()) continue;
      const tr = h('tr', null, h('td.w', { html: m[0], 'data-act': 'word' }), h('td.m', { html: m.slice(1).join(' — ') }));
      out.append(tr);
    }
    return out.rows.length ? out : null;
  }
  // Sanskrit headwords inside a Devanagari word-by-word block
  function markWbwHeads(el) {
    if (!/[\u0900-\u097F]/.test(el.textContent)) return;
    walkText(el, n => {
      const s = n.nodeValue; if (!/[\u0900-\u097F]/.test(s) || n.parentNode.closest('.w')) return;
      const re = /(^|;\s*|\s)([\u0900-\u097F\u200c\u200d-]+)(?=\s*—)/g; let m, last = 0; const f = document.createDocumentFragment(); let hit = false;
      while ((m = re.exec(s))) { hit = true; const st = m.index + m[1].length; f.append(s.slice(last, st)); f.append(h('span.skt', { lang: 'sa', text: m[2] })); last = st + m[2].length; }
      if (!hit) return; f.append(s.slice(last)); n.parentNode.replaceChild(f, n);
    });
  }
  // ---------- verse parts: order, what each reading mode shows, presets ----------
  const PARTS = ['skt', 'translit', 'wbw', 'tr', 'pp'];
  const PART_NAMES = { skt: 'Sanskrit', translit: 'Transliteration', wbw: 'Word for word', tr: 'Translation', pp: 'Purport' };
  const PRESETS = { full: { skt: true, translit: true, wbw: true, tr: true, pp: true }, story: { skt: false, translit: false, wbw: false, tr: true, pp: false }, recite: { skt: true, translit: true, wbw: false, tr: false, pp: false } };
  GB.parts = {
    LIST: PARTS, NAMES: PART_NAMES, PRESETS,
    order: () => (GB.prefs.customOrder && Array.isArray(GB.prefs.order) && GB.prefs.order.length === 5 ? GB.prefs.order : PARTS).slice(),
    mode: () => (GB.prefs.readMode === 'cont' ? 'cont' : 'verse'),
    shown: m => Object.assign({}, PRESETS.full, (GB.prefs.show || {})[m || GB.parts.mode()]),
    set(m, k, v) { const sh = JSON.parse(JSON.stringify(GB.prefs.show)); sh[m] = Object.assign({}, GB.parts.shown(m), { [k]: v }); GB.setPref('show', sh); },
    preset(m, name) { const sh = JSON.parse(JSON.stringify(GB.prefs.show)); sh[m] = Object.assign({}, PRESETS[name]); GB.setPref('show', sh); },
    presetOf(m) { const s = GB.parts.shown(m); return Object.keys(PRESETS).find(k => PARTS.every(p => !!PRESETS[k][p] === !!s[p])) || ''; },
    // the old "Show Sanskrit" switch: Sanskrit, transliteration and word for word together
    sanskritOn: m => { const s = GB.parts.shown(m); return !!(s.skt || s.translit); },
    toggleSanskrit(m) { m = m || GB.parts.mode(); const on = !GB.parts.sanskritOn(m); const sh = JSON.parse(JSON.stringify(GB.prefs.show)); sh[m] = Object.assign({}, GB.parts.shown(m), { skt: on, translit: on, wbw: on }); GB.setPref('show', sh); GB.setPref('showSanskrit', on); }
  };
  const ico = n => GB.icons.svg(n);
  function tool(act, icon, title, on, extra) { return h('button.vt' + (on ? '.on' : ''), Object.assign({ type: 'button', 'data-act': act, title, 'aria-label': title, 'aria-pressed': on ? 'true' : 'false', html: ico(icon) }, extra || {})); }
  R.tool = tool;
  function block(cls, id, html, hint) { const e = h('div.' + cls + (id ? '#' + id : '')); e.append(...frag(html).childNodes); typo(e, hint); return e; }
  // primary + second language side by side (wide reading area) or stacked; phones always stack (css container query)
  function pair(a, b, layout) { if (!b) return a; const w = h('div.pair.' + (layout === 'side' ? 'side' : 'stack')); w.append(a, b); return w; }
  /* Build one verse. t = texts row; o = {B, ch, row, label, wbwHidden, notes, needles, fav, noteCount, canSecond, second: {t, B}, mode} */
  R.verse = function (t, o) {
    const P = GB.prefs; const mode = o.mode || GB.parts.mode(); const show = GB.parts.shown(mode);
    const root = h('div.verse.m-' + mode, { 'data-id': o.row.id });
    const t2 = o.second && o.second.t; const lay = P.secondLayout;
    // header: reference + verse actions (heart, second language, references, notes, share)
    const tools = h('div#toolbar.vtools');
    tools.append(tool('fav', o.fav ? 'heartOn' : 'heart', o.fav ? 'Remove from favourites' : 'Favourite', o.fav));
    if (o.canSecond) tools.append(tool('second', 'lang', P.second ? 'Hide the second language' : 'Show the second language', P.second));
    tools.append(tool('notes', 'note', 'Notes', o.noteCount > 0, o.noteCount ? { 'data-n': String(o.noteCount) } : null));
    tools.append(tool('share', 'share', 'Share this verse'));
    root.append(h('div.vhead', null, h('span.vlabel', { text: o.label || '' }), tools));
    let any = false;
    for (const k of GB.parts.order()) {
      if (!show[k]) continue;
      if (k === 'skt') {
        if (P.hideDevanagari) continue;
        let src = !empty(t.sanskrit) ? t.sanskrit : (t2 && !empty(t2.sanskrit) ? t2.sanskrit : null); if (!src) continue;
        const dev = block('verseSanskrit', src === t.sanskrit ? 'verseSanskrit' : null, src, 'skt'); dev.classList.add('dev', 'skt'); dev.setAttribute('lang', 'sa'); root.append(dev); any = true;
      } else if (k === 'translit') {
        if (!empty(t.translit)) { root.append(block('verseTranslit', 'verseTranslit', t.translit, 'skt')); any = true; }
        else if (t2 && !empty(t2.translit)) { root.append(block('verseTranslit.alt', null, t2.translit, 'skt')); any = true; }
      } else if (k === 'wbw') {
        const mk = (html, id) => { const w = h('div.verseTranslWBW' + (id ? '#' + id : '.alt')); const tbl = P.wbwStyle === 'table' ? wbwTable(html) : null; if (tbl) w.append(tbl); else w.append(...frag(html).childNodes); typo(w); markWbwHeads(w); return w; };
        const a = !empty(t.transl1) ? mk(t.transl1, 'verseTranslWBW') : null, b = t2 && !empty(t2.transl1) ? mk(t2.transl1) : null;
        if (!a && !b) continue;
        const fold = h('button.wbw-fold' + (o.wbwHidden ? '' : '.open'), { type: 'button', 'data-act': 'wbw', title: o.wbwHidden ? 'Show word for word' : 'Hide word for word', 'aria-expanded': o.wbwHidden ? 'false' : 'true', html: ico('chev') });
        const box = h('div.wbw-box', { hidden: !!o.wbwHidden }, a && b ? pair(a, b, lay) : (a || b));
        root.append(fold, box); any = true;
      } else if (k === 'tr') {
        const a = !empty(t.transl2) ? block('verseTransl2', 'verseTransl2', t.transl2) : null, b = t2 && !empty(t2.transl2) ? block('verseTransl2.alt', null, t2.transl2) : null;
        if (a || b) { root.append(a && b ? pair(a, b, lay) : (a || b)); any = true; }
      } else if (k === 'pp') {
        const a = !empty(t.comment) ? block('versePurport', 'versePurport', t.comment) : null;
        const b = t2 && !empty(t2.comment) ? (() => { const d = h('details.pp2'); const body = block('versePurport.alt', null, t2.comment); const first = GB.stripTags ? GB.stripTags(t2.comment) : body.textContent;
          d.append(h('summary', null, h('span.pp2-peek', { text: String(first).replace(/\s+/g, ' ').trim().slice(0, 140) }), h('span.pp2-ic', { html: ico('chev') })), body); return d; })() : null;
        if (a || b) { root.append(h('div.pp-rule', { 'aria-hidden': 'true' }, h('i'), h('b'), h('i'))); if (a) root.append(a); if (b) root.append(b); any = true; }
      }
    }
    if (!any) root.append(h('div.verse-none', { text: 'Every part of the verse is hidden. Open Aa to choose what to show.' }));
    root.append(h('div#divBottomPaginationFooter'));
    if (o.notes && o.notes.length) R.applyNotes(root, o.notes);
    if (o.needles && o.needles.length) R.highlight(root, o.needles);
    return root;
  };
  // ---------- note highlights: anchors are character offsets inside a block's text ----------
  const HL = { highl: 'hl2', quote: 'hl2', note: 'hl3', quest: 'hl4' };
  function rangeWrap(block, start, end, cls, id) {
    let pos = 0; const segs = [];
    walkText(block, n => { const L = n.nodeValue.length; const a = Math.max(start, pos), b = Math.min(end, pos + L); if (a < b) segs.push([n, a - pos, b - pos]); pos += L; });
    for (const [n, a, b] of segs) {
      let node = n; if (a > 0) node = node.splitText(a); if (b - a < node.nodeValue.length) node.splitText(b - a);
      const sp = h('span.' + cls, { 'data-note': id }); node.parentNode.replaceChild(sp, node); sp.append(node);
    }
    return segs.length > 0;
  }
  R.applyNotes = function (root, notes) {
    for (const n of notes) {
      if (!n.anchor || !HL[n.type]) continue;
      const block = root.querySelector('#' + n.anchor.block); if (!block) continue;
      let { start, end } = n.anchor; const text = block.textContent;
      if (n.quote && text.slice(start, end) !== n.quote) { const k = text.indexOf(n.quote); if (k < 0) continue; start = k; end = k + n.quote.length; }
      rangeWrap(block, start, end, HL[n.type], n.id);
    }
  };
  // text offset of a DOM point inside a block
  R.offsetIn = function (block, node, off) {
    let pos = 0, found = -1;
    walkText(block, n => { if (found >= 0) return; if (n === node) found = pos + off; else pos += n.nodeValue.length; });
    if (found < 0 && node.nodeType === 1) { // element boundary
      const r = document.createRange(); r.setStart(block, 0); r.setEnd(node, off); found = r.toString().length;
    }
    return found;
  };
  // ---------- search highlight (diacritic/case-insensitive) ----------
  R.highlight = function (root, needles) {
    const ns = needles.map(n => GB.fold(n.normalize('NFC'))).filter(n => n.length > 1 || /[\u0900-\u097F]/.test(n));
    if (!ns.length) return 0;
    let count = 0;
    root.querySelectorAll('.verseSanskrit,.verseTranslit,.verseTranslWBW,.verseTransl2,.versePurport').forEach(b => {
      walkText(b, n => {
        const s = n.nodeValue; const f = GB.fold(s); const hits = [];
        for (const nd of ns) { let i = 0; while ((i = f.indexOf(nd, i)) >= 0) { hits.push([i, i + nd.length]); i += nd.length; } }
        if (!hits.length) return;
        hits.sort((a, b) => a[0] - b[0]); const merged = [];
        for (const x of hits) { const l = merged[merged.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else merged.push(x.slice()); }
        const fr = document.createDocumentFragment(); let last = 0;
        for (const [a, b2] of merged) { fr.append(s.slice(last, a)); count++; fr.append(h('span.srch_res', { id: 'srch_' + count, text: s.slice(a, b2) })); last = b2; }
        fr.append(s.slice(last)); n.parentNode.replaceChild(fr, n);
      });
    });
    return count;
  };
  // snippet with highlighted needles (search results)
  R.snippet = function (text, needles, len) {
    len = len || 260; const f = GB.fold(text); const ns = needles.map(n => GB.fold(n.normalize('NFC'))).filter(Boolean);
    let first = -1; for (const n of ns) { const i = f.indexOf(n); if (i >= 0 && (first < 0 || i < first)) first = i; }
    let a = first < 0 ? 0 : Math.max(0, first - 70); let b = Math.min(text.length, a + len);
    if (a > 0) { const sp = text.indexOf(' ', a); if (sp > 0 && sp < a + 20) a = sp + 1; }
    const s = text.slice(a, b), fs = f.slice(a, b); const hits = [];
    for (const n of ns) { let i = 0; while ((i = fs.indexOf(n, i)) >= 0) { hits.push([i, i + n.length]); i += n.length; } }
    hits.sort((x, y) => x[0] - y[0]);
    let out = '', last = 0;
    for (const [x, y] of hits) { if (x < last) continue; out += GB.esc(s.slice(last, x)) + '<b class="hit">' + GB.esc(s.slice(x, y)) + '</b>'; last = y; }
    out += GB.esc(s.slice(last));
    return (a > 0 ? '…' : '') + out + (b < text.length ? '…' : '');
  };
})(window.GB);
