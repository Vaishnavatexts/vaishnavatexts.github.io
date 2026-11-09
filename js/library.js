/* Vaishnava Texts: library. Opens gitabase files (local blobs kept in IndexedDB, or hosted chunked files),
   reads their metadata and merges books that span several files (e.g. Bhagavatam split into parts) into one book. */
'use strict';
(function (GB) {
  const lib = GB.lib = { dbs: new Map(), books: [], hosted: false, catalog: null };
  let seq = 0;
  const has = (D, t, c) => !!(D.tables[t] && (!c || D.tables[t].indexOf(c) >= 0));
  const q = (D, sql, bind) => GBDB.q(D.num, sql, bind);
  lib.has = has; lib.q = q;
  const LANGS = { en: 'eng', hi: 'hin', ru: 'rus', bn: 'ben', uk: 'ukr', de: 'ger', fr: 'fre', es: 'spa', it: 'ita', pt: 'por', lv: 'lat', sa: 'san', gu: 'guj', ta: 'tam', te: 'tel', ml: 'mal', kn: 'kan', mr: 'mar', or: 'ori', zh: 'chi', ja: 'jpn', pl: 'pol', cs: 'cze', hu: 'hun', bg: 'bul', ka: 'geo', et: 'est', lt: 'lit', ne: 'nep' };
  lib.LANG_NAMES = { eng: 'English', hin: 'हिन्दी', rus: 'Русский', ben: 'বাংলা', ukr: 'Українська', ger: 'Deutsch', fre: 'Français', spa: 'Español', san: 'संस्कृतम्', guj: 'ગુજરાતી', mar: 'मराठी', nep: 'नेपाली' };
  // language of a file: the file name says it when it can (gitabase_texts_eng.db, bhagavatam_hi_canto1.db), else the script
  // most of its text is written in (one Cyrillic author name must not make an English file Russian), else the locale
  const NAME_LANG = { eng: 'eng', en: 'eng', rus: 'rus', ru: 'rus', hin: 'hin', hi: 'hin', ben: 'ben', bn: 'ben', ukr: 'ukr', ua: 'ukr', uk: 'ukr',
    ger: 'ger', de: 'ger', fre: 'fre', fr: 'fre', spa: 'spa', es: 'spa', guj: 'guj', gu: 'guj', mar: 'mar', nep: 'nep', san: 'san' };
  function nameLang(name) {
    const parts = String(name || '').toLowerCase().replace(/\.[a-z0-9]+$/, '').split(/[^a-z]+/).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) if (NAME_LANG[parts[i]]) return NAME_LANG[parts[i]];
    return '';
  }
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
    const L = LANGS[l] || l;
    return top > 0 && top === lat && ['rus', 'ukr', 'hin', 'ben'].includes(L) ? 'eng' : (L || 'eng');
  }
  const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));
  // match a column that may hold the value as INTEGER or TEXT (gitabase files are not consistent)
  lib.eq = (col, v) => ({ sql: '(' + col + ' = ? OR ' + col + ' = ?)', bind: isNaN(num(v)) ? [String(v), String(v)] : [num(v), String(v)] });

  async function openDb(rec, source) {
    const n = ++seq; const o = await GBDB.open(n, source);
    const D = { id: rec.id, num: n, name: rec.name, size: rec.size, kind: rec.kind, tables: o.tables, idx: o.tables.__idx || [], rec };
    D.modern = has(D, 'textnums', 'text_id') || has(D, 'image_nums', 'bid');
    let locale = ''; try { const r = await q(D, 'SELECT locale FROM android_metadata LIMIT 1'); locale = r[0] ? r[0].locale : ''; } catch (e) {}
    const bc = (D.tables.books || []).filter(c => c !== 'desc' || true);
    const books = await q(D, 'SELECT ' + bc.map(c => '"' + c + '"').join(',') + ' FROM books ORDER BY sort, _id');
    let sample = books.map(b => (b.title || '') + ' ' + (b.author || '')).join(' ');
    try { const r = await q(D, 'SELECT substr(transl2,1,400) AS t FROM texts WHERE length(transl2) > 20 LIMIT 6 OFFSET 3'); for (const x of r) sample += ' ' + x.t; } catch (e) {}
    D.lang = detectLang(locale, sample, rec.name); D.locale = locale;
    try { const r = await q(D, "SELECT translit || comment AS t FROM texts WHERE length(comment) > 50 LIMIT 1 OFFSET 5"); D.entityMode = !!(r[0] && /&#\d+;/.test(r[0].t || '')); } catch (e) { D.entityMode = false; }
    D.songs = has(D, 'songs') ? await q(D, 'SELECT * FROM songs ORDER BY book_id, sort, _id') : [];
    D.chapters = has(D, 'chapters') ? await q(D, 'SELECT _id, book_id, song, number, title, text_size, purport_size, prev_size_t, prev_size_p FROM chapters ORDER BY book_id, _id') : [];
    D.books = books;
    try { D.hasFts = await GBDB.hasFts(n); } catch (e) { D.hasFts = false; }
    // image presence per book
    D.imgKinds = {};
    if (has(D, 'image_nums')) {
      try {
        const bcol = has(D, 'image_nums', 'bid') ? 'bid' : 'book_id', kcol = has(D, 'image_nums', 'kind') ? 'kind' : '1';
        for (const r of await q(D, 'SELECT ' + bcol + ' AS b, ' + kcol + ' AS k, count(*) AS n FROM image_nums GROUP BY 1, 2')) {
          (D.imgKinds[r.b] = D.imgKinds[r.b] || {})[r.k || 1] = r.n;
        }
      } catch (e) {}
    }
    lib.dbs.set(D.id, D);
    return D;
  }

  function bookKey(D, b) {
    const abbr = String(b.web_abbrev || b.type || '').trim().toUpperCase();
    return D.lang + '|' + abbr + '|' + String(b.title || '').trim().normalize('NFC').toLowerCase();
  }
  function rebuild() {
    const map = new Map();
    for (const D of lib.dbs.values()) {
      for (const b of D.books) {
        if (b._id >= 1000 && !b.title) continue;
        const key = bookKey(D, b);
        let B = map.get(key);
        if (!B) {
          B = { key, lang: D.lang, title: b.title || '(untitled)', author: b.author || '', desc: b.desc || '', type: b.type || '', abbr: String(b.web_abbrev || b.type || '').toUpperCase(),
            webAbbrev: String(b.web_abbrev || b.type || '').toLowerCase(), compare: String(b.compare_code || b.type || '').toUpperCase(), levels: b.levels || 3, isSongBook: !!b.isSongBook,
            hasSanskrit: !!b.hasSanskrit, sort: b.sort || 0, parts: [], songMap: new Map(), chapters: [], imgKinds: {}, textSize: 0 };
          map.set(key, B);
        }
        const part = { D, bookId: b._id, row: b };
        B.parts.push(part); B.textSize += (b.text_size || 0) + (b.purport_size || 0);
        for (const s of D.songs) if (s.book_id == b._id) {
          const k = String(s.song);
          if (!B.songMap.has(k)) B.songMap.set(k, { song: k, name: s.songname || '', subtitle: s.subtitle || '', sort: s.sort != null ? s.sort : num(s.song), part, size: (s.text_size || 0) + (s.purport_size || 0) });
        }
        const seen = new Set(B.chapters.map(c => c.song + '|' + c.ch));
        for (const c of D.chapters) if (c.book_id == b._id) {
          const k = String(c.song) + '|' + c.number; if (seen.has(k)) continue; seen.add(k);
          B.chapters.push({ song: String(c.song), ch: c.number, title: c.title || '', size: (num(c.text_size) || 0) + (num(c.purport_size) || 0), part, prevSize: (num(c.prev_size_t) || 0) + (num(c.prev_size_p) || 0) });
        }
        const ik = D.imgKinds[b._id]; if (ik) for (const k in ik) B.imgKinds[k] = (B.imgKinds[k] || 0) + ik[k];
      }
    }
    const books = Array.from(map.values());
    for (const B of books) {
      B.chapters.sort((a, b) => (num(a.song) - num(b.song)) || (String(a.song) < String(b.song) ? -1 : String(a.song) > String(b.song) ? 1 : 0) || (a.ch - b.ch));
      B.chapters.forEach((c, i) => { c.idx = i; c.book = B; });
      // songs (cantos): from songs tables, or from distinct chapter songs when a book spans several
      const distinct = Array.from(new Set(B.chapters.map(c => c.song)));
      if (!B.songMap.size && distinct.length > 1) distinct.forEach(s => B.songMap.set(s, { song: s, name: '', subtitle: '', sort: num(s), part: B.chapters.find(c => c.song === s).part }));
      B.songs = Array.from(B.songMap.values()).sort((a, b) => (num(a.song) - num(b.song)) || (a.sort - b.sort));
      B.hasSongs = B.songs.length > 0;
      B.hasImages = Object.keys(B.imgKinds).length > 0;
    }
    books.sort((a, b) => (a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : 0) || (a.sort - b.sort) || a.title.localeCompare(b.title));
    lib.books = books;
    document.dispatchEvent(new CustomEvent('gb:library'));
  }
  lib.rebuild = rebuild;
  lib.langs = () => Array.from(new Set(lib.books.map(b => b.lang)));
  lib.book = key => lib.books.find(b => b.key === key) || null;
  lib.songChapters = (B, song) => B.chapters.filter(c => song == null || c.song === String(song));

  // ---------- texts ----------
  const textCache = new Map();
  lib.chapterTexts = async function (B, ch) {
    const ck = B.key + '|' + ch.song + '|' + ch.ch;
    if (textCache.has(ck)) return textCache.get(ck);
    const { D, bookId } = ch.part;
    const a = lib.eq('book_id', bookId), s = lib.eq('song', ch.song), c = lib.eq('ch_no', ch.ch);
    const cols = ['_id', 'txt_no', 'preview', 'haspurport', 'text_seq_no', 'text_size'].concat(has(D, 'textnums', 'text_offset') ? ['text_offset'] : []).concat(has(D, 'textnums', 'images') ? ['images'] : []).concat(has(D, 'textnums', 'text_id') ? ['text_id'] : []);
    let rows = await q(D, 'SELECT ' + cols.join(',') + ' FROM textnums WHERE ' + a.sql + ' AND ' + s.sql + ' AND ' + c.sql + ' ORDER BY text_seq_no, _id', a.bind.concat(s.bind, c.bind));
    // some files number text_seq_no per chapter, others per book; keep file order inside the chapter
    rows = rows.map((r, i) => ({ id: r._id, no: String(r.txt_no), preview: r.preview || '', hasPurport: !!r.haspurport, seq: r.text_seq_no, size: r.text_size || 0, offset: r.text_offset || 0, images: r.images || 0, extId: r.text_id || null, i, ch }));
    textCache.set(ck, rows);
    return rows;
  };
  lib.text = async function (D, id) {
    const r = await q(D, 'SELECT _id, sanskrit, translit, transl1, transl2, comment FROM texts WHERE _id = ?', [id]);
    return r[0] || null;
  };
  // reference label, e.g. "BG 2.7" / "SB 1.1.1"
  // canto/lila . chapter . text works keep three numbers even when a file holds one canto and has no songs table
  // (converter outputs say levels 2 or 3 there); BG-style books stay chapter.text
  const THREE_LEVEL = { SB: 1, CC: 1 };
  const songOn = (B, song) => { const s = song == null ? '' : String(song); return B.hasSongs || (!!THREE_LEVEL[B.abbr] && s !== '' && s !== 'null' && s !== '0'); };
  lib.label = function (B, song, ch, no) {
    const parts = []; const ws = songOn(B, song);
    if (ws) parts.push(String(song));
    if (ws || B.levels > 2 || B.chapters.length > 1) parts.push(ch);
    parts.push(no);
    return (B.abbr ? lib.shortAbbr(B) + ' ' : '') + parts.join('.');
  };
  // editions keep their own code (BG72 = Bhagavad-gītā As It Is, 1972 edition) but read as the work: BG 4.2
  lib.shortAbbr = B => String(B.abbr || '').replace(/^(BG|SB|CC)\d{2,4}$/, '$1');
  lib.edition = B => { const m = String(B.abbr || '').match(/^(?:BG|SB|CC)(\d{2,4})$/); return m ? (m[1].length === 2 ? '19' + m[1] : m[1]) : ''; };
  lib.chapterLabel = (B, ch) => (songOn(B, ch.song) ? ch.song + '.' : '') + ch.ch;
  lib.findChapter = (B, song, chNo) => B.chapters.find(c => String(c.song) === String(song) && String(c.ch) === String(chNo)) || null;
  lib.findTextIndex = (rows, no) => { const n = String(no); let i = rows.findIndex(r => r.no === n); if (i < 0) i = rows.findIndex(r => r.no.split('-').map(Number).some((x, j, arr) => arr.length === 2 ? Number(n) >= arr[0] && Number(n) <= arr[1] : x === Number(n))); return i; };
  // ---------- neighbours (seamless across chapters) ----------
  lib.neighbour = async function (B, ch, i, dir) {
    const rows = await lib.chapterTexts(B, ch);
    const j = i + dir;
    if (j >= 0 && j < rows.length) return { ch, i: j, row: rows[j] };
    const nc = B.chapters[ch.idx + dir]; if (!nc) return null;
    const nrows = await lib.chapterTexts(B, nc); if (!nrows.length) return null;
    const k = dir > 0 ? 0 : nrows.length - 1; return { ch: nc, i: k, row: nrows[k] };
  };
  // ---------- citations: resolve by web abbreviation / compare code / type; fail closed ----------
  lib.resolveBook = function (abbr, lang, lang2) {
    const a = String(abbr || '').trim().toUpperCase().replace(/\.$/, ''); if (!a) return null;
    const ALIAS = { 'BG': ['BG', 'BGI', 'BGA'], 'SB': ['SB', 'SBH'], 'CC': ['CC'], 'BHAGAVAD-GITA': ['BG'], 'BG.': ['BG'] };
    const want = ALIAS[a] || [a];
    const cands = lib.books.filter(b => want.includes(b.abbr) || want.includes(b.compare) || want.includes(String(b.type).toUpperCase()));
    if (!cands.length) return null;
    // the language being read first, then the language the link names, then the app language, then any
    return cands.find(b => b.lang === lang) || (lang2 && cands.find(b => b.lang === lang2)) || cands.find(b => b.lang === GB.prefs.lang) || cands[0];
  };
  lib.resolveIn = async function (B, nums) {
    if (!B) return null;
    const n = nums.map(String); let song = '1', chNo, txt;
    if (B.hasSongs) { if (n.length < 3) return null; [song, chNo, txt] = n; }
    else if (n.length >= 3) { [song, chNo, txt] = n; if (!lib.findChapter(B, song, chNo)) { chNo = n[1]; txt = n[2]; song = (B.chapters[0] || {}).song; } }
    else { chNo = n[0]; txt = n[1]; song = (B.chapters.find(c => String(c.ch) === String(chNo)) || {}).song; }
    const ch = lib.findChapter(B, song, chNo); if (!ch) return null;
    const rows = await lib.chapterTexts(B, ch); if (!txt) return rows.length ? { B, ch, i: 0 } : null;
    const i = lib.findTextIndex(rows, txt); if (i < 0) return null;
    return { B, ch, i };
  };
  lib.resolve = async function (abbr, nums, lang, lang2) { return lib.resolveIn(lib.resolveBook(abbr, lang, lang2), nums); };
  // ---------- links inside texts ----------
  // word links  gb://pro/<letter>/<slug>, gb://<letter>/<slug>                       -> word occurrences
  // text links  gb://pro../../../c/ch/v/<lang>  relative to the open text (a three-number label wins when it names
  //             another canto: older converter files dropped it), gb://pro/<book>/n/n(/n), gr://<lang>/<package>/<book>/n/n(/n)
  //             (as the English gitabases write them), /<book>/n/n(/n)
  // dead links  .../todo/...                                                          -> fail closed
  lib.BOOK_NAMES = { bg: 'Bhagavad-gītā', sb: 'Śrīmad-Bhāgavatam', cc: 'Śrī Caitanya-caritāmṛta', bs: 'Brahma-saṁhitā', svu: 'Śvetāśvatara Upaniṣad',
    ku: 'Kaṭha Upaniṣad', mu: 'Muṇḍaka Upaniṣad', vp: 'Viṣṇu Purāṇa', bau: 'Bṛhad-āraṇyaka Upaniṣad', chu: 'Chāndogya Upaniṣad', ttu: 'Taittirīya Upaniṣad',
    vs: 'Vedānta-sūtra', au: 'Aitareya Upaniṣad', gtu: 'Gopāla-tāpanī Upaniṣad', brs: 'Bhakti-rasāmṛta-sindhu', hbs: 'Hari-bhakti-sudhodaya',
    hbv: 'Hari-bhakti-vilāsa', lb: 'Laghu-bhāgavatāmṛta', iso: 'Śrī Īśopaniṣad', noi: 'The Nectar of Instruction', nod: 'The Nectar of Devotion' };
  const asciiDigits = s => String(s || '').replace(/[\u0966-\u096f]/g, d => String(d.charCodeAt(0) - 0x966)).replace(/[\u09e6-\u09ef]/g, d => String(d.charCodeAt(0) - 0x9e6));
  const isNum = p => /^\d+(-\d+)?$/.test(p);
  lib.parseLink = function (href, label, here) {
    const h = String(href || '').trim();
    if (!h) return { kind: 'none' };
    if (/^(https?:|mailto:)/i.test(h)) return { kind: 'web', href: h };
    if (/\/todo\//i.test(h)) return { kind: 'dead' };
    let m = h.match(/^gb:\/\/pro\/?((?:\.\.\/)+)(.*)$/i);
    if (m) {
      const ups = (m[1].match(/\.\.\//g) || []).length, nums = m[2].split(/[/?#]/).filter(isNum);
      let t = null;
      if (ups >= 3 && nums.length >= 3) t = nums.slice(-3);
      else if (ups === 2 && nums.length >= 2 && here) t = [String(here.song)].concat(nums.slice(-2));
      else if (nums.length && here) t = [String(here.song), String(here.ch), nums[nums.length - 1]];
      const ln = (asciiDigits(label).match(/\d+(?:\s*[-–]\s*\d+)?/g) || []).map(x => x.replace(/\s*[-–]\s*/, '-'));
      if (ln.length === 3 && t && (ln[0] !== String(t[0]) || ln[1] !== String(t[1]))) t = ln;
      return t ? { kind: 'text', abbr: null, nums: t } : { kind: 'unknown' };
    }
    m = h.match(/^gr:\/\/([a-z]{2,4})\/([a-z0-9_]+)\/([a-z0-9_]+)\/(.+)$/i);
    if (m) { const nums = m[4].split(/[/?#]/).filter(isNum); return nums.length ? { kind: 'text', abbr: m[3].toLowerCase(), nums, lang: m[1].toLowerCase(), pkg: m[2].toLowerCase() } : { kind: 'unknown' }; }
    m = h.match(/^gb:\/\/(?:pro\/)?(.*)$/i);
    if (m) {
      const parts = m[1].split(/[/?#]/).filter(Boolean);
      if (parts.length && parts.length <= 2 && !parts.some(isNum)) return { kind: 'word', href: h };
      const abbr = parts.find(p => /^[a-z][a-z0-9]{1,5}$/i.test(p)), nums = parts.filter(isNum);
      if (abbr && nums.length) return { kind: 'text', abbr: abbr.toLowerCase(), nums };
      return { kind: 'word', href: h };
    }
    m = h.match(/^\/?([a-z][a-z0-9]{1,5})\/(\d.*)$/i);
    if (m) { const nums = m[2].split(/[/?#]/).filter(isNum); if (nums.length) return { kind: 'text', abbr: m[1].toLowerCase(), nums }; }
    return { kind: 'unknown' };
  };
  lib.linkName = (L, B) => (L.abbr ? (lib.BOOK_NAMES[L.abbr] || L.abbr.toUpperCase()) : (B ? B.title : '')) + ' ' + (L.nums || []).join('.');
  lib.parseCite = function (s) {
    const m = String(s || '').match(/\b([A-Za-z\u00c0-\u024f.\-]{2,24})\s*\.?\s*(\d+)(?:[.:](\d+))?(?:[.:](\d+(?:-\d+)?))?/);
    if (!m) return null;
    const abbr = m[1].replace(/[.\-]/g, '').toUpperCase();
    const map = { BHAGAVADGITA: 'BG', GITA: 'BG', BG: 'BG', SRIMADBHAGAVATAM: 'SB', BHAGAVATAM: 'SB', SB: 'SB', CC: 'CC', ADI: 'CC', MADHYA: 'CC', ANTYA: 'CC', ISO: 'ISO', NOI: 'NOI', NOD: 'NOD' };
    return { abbr: map[abbr] || abbr, nums: [m[2], m[3], m[4]].filter(Boolean) };
  };
  // ---------- images ----------
  const KIND_TABS = { 1: 'pictures', 2: 'cards', 3: 'diagrams', 4: 'frescos' };
  lib.KIND_TABS = KIND_TABS;
  lib.images = async function (B, kind) {
    const out = [];
    for (const part of B.parts) {
      const D = part.D; if (!has(D, 'image_nums')) continue;
      if (has(D, 'image_nums', 'bid')) {
        const a = lib.eq('bid', part.bookId);
        const rows = await q(D, 'SELECT sid, cid, tnum, text_id, image_id, type, "desc" AS d FROM image_nums WHERE ' + a.sql + (has(D, 'image_nums', 'kind') ? ' AND kind = ?' : '') + ' ORDER BY rowid', a.bind.concat(has(D, 'image_nums', 'kind') ? [Number(kind)] : []));
        for (const r of rows) out.push({ D, song: String(r.sid), ch: r.cid, no: String(r.tnum), imageId: r.image_id, desc: r.d || '' });
      } else {
        const a = lib.eq('book_id', part.bookId);
        const rows = await q(D, 'SELECT song, ch_no, txt_no, image_id FROM image_nums WHERE ' + a.sql + ' ORDER BY rowid', a.bind);
        for (const r of rows) out.push({ D, song: String(r.song), ch: r.ch_no, no: String(r.txt_no), imageId: r.image_id, desc: '' });
      }
    }
    return out;
  };
  const imgUrls = new Map();
  lib.imageUrl = async function (D, imageId) {
    const k = D.id + '|' + imageId; if (imgUrls.has(k)) return imgUrls.get(k);
    let bytes = null, cap = '';
    if (has(D, 'images', 'content')) { const r = await q(D, 'SELECT content FROM images WHERE image_id = ?', [imageId]); bytes = r[0] && r[0].content; }
    else if (has(D, 'images', 'image')) { const r = await q(D, 'SELECT image, caption FROM images WHERE _id = ?', [imageId]); bytes = r[0] && r[0].image; cap = (r[0] && r[0].caption) || ''; }
    if (!bytes) return null;
    if (typeof bytes === 'string') bytes = new TextEncoder().encode(bytes);
    // many gitabases store base64 text in the blob
    const head = String.fromCharCode.apply(null, bytes.subarray(0, 8));
    if (/^(\/9j\/|iVBOR|R0lGOD|UklGR)/.test(head)) { const bin = atob(new TextDecoder().decode(bytes).replace(/\s+/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); bytes = u; }
    const type = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0x47 ? 'image/gif' : bytes[0] === 0x52 ? 'image/webp' : 'image/jpeg';
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    imgUrls.set(k, url); return url;
  };
  // ---------- refs (textrefs) ----------
  lib.refs = async function (B, ch, row) {
    const out = [];
    for (const part of B.parts) {
      const D = part.D; if (!has(D, 'textrefs')) continue;
      try {
        if (has(D, 'textrefs', 'thisBookWeb')) {
          // plain IN lists (no lower()) so the hosted files' (thisBookWeb, thisSong, thisChapter, thisTextNo) index is used
          const s = lib.eq('thisSong', ch.song), c = lib.eq('thisChapter', ch.ch), t = lib.eq('thisTextNo', row.no);
          const wa = B.webAbbrev, webs = Array.from(new Set([wa, wa.toUpperCase(), wa.charAt(0).toUpperCase() + wa.slice(1)]));
          const rows = await q(D, 'SELECT * FROM textrefs WHERE (thisBookWeb IN (' + webs.map(() => '?').join(',') + ') OR thisBook IN (?, ?)) AND ' + s.sql + ' AND ' + c.sql + ' AND ' + t.sql + ' LIMIT 3000',
            webs.concat([part.bookId, String(part.bookId)], s.bind, c.bind, t.bind));
          for (const r of rows) { const tb = lib.resolveBook(r.refbyBookWeb, B.lang); const withSong = tb ? tb.hasSongs : Number(r.refbyLevels) >= 4;
            out.push({ abbr: String(r.refbyBookWeb || '').toUpperCase(), nums: (withSong ? [r.refbySong, r.refbyChapter, r.refbyTextNo] : [r.refbyChapter, r.refbyTextNo]).filter(x => x !== null && x !== '' && x !== undefined).map(String), levels: r.refbyLevels, chapterName: r.refbyChapterName || '', text: r.refbyText || '', scroll: r.refbyScroll }); }
        } else if (has(D, 'textrefs', 'txt_id')) {
          const res = await GBDB.lookup({ dbId: D.num, table: 'textrefs', col: 'txt_id', key: row.id, offset: 0, limit: 3000, cols: '*' });
          for (const r of res.rows) { const c2 = lib.parseCite(r.name || r.link || ''); out.push({ abbr: c2 ? c2.abbr : '', nums: c2 ? c2.nums : [], chapterName: '', text: r.name || '', link: r.link || '', refId: r.ref_id, D }); }
        }
      } catch (e) { console.warn('refs', e); }
    }
    return out;
  };
  lib.refsCount = async function (B, ch, row) { try { return (await lib.refs(B, ch, row)).length; } catch (e) { return 0; } };
  // ---------- word occurrences (meanings / eind), with a local word-by-word fallback ----------
  // The Android app lists occurrences with "SELECT link, wordt, txtname, item_no FROM meanings WHERE name = ?" (rowid order);
  // some files key them by link instead. One grouped query finds which column/key form this file uses (cached), then
  // each page is a plain LIMIT/OFFSET read: an index search on hosted files, an early-stopping C scan on local ones.
  const wiKeys = new Map();
  lib.wordInfo = async function (D, link, word, offset, limit) {
    limit = limit || 40; offset = offset || 0;
    const slug = String(link || '').replace(/^gb:\/\/[^/]+\//, '').replace(/^\/+/, '');
    const keys = Array.from(new Set([slug, slug.split('/').pop(), 'gb://pro/' + slug, link, String(word || '').trim()])).filter(Boolean);
    if (has(D, 'meanings') && keys.length) {
      const ck = D.id + '|' + link + '|' + word; let hit = wiKeys.get(ck);
      if (hit === undefined) {
        hit = null;
        for (const col of ['name', 'link'].filter(c => has(D, 'meanings', c))) {
          let got = []; try { got = await q(D, 'SELECT "' + col + '" AS k, count(*) AS n FROM meanings WHERE "' + col + '" IN (' + keys.map(() => '?').join(',') + ') GROUP BY 1', keys); } catch (e) {}
          const k = keys.find(k => got.some(r => r.k === k && r.n > 0));
          if (k) { hit = { col, key: k, total: got.find(r => r.k === k).n }; break; }
        }
        wiKeys.set(ck, hit);
      }
      if (hit) {
        const rows = await q(D, 'SELECT * FROM meanings WHERE "' + hit.col + '" = ? ORDER BY rowid LIMIT ? OFFSET ?', [hit.key, limit, offset]);
        return { source: 'meanings', total: hit.total, rows: rows.map(r => ({ textId: r.txt_id, name: r.txtname || '', word: r.word || word, meaning: r.wordt || '', link: hit.col === 'name' ? (r.link || '') : '' })) };
      }
    }
    if (has(D, 'links', 'word') && slug) {
      try { const r = await q(D, 'SELECT word FROM links WHERE link IN (?, ?) LIMIT 1', [slug, link]); if (r[0] && r[0].word) word = r[0].word; } catch (e) {}
    }
    const all = await GBDB.wbwLookup(D.num, word || slug.split('/').pop());
    return { source: 'wbw', total: all.length, rows: all.slice(offset, offset + limit).map(([id, mean]) => ({ textId: id, name: '', word, meaning: mean })) };
  };
  // where does an occurrence row point? texts._id first, then the row's own text link or label (fails closed: null)
  lib.locateOcc = async function (D, x) {
    if (x.textId != null && x.textId !== '') { try { const t = await lib.locate(D, x.textId); if (t) return t; } catch (e) {} }
    const tryRes = async (abbr, nums) => { if (!abbr || !nums.length) return null; const r = await lib.resolve(abbr, nums, D.lang); if (!r) return null; const rows = await lib.chapterTexts(r.B, r.ch); return { B: r.B, ch: r.ch, i: r.i, row: rows[r.i] }; };
    if (x.link) {
      const parts = String(x.link).replace(/^[a-z]+:\/\/+/i, '').split(/[/?#]/).filter(Boolean);
      const abbr = parts.find(p => /^[a-z]{2,6}$/i.test(p)), nums = parts.filter(p => /^\d+(-\d+)?$/.test(p));
      const t = await tryRes(abbr, nums); if (t) return t;
    }
    const c = lib.parseCite(x.name || ''); if (c) { const t = await tryRes(c.abbr, c.nums); if (t) return t; }
    return null;
  };
  // where is a text (by texts._id) in its book?
  lib.locate = async function (D, textId) {
    const r = await q(D, 'SELECT _id, book_id, song, ch_no, txt_no FROM textnums WHERE _id = ?', [textId]);
    if (!r[0]) return null;
    const b = D.books.find(x => x._id == r[0].book_id); if (!b) return null;
    const B = lib.book(bookKey(D, b)); if (!B) return null;
    const ch = lib.findChapter(B, r[0].song, r[0].ch_no); if (!ch) return null;
    const rows = await lib.chapterTexts(B, ch); const i = rows.findIndex(x => x.id == textId);
    return i < 0 ? null : { B, ch, i, row: rows[i] };
  };

  // ---------- loading ----------
  lib.addFiles = async function (files) {
    const added = [];
    for (const f of files) {
      if (!/\.(db|gitabase|sqlite|sqlite3|gdb)$/i.test(f.name) && f.size < 1024) continue;
      const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
      if (String.fromCharCode.apply(null, head.subarray(0, 15)) !== 'SQLite format 3') { GB.ui.toast(f.name + ': not a book file'); continue; }
      const dup = Array.from(lib.dbs.values()).find(D => D.name === f.name && D.size === f.size);
      if (dup) { GB.ui.toast(f.name + ' is already in your library'); continue; }
      const rec = { id: GB.uid(), name: f.name, size: f.size, added: Date.now(), kind: 'local', blob: f };
      try {
        const D = await openDb(rec, { blob: f });
        if (!D.books.length) { GB.ui.toast(f.name + ': no books inside'); await GBDB.close(D.num); lib.dbs.delete(D.id); continue; }
        await GB.store.put('files', rec);
        added.push(D);
      } catch (e) { console.error(e); GB.ui.toast(f.name + ': ' + e.message); }
    }
    if (added.length) rebuild();
    return added;
  };
  lib.removeDb = async function (id) {
    const D = lib.dbs.get(id); if (!D) return;
    try { await GBDB.close(D.num); } catch (e) {}
    lib.dbs.delete(id); await GB.store.del('files', id); textCache.clear(); rebuild();
  };
  lib.boot = async function () {
    await GBDB.init();
    // hosted mode: a catalogue of chunked files next to index.html
    if (/^https?:$/.test(location.protocol)) {
      try {
        const r = await fetch('library/catalog.json', { cache: 'no-cache' });
        if (r.ok) {
          const cat = await r.json(); lib.hosted = true; lib.catalog = cat;
          for (const f of cat.files || []) {
            try { await openDb({ id: 'h:' + f.id, name: f.name, size: f.size, kind: 'hosted' }, { base: new URL(f.base, document.baseURI).href, size: f.size, chunkSize: f.chunkSize }); }
            catch (e) { console.error('hosted file', f.name, e); }
          }
          rebuild(); return;
        }
      } catch (e) { /* no catalogue: local mode */ }
    }
    const recs = (await GB.store.all('files')).sort((a, b) => a.added - b.added);
    for (const rec of recs) {
      try { await openDb(rec, { blob: rec.blob }); } catch (e) { console.error('reopen', rec.name, e); rec.broken = String(e.message || e); lib.broken = (lib.broken || []).concat(rec); }
    }
    rebuild();
  };
})(window.GB);
