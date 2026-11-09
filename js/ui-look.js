/* Vaishnava Texts: shelf, look and lookup additions.
   0. Fast start: when library/catalog.json carries "meta" for every file (tools/prepare_library.py), the library is built from it and no
      database is opened at start; a file opens (once, lazily) the first time something reads from it. Old catalogues boot the old way.
   1. Books that carry no chapters rows (Teachings of Lord Caitanya, Nectar of Devotion, Teachings of Queen Kunti ...: ebooks whose
      texts are chapters) get one chapter built from their text rows, so they open and read as paged ebooks.
   2. Shelf order: Bhagavad-gita, Srimad-Bhagavatam, Caitanya-caritamrita always first, in that order, in every language.
      Every second row of the shelf (books and volume groups) gets a soft grey tint.
   3. A visible switch for the Modern theme (beta) in Settings and in the Aa panel; off = the old look.
   4. The Modern accent itself (key 'penta', colours come from css/penta.css, not from inline styles). Safe to load where it already exists.
      Modern is also the default look: anyone who has not picked an accent themselves starts on it.
   5. Word lookup: the gitabase texts write the anusvara as m + acute and the guttural nasal as n-acute, the reader draws them as the dotted letters;
      the lookup key now uses the books' own spelling first; then the plain spelling (jnana matches jñāna).
   6. Search: the status line names the file being read.
   7. A bar along the bottom of the reader shows how much of the current verse has been read (scrolled into view).
   8. Preview only: on phones the selection toolbar floats next to the selected text.
   9. Preview only: CC verses in Bengali script, made from the Roman transliteration; the Sanskrit chip reads Bengali on CC. */
'use strict';
(function (GB) {
  const { h } = GB;
  const lib = GB.lib, L = GB.left;

  // ---------- 0. fast start from the catalogue ----------
  // lazy databases: GBDB.lazy(id, source) registers a file; the first call that names it opens it, and everything waits for that
  const lazy = new Map();
  GBDB.lazy = (id, source) => { lazy.set(id, { source, p: null }); };
  const wake = id => {
    const l = lazy.get(id); if (!l) return null;
    return l.p || (l.p = GBDB.open(id, l.source).then(() => { lazy.delete(id); }, e => { l.p = null; throw e; }));
  };
  for (const k of ['q', 'batch', 'wbwLookup', 'wbwSuggest', 'fts', 'hasFts', 'stats']) {
    const f = GBDB[k];
    GBDB[k] = function (id) { const w = wake(id); const a = arguments; return w ? w.then(() => f.apply(GBDB, a)) : f.apply(GBDB, a); };
  }
  { const f = GBDB.lookup;
    GBDB.lookup = function (args) { const w = wake(args && args.dbId); return w ? w.then(() => f.call(GBDB, args)) : f.call(GBDB, args); }; }
  { const f = GBDB.close;
    GBDB.close = function (id) {
      const l = lazy.get(id);
      if (l && !l.p) { lazy.delete(id); return Promise.resolve(true); }
      return l ? l.p.then(() => f.call(GBDB, id)) : f.call(GBDB, id);
    }; }

  const LANGS = { en: 'eng', hi: 'hin', ru: 'rus', bn: 'ben', uk: 'ukr', de: 'ger', fr: 'fre', es: 'spa', it: 'ita', pt: 'por', lv: 'lat', sa: 'san', gu: 'guj', ta: 'tam', te: 'tel', ml: 'mal', kn: 'kan', mr: 'mar', or: 'ori', zh: 'chi', ja: 'jpn', pl: 'pol', cs: 'cze', hu: 'hun', bg: 'bul', ka: 'geo', et: 'est', lt: 'lit', ne: 'nep' };
  const NAME_LANG = { eng: 'eng', en: 'eng', rus: 'rus', ru: 'rus', hin: 'hin', hi: 'hin', ben: 'ben', bn: 'ben', ukr: 'ukr', ua: 'ukr', uk: 'ukr',
    ger: 'ger', de: 'ger', fre: 'fre', fr: 'fre', spa: 'spa', es: 'spa', guj: 'guj', gu: 'guj', mar: 'mar', nep: 'nep', san: 'san' };
  function nameLang(name) {
    const parts = String(name || '').toLowerCase().replace(/\.[a-z0-9]+$/, '').split(/[^a-z]+/).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) if (NAME_LANG[parts[i]]) return NAME_LANG[parts[i]];
    return '';
  }
  // the same decision library.js makes when it opens a file (name first, then the script of the text, then the locale)
  function detectLang(locale, sample, name) {
    const n = nameLang(name); if (n) return n;
    const t = String(sample || '').replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ');
    const count = re => (t.match(re) || []).length;
    const dev = count(/[\u0900-\u097F]/g), ben = count(/[\u0980-\u09FF]/g), cyr = count(/[\u0400-\u04FF]/g), lat = count(/[A-Za-z]/g);
    const top = Math.max(dev, ben, cyr, lat);
    if (top > 0 && top === dev) return 'hin';
    if (top > 0 && top === ben) return 'ben';
    if (top > 0 && top === cyr) return /[їєі]/i.test(t) ? 'ukr' : 'rus';
    const l = String(locale || '').slice(0, 2).toLowerCase();
    const Lg = LANGS[l] || l;
    return top > 0 && top === lat && ['rus', 'ukr', 'hin', 'ben'].includes(Lg) ? 'eng' : (Lg || 'eng');
  }
  let fastSeq = 0;
  function dbFromMeta(f) {
    const m = f.meta, rec = { id: 'h:' + f.id, name: f.name, size: f.size, kind: 'hosted' };
    const num = 100000 + (++fastSeq);
    const D = { id: rec.id, num, name: rec.name, size: rec.size, kind: rec.kind, tables: m.tables, idx: m.tables.__idx || [], rec, meta: m };
    D.modern = lib.has(D, 'textnums', 'text_id') || lib.has(D, 'image_nums', 'bid');
    let sample = m.books.map(b => (b.title || '') + ' ' + (b.author || '')).join(' ');
    for (const t of m.sample || []) sample += ' ' + t;
    D.lang = detectLang(m.locale, sample, rec.name); D.locale = m.locale || '';
    D.entityMode = !!m.entityMode; D.songs = m.songs || []; D.chapters = m.chapters || []; D.books = m.books; D.hasFts = !!m.hasFts;
    D.imgKinds = {};
    for (const r of m.imgRows || []) (D.imgKinds[r.b] = D.imgKinds[r.b] || {})[r.k || 1] = r.n;
    GBDB.lazy(num, { base: new URL(f.base, document.baseURI).href, size: f.size, chunkSize: f.chunkSize });
    return D;
  }
  const bootOld = lib.boot;
  lib.boot = async function () {
    if (/^https?:$/.test(location.protocol)) {
      let cat = null;
      try { const r = await fetch('library/catalog.json', { cache: 'no-cache' }); if (r.ok) cat = await r.json(); } catch (e) {}
      if (cat && (cat.files || []).length && cat.files.every(f => f.meta && f.meta.tables && f.meta.books)) {
        try {
          await GBDB.init();
          const made = cat.files.map(dbFromMeta);
          lib.hosted = true; lib.catalog = cat;
          for (const D of made) lib.dbs.set(D.id, D);
          lib.rebuild(); lib.fast = true; return;
        } catch (e) { console.warn('catalogue start failed, opening the files instead', e); lib.dbs.clear(); }
      }
    }
    return bootOld.apply(this, arguments);
  };

  // ---------- 4. the Modern accent ----------
  if (!GB.ACCENTS.penta) GB.ACCENTS.penta = { name: 'Modern', day: '#207dff', night: '#61c6fa', hdr: '#f7f7f7', hdrN: '#212121', ink: '#5a5a5d', inkN: '#a9aaab', key: 'penta' };
  GB.ACCENTS.penta.name = 'Modern';
  { const ai = GB.accentInk;
    GB.accentInk = nightInk => { const a = GB.ACCENTS[(GB.prefs && GB.prefs.accent) || 'tulasi'] || GB.ACCENTS.tulasi; return a.ink ? (nightInk ? a.inkN : a.ink) : ai(nightInk); }; }
  { const aa = GB.applyAccent;
    GB.applyAccent = function () {
      aa.apply(this, arguments);
      if (GB.prefs.accent === 'penta') for (const k of ['--accent', '--link', '--chip-b', '--tab-on', '--hdr', '--tab-bar', '--cmp-bar', '--transl', '--hdr-grad', '--wash', '--hover', '--sel']) document.body.style.removeProperty(k);
    }; }
  // Modern is the default look. Whoever has not picked an accent themselves (the switch or the colour dots) starts on Modern;
  // once they pick one, it is remembered and never replaced.
  if (GB.loadPrefs && GB.setAccent) {
    const lp = GB.loadPrefs;
    GB.loadPrefs = async function () {
      const r = await lp.apply(this, arguments);
      try { const chosen = await GB.store.kvGet('accentChosen', false); if (!chosen && (!GB.prefs.accent || GB.prefs.accent === 'tulasi')) GB.prefs.accent = 'penta'; } catch (e) {}
      return r;
    };
    const sa = GB.setAccent;
    GB.setAccent = function () { try { GB.store.kvSet('accentChosen', true); } catch (e) {} return sa.apply(this, arguments); };
  }

  // ---------- 2. pinned order (runs first, so every screen that renders the shelf sees it) ----------
  const RANK = B => { const a = lib.shortAbbr(B); if (a === 'BG') return lib.edition(B) ? 1 : 0; if (a === 'SB') return 2; if (a === 'CC') return 3; return 9; };
  function pin() {
    const pos = new Map(lib.books.map((b, i) => [b, i]));
    lib.books.sort((a, b) => (a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : 0) || (RANK(a) - RANK(b)) || (pos.get(a) - pos.get(b)));
  }
  document.addEventListener('gb:library', pin, true);
  // every second row of the shelf (single books and volume groups alike), in a neutral grey
  function zebra() { let i = 0; document.querySelectorAll('.home-body .stbody :is(.bk, .vol)').forEach(v => v.classList.toggle('alt', i++ % 2 === 1)); }
  { const hr = GB.home.render;
    GB.home.render = function () { const r = hr.apply(this, arguments); try { zebra(); } catch (e) {} return r; }; }

  // ---------- 1. ebooks without chapter rows ----------
  async function synth(B) {
    for (const part of B.parts) {
      const D = part.D; if (!lib.has(D, 'textnums', 'book_id')) continue;
      const ids = [part.bookId, String(part.bookId)];
      let rs = null;
      const pre = D.meta && D.meta.noch && D.meta.noch[String(part.bookId)];   // from the catalogue: no database read needed
      if (pre) rs = pre.map(r => ({ song: r[0], ch_no: r[1], n: r[2] }));
      else {
        rs = [];
        try { rs = await lib.q(D, 'SELECT song, ch_no, count(*) AS n FROM textnums WHERE book_id IN (?, ?) GROUP BY song, ch_no ORDER BY song, ch_no', ids); } catch (e) { console.warn('ebook chapters', e); }
      }
      for (const r of rs) B.chapters.push({ song: String(r.song), ch: r.ch_no, title: B.title, size: 0, part, prevSize: 0, synth: true });
    }
    B.chapters.forEach((c, i) => { c.idx = i; c.book = B; });
  }
  document.addEventListener('gb:library', () => {
    const todo = lib.books.filter(B => !B.chapters.length && !B._synthP);
    if (!todo.length) return;
    const all = Promise.all(todo.map(B => { B._synthP = synth(B); return B._synthP; }));
    all.then(() => { try { if (document.querySelector('.home-body') && GB.home) GB.home.render(); } catch (e) {} });
  });
  // a one-chapter ebook opens straight on its contents (the list of its chapters)
  const bo = GB.book.open;
  GB.book.open = function (B, song) {
    const go = () => (B.chapters.length === 1 && B.chapters[0].synth && !B.hasSongs ? GB.chapter.open(B, B.chapters[0], null, true) : bo.call(GB.book, B, song));
    return B._synthP ? B._synthP.then(go) : go();
  };

  // ---------- 5. word lookup spelling ----------
  const gbKey = w => String(w == null ? '' : w).normalize('NFC').replace(/[\u1E41\u1E43]/g, 'm\u0301').replace(/[\u1E40\u1E42]/g, 'M\u0301').replace(/\u1E45/g, '\u0144').replace(/\u1E44/g, '\u0143');
  const plainKey = w => String(w == null ? '' : w).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  { const wl = GBDB.wbwLookup;
    GBDB.wbwLookup = async function (id, word) {
      const a = gbKey(word); let r = await wl.call(GBDB, id, a);
      if ((!r || !r.length) && a !== word) r = await wl.call(GBDB, id, word);
      if (!r || !r.length) {   // the text links a plain spelling (jnana), the book's word-for-word has the accented one (jñāna): match on plain letters
        const f = plainKey(word); r = [];
        if (f) {
          let sug = []; try { sug = await GBDB.wbwSuggest(id, f, 80); } catch (e) {}
          const keys = (sug || []).map(x => x[0]).filter(k => plainKey(k) === f).slice(0, 8), seen = new Set();
          for (const k of keys) for (const x of (await wl.call(GBDB, id, k)) || []) if (!seen.has(x[0])) { seen.add(x[0]); r.push(x); }
        }
      }
      return r;
    }; }

  // ---------- 6. search: say which file is being read ----------
  { const ft = GBDB.fts;
    GBDB.fts = function (dbId) {
      try { const st = document.querySelector('.searchpage .loading-row'); if (st) { const D = Array.from(lib.dbs.values()).find(x => x.num === dbId); st.textContent = 'Searching ' + (D ? D.name : 'the library') + '…'; } } catch (e) {}
      return ft.apply(GBDB, arguments);
    }; }

  // ---------- 7. bottom bar: how much of the current verse has been read ----------
  // the share of the verse that has scrolled into view (the bottom edge of what is on screen), so a verse that fits the screen reads 100%
  let vpBar = null, vpFill = null, vpLast = -1;
  function vpRatio(rd) {
    const clamp = x => Math.max(0, Math.min(1, x));
    const cont = rd.querySelector('.rd-cont');
    if (cont && !cont.hidden) {
      const cr = cont.getBoundingClientRect(), line = cr.top + 56;
      const it = Array.from(cont.querySelectorAll('.cv')).find(x => x.getBoundingClientRect().bottom > line);
      if (!it) return 1;
      const r = it.getBoundingClientRect(); return r.height > 0 ? clamp((cr.bottom - r.top) / r.height) : 1;
    }
    const pager = rd.querySelector('.rd-pager'); if (!pager) return 0;
    const slot = pager.querySelectorAll(':scope > .rd-slot')[1], sc = slot && slot.firstElementChild; if (!sc) return 0;
    if (pager.classList.contains('hz')) return sc.scrollWidth > 0 ? clamp((sc.scrollLeft + sc.clientWidth) / sc.scrollWidth) : 1;
    return sc.scrollHeight > 0 ? clamp((sc.scrollTop + sc.clientHeight) / sc.scrollHeight) : 1;
  }
  function vpUpdate() {
    const rd = vpBar && vpBar.closest('.rd'); if (!rd || rd.hidden) return;
    const rc = rd.getBoundingClientRect();   // pinned to the very bottom of the screen, under the reader only (not the sidebar)
    if (vpBar._l !== rc.left || vpBar._w !== rc.width) { vpBar._l = rc.left; vpBar._w = rc.width; vpBar.style.left = rc.left + 'px'; vpBar.style.width = rc.width + 'px'; }
    const p = Math.round(vpRatio(rd) * 1000) / 10; if (p === vpLast) return; vpLast = p;
    vpFill.style.width = p + '%'; vpBar.setAttribute('aria-valuenow', String(Math.round(p))); vpBar.title = Math.round(p) + '% of this verse read'; vpBar.classList.toggle('done', p >= 99.5);
  }
  { const rb = GB.reader.build;
    GB.reader.build = function () {
      const r = rb.apply(this, arguments);
      try {
        const stage = document.querySelector('#reader .rd-stage'); if (!stage) return r;
        vpFill = h('i'); vpBar = h('div.vprog', { role: 'progressbar', 'aria-label': 'Part of this verse read', 'aria-valuemin': '0', 'aria-valuemax': '100' }, vpFill);
        stage.append(vpBar);
        const rd = stage.closest('.rd'); rd.addEventListener('scroll', vpUpdate, { capture: true, passive: true });
        window.addEventListener('resize', vpUpdate); setInterval(vpUpdate, 500);
      } catch (e) { console.warn('verse progress bar', e); }
      return r;
    }; }

  // ---------- 8. phones, text selected (preview only): a floating toolbar next to the selection instead of a bar over the top bar ----------
  // The same buttons as the top action bar, drawn as a rounded pill under the selection (the browser's own Copy/Select-all menu sits above it),
  // moved with the selection and the scroll; main keeps the top bar.
  if (/^Preview/.test(document.title)) {
    let raf = 0;
    const place = () => {
      raf = 0;
      const sb = document.querySelector('.selbar'); if (!sb || sb.hidden || !sb.classList.contains('cab')) return;
      const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return;
      sb.classList.add('pop');
      const rc = sel.getRangeAt(0).getBoundingClientRect(); if (!rc.width && !rc.height) return;
      const w = sb.offsetWidth, hh = sb.offsetHeight, vw = innerWidth, vh = (window.visualViewport ? visualViewport.height : innerHeight);
      const x = Math.max(8, Math.min(vw - w - 8, rc.left + rc.width / 2 - w / 2));
      let y = rc.bottom + 18;                                   // below the selection: the browser's own menu is above it
      if (y + hh > vh - 12) y = Math.max(64, rc.top - hh - 64); // no room below: above, clear of the browser's menu
      y = Math.max(8, Math.min(vh - hh - 12, y));
      sb.style.left = x + 'px'; sb.style.top = y + 'px';
    };
    const later = () => { if (!raf) raf = requestAnimationFrame(place); };
    document.addEventListener('selectionchange', GB.debounce(later, 260));
    document.addEventListener('scroll', later, { capture: true, passive: true });
    window.addEventListener('resize', later);
    new MutationObserver(later).observe(document.body, { childList: true, subtree: false });
    setInterval(() => { const sb = document.querySelector('.selbar'); if (sb && !sb.hidden && sb.classList.contains('cab') && !sb.style.top) later(); }, 300);
  }

  // ---------- 9. Caitanya-caritamrita verses in Bengali script (preview only) ----------
  // CC's verses are printed in Bengali script, but the library files only carry Roman transliteration (English) or Devanagari (Hindi).
  // On the preview the verse line of every CC text is rebuilt in Bengali script from the Roman transliteration (the Hindi edition borrows the
  // English edition's transliteration), and the "Sanskrit" chip reads "Bengali" while a CC text is open.
  if (/^Preview/.test(document.title)) {
    const VOW = { 'a': 'অ', 'ā': 'আ', 'i': 'ই', 'ī': 'ঈ', 'u': 'উ', 'ū': 'ঊ', 'ṛ': 'ঋ', 'ṝ': 'ৠ', 'ḷ': 'ঌ', 'e': 'এ', 'ai': 'ঐ', 'o': 'ও', 'au': 'ঔ' };
    const SGN = { 'a': '', 'ā': 'া', 'i': 'ি', 'ī': 'ী', 'u': 'ু', 'ū': 'ূ', 'ṛ': 'ৃ', 'ṝ': 'ৄ', 'ḷ': 'ৢ', 'e': 'ে', 'ai': 'ৈ', 'o': 'ো', 'au': 'ৌ' };
    const CON = { 'kh': 'খ', 'gh': 'ঘ', 'ch': 'ছ', 'jh': 'ঝ', 'ṭh': 'ঠ', 'ḍh': 'ঢ', 'th': 'থ', 'dh': 'ধ', 'ph': 'ফ', 'bh': 'ভ',
      'k': 'ক', 'g': 'গ', 'ṅ': 'ঙ', 'c': 'চ', 'j': 'জ', 'ñ': 'ঞ', 'ṭ': 'ট', 'ḍ': 'ড', 'ṇ': 'ণ', 't': 'ত', 'd': 'দ', 'n': 'ন', 'p': 'প', 'b': 'ব', 'm': 'ম',
      'y': 'য', 'r': 'র', 'l': 'ল', 'v': 'ব', 'ś': 'শ', 'ṣ': 'ষ', 's': 'স', 'h': 'হ' };
    const VIR = '\u09cd', DIG = '০১২৩৪৫৬৭৮৯';
    const canon = s => String(s).replace(/[mM]\u0301/g, 'ṁ').normalize('NFC').replace(/[\u1E3E\u1E3F\u1E40\u1E41\u1E42\u1E43]/g, 'ṁ').replace(/[\u0143\u0144]/g, 'ṅ').replace(/n\u0307/g, 'ṅ').toLowerCase().normalize('NFC');
    function toBengali(src) {
      const s = canon(src); let out = '', pend = false, prevVowel = false, i = 0;
      while (i < s.length) {
        const c = s[i], d2 = s.substr(i, 2);
        if (VOW[d2] && (d2 === 'ai' || d2 === 'au')) { out += pend ? SGN[d2] : VOW[d2]; pend = false; prevVowel = true; i += 2; continue; }
        if (CON[d2] && d2.length === 2) { out += (pend ? VIR : '') + CON[d2]; pend = true; prevVowel = false; i += 2; continue; }
        if (CON[c]) {
          let ch = CON[c];
          if (c === 'y' && prevVowel && !pend) ch = 'য়';
          out += (pend ? VIR : '') + ch; pend = true; prevVowel = false; i++; continue;
        }
        if (VOW[c]) { out += pend ? SGN[c] : VOW[c]; pend = false; prevVowel = true; i++; continue; }
        if (c === 'ṁ' || c === 'ṃ') { out += 'ং'; pend = false; prevVowel = false; i++; continue; }
        if (c === 'ḥ') { out += 'ঃ'; pend = false; prevVowel = false; i++; continue; }
        if (c === "'" || c === '’') { out += 'ঽ'; pend = false; i++; continue; }
        if (pend) { out += VIR; pend = false; }
        prevVowel = false;
        if (c === '|') { out += s[i + 1] === '|' ? '॥' : '।'; i += s[i + 1] === '|' ? 2 : 1; continue; }
        if (c >= '0' && c <= '9') { out += DIG[+c]; i++; continue; }
        out += c; i++;
      }
      return out + (pend ? VIR : '');
    }
    GB.toBengali = toBengali;
    const bnText = root => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
      for (let n; (n = w.nextNode());) list.push(n);
      list.forEach(n => { n.nodeValue = toBengali(n.nodeValue); });
    };
    const isLatin = s => /[A-Za-zāīūṛṝḷṅñṭḍṇśṣṁḥ]/.test(s) && !/[\u0900-\u097F\u0980-\u09FF]/.test(s);
    const fillBn = (target, srcHtml) => { target.innerHTML = srcHtml; bnText(target); target.lang = 'bn'; target.classList.add('bn-verse'); };
    async function englishRoman(pos) {
      const B2 = lib.books.find(b => b.lang === 'eng' && b.abbr === 'CC'); if (!B2) return '';
      const ch2 = lib.findChapter(B2, pos.ch.song, pos.ch.ch); if (!ch2) return '';
      const rows = await lib.chapterTexts(B2, ch2), i = lib.findTextIndex(rows, pos.row.no); if (i < 0) return '';
      const t2 = await lib.text(ch2.part.D, rows[i].id); if (!t2) return '';
      const tmp = document.createElement('div'); tmp.innerHTML = t2.translit || '';
      if (!isLatin(tmp.textContent) && isLatin(String(t2.sanskrit || '').replace(/<[^>]+>/g, ''))) tmp.innerHTML = t2.sanskrit;
      return isLatin(tmp.textContent) ? tmp.innerHTML : '';
    }
    function bengaliVerse(v, o) {
      let on = true; try { const s = GB.parts.shown(o.mode || 'verse'); on = !!s.skt; } catch (e) {}
      if (!on) return;
      const skt = v.querySelector('#verseSanskrit'), tl = v.querySelector('#verseTranslit');
      if (tl && isLatin(tl.textContent)) {
        if (skt) { if (!/[\u0980-\u09FF]/.test(skt.textContent)) fillBn(skt, tl.innerHTML); return; }
        const bn = document.createElement('div'); bn.id = 'verseSanskrit';
        bn.className = String(tl.className).replace(/verseTranslit/g, 'verseSanskrit').replace(/\balt\b/g, '').trim();
        fillBn(bn, tl.innerHTML); tl.before(bn); return;
      }
      if (skt && o.B.lang !== 'eng' && !/[\u0980-\u09FF]/.test(skt.textContent)) {
        const pos = { ch: o.ch, row: o.row };
        englishRoman(pos).then(html => { if (html && skt.isConnected) fillBn(skt, html); }).catch(() => {});
      }
    }
    { const rv = GB.render.verse;
      GB.render.verse = function (t, o) {
        const v = rv.apply(this, arguments);
        try { if (o && o.B && o.B.abbr === 'CC') bengaliVerse(v, o); } catch (e) { console.warn('bengali verse', e); }
        return v;
      }; }
    // while a CC text is open, the "Sanskrit" chip and the verse-order row read "Bengali"
    let rl = 0;
    const relabel = () => {
      rl = 0;
      const cur = GB.reader.current && GB.reader.current(); if (!cur || !cur.B || cur.B.abbr !== 'CC') return;
      document.querySelectorAll('.rp, .vo-list, .vo-top').forEach(root => {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n; (n = w.nextNode());) if (n.nodeValue.trim() === 'Sanskrit') n.nodeValue = n.nodeValue.replace('Sanskrit', 'Bengali');
      });
    };
    new MutationObserver(() => { if (!rl) rl = requestAnimationFrame(relabel); }).observe(document.body, { childList: true, subtree: true });
  }

  // ---------- 3. Modern theme (beta) switch ----------
  const isNew = () => GB.prefs.accent === 'penta';
  async function setLook(on) {
    if (on === isNew()) return;
    if (on) { await GB.store.kvSet('lookPrev', GB.prefs.accent); GB.setAccent('penta'); }
    else { const p = await GB.store.kvGet('lookPrev', 'tulasi'); GB.setAccent(p && p !== 'penta' && GB.ACCENTS[p] ? p : 'tulasi'); }
  }
  const SUB_ON = 'Modern theme is on: its colours, shapes, shadows and motion, in day and night. Switch off for the old look.';
  const SUB_OFF = 'Try the Modern theme in day and night: new colours, shapes, shadows and motion. Off = the old look.';
  function settingsRow() {
    const on = isNew();
    return h('div.pref.click.look', { onclick: () => setLook(!isNew()) },
      h('div.pref-main', null, h('div.pref-t', { text: 'Modern theme (beta)' }), h('div.pref-s', { text: on ? SUB_ON : SUB_OFF })),
      h('span.sw' + (on ? '.on' : '')));
  }
  const sp = GB.settingsPage;
  GB.settingsPage = function () {
    sp.apply(this, arguments);
    const pg = L.find('settings'); if (!pg || pg._look) return; pg._look = 1;
    const ensure = () => { if (pg.body.querySelector('.pref.look')) return; const first = pg.body.querySelector('.pref-cat'); if (first) first.after(settingsRow()); };
    ensure(); new MutationObserver(ensure).observe(pg.body, { childList: true });
  };
  function panelSec() {
    const sec = h('div.rp-sec.rp-look');
    const draw = () => {
      const on = isNew(); sec.innerHTML = '';
      sec.append(h('div.rp-line', null, h('div.rp-h', { text: 'Modern theme (beta)' }),
        h('button.sw2' + (on ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': 'Modern theme (beta)', onclick: async () => { await setLook(!isNew()); draw(); } }, h('i'))),
        h('div.rp-note', { text: on ? 'Modern theme. Off = the old look.' : 'Off = the old look.' }));
    };
    draw(); return sec;
  }
  const rpOpen = GB.readPanel;
  GB.readPanel = function () {
    rpOpen.apply(this, arguments);
    let tries = 0;
    const hook = () => {
      const box = document.querySelector('.rp'); if (!box) { if (++tries < 8) requestAnimationFrame(hook); return; }
      if (box._look) return; box._look = 1;
      const ensure = () => { if (!box.querySelector('.rp-look')) box.prepend(panelSec()); };
      ensure(); new MutationObserver(ensure).observe(box, { childList: true });
    };
    hook();
  };
})(window.GB);
