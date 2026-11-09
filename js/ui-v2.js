/* Vaishnava Texts, v2 pieces: reading panel (Aa), go to verse, verse picture card, save a book for offline,
   Verse order editor (Settings > Advanced) and the accent colours. */
'use strict';
(function (GB) {
  const { h, $ } = GB;
  const lib = GB.lib, L = GB.left;
  const ico = n => h('span.ico', { html: GB.icons.svg(n) });
  const seg = (opts, val, onPick, cls) => GB.pill(h('div.seg' + (cls ? '.' + cls : ''), { role: 'radiogroup' }, opts.map(([v, t, dis]) => h('button.seg-b' + (v === val ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': v === val ? 'true' : 'false', disabled: !!dis, onclick: () => onPick(v) }, t))), 'seg:' + opts.map(o => o[0]).join('|'));
  const sw = (on, onToggle, label) => h('button.sw2' + (on ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label || '', onclick: onToggle }, h('i'));
  const narrow = () => !GB.isWide() || window.innerWidth < 700;

  // ================= accents =================
  GB.applyAccent = function () {
    const P = GB.prefs, A = GB.ACCENTS[P.accent] || GB.ACCENTS.tulasi, st = document.body.style, N = !!P.night;
    document.documentElement.dataset.accent = A.key;
    const ink = N ? GB.accentInk(true) : A.day;
    const vars = A.key === 'tulasi' ? {} : {
      '--accent': ink, '--link': N ? A.night : A.day, '--chip-b': N ? A.night : A.day, '--tab-on': N ? A.night : A.day,
      '--hdr': N ? A.hdrN : A.hdr, '--tab-bar': N ? A.hdrN : A.hdr, '--cmp-bar': N ? A.hdrN : A.hdr,
      '--transl': N ? A.night : 'color-mix(in oklab, ' + A.day + ' 82%, #000)',
      '--hdr-grad': 'linear-gradient(180deg, color-mix(in oklab, ' + (N ? A.hdrN : A.hdr) + ' 92%, #fff), ' + (N ? A.hdrN : A.hdr) + ')',
      '--wash': 'color-mix(in oklab, ' + ink + ' 12%, transparent)', '--hover': 'color-mix(in oklab, ' + ink + ' 7%, transparent)', '--sel': 'color-mix(in oklab, ' + ink + ' 55%, #fff)'
    };
    for (const k of ['--accent', '--link', '--chip-b', '--tab-on', '--hdr', '--tab-bar', '--cmp-bar', '--transl', '--hdr-grad', '--wash', '--hover', '--sel']) { if (vars[k]) st.setProperty(k, vars[k]); else st.removeProperty(k); }
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = N ? A.hdrN : A.hdr;
    if (GB.artwork && GB.artwork.clear) GB.artwork.clear();
  };
  GB.setAccent = function (k) { GB.setPref('accent', k); GB.applyAccent(); GB.home.render(); GB.reader.rerender(); GB.refreshAll(); };
  const accentDots = () => h('div.accents', null, Object.values(GB.ACCENTS).map(A => h('button.adot' + (GB.prefs.accent === A.key ? '.on' : ''), { type: 'button', title: A.name, 'aria-label': A.name, style: { '--c': A.day, '--cn': A.night }, onclick: () => { GB.setAccent(A.key); redrawPanel(); } })));

  // ================= reading panel (Aa) =================
  let panel = null;
  function redrawPanel() { if (panel) panel.fill(); }
  GB.readPanel = function () {
    if (panel) return;
    const box = h('div.rp');
    const s = GB.ui.sheet({ title: 'Reading', content: box, cls: 'rpsheet', onClose: () => { panel = null; } });
    const R = GB.reader;
    function apply(reopen) { if (reopen) return R.setMode(GB.prefs.readMode).then(fill); R.rerender(); fill(); }
    function fill() {
      const P = GB.prefs, cur = R.current(), B = cur && cur.B, verseBook = !cur || !R.isPaged();
      const m = GB.parts.mode(); box.innerHTML = '';
      if (verseBook) box.append(h('div.rp-row', null, seg([['verse', 'Verse by verse'], ['cont', 'Continuous']], P.readMode, v => { if (v !== P.readMode) { GB.setPref('readMode', v); apply(true); } }, 'wide')));
      const pre = GB.parts.presetOf(m);
      box.append(h('div.rp-sec', null, h('div.rp-h', { text: m === 'cont' ? 'Show while reading continuously' : 'Show' }),
        h('div.rp-presets', null, [['full', 'Full'], ['story', 'Story'], ['recite', 'Recite']].map(([k, t]) => h('button.chip2' + (pre === k ? '.on' : ''), { type: 'button', onclick: () => { GB.parts.preset(m, k); apply(); } }, t))),
        h('div.rp-checks', null, GB.parts.order().map(k => { const on = !!GB.parts.shown(m)[k];
          return h('label.rp-check', null, h('input', { type: 'checkbox', checked: on, onchange: e => { GB.parts.set(m, k, e.target.checked); apply(); } }), h('span', { text: GB.parts.NAMES[k] })); }))));
      const choices = B ? R.secondChoices(B) : [];
      if (choices.length) {
        const B2 = R.secondBook(B);
        box.append(h('div.rp-sec', null, h('div.rp-line', null, h('div.rp-h', { text: 'Second language' }), sw(P.second, () => { GB.setPref('second', !P.second); apply(); }, 'Second language')),
          P.second && choices.length > 1 ? h('div.rp-row', null, seg(choices.map(x => [x.key, lib.LANG_NAMES[x.lang] || x.lang]), B2 && B2.key, v => { GB.setPref('secondBook', v); apply(); })) : null,
          P.second ? h('div.rp-row', null, seg([['stack', 'Stacked'], ['side', 'Side by side', narrow()]], narrow() ? 'stack' : P.secondLayout, v => { GB.setPref('secondLayout', v); apply(); })) : null,
          P.second && narrow() ? h('div.rp-note', { text: 'Phones always stack.' }) : null));
      }
      box.append(h('div.rp-sec.rp-grid', null,
        h('div.rp-cell', null, h('div.rp-h', { text: 'Text size' }), h('div.rp-size', null, h('button.rp-sb', { type: 'button', 'aria-label': 'Smaller text', onclick: () => { GB.fontStep(-1); fill(); } }, h('span.a1', { text: 'A' })), h('b', { text: String(P.fontSize) }), h('button.rp-sb', { type: 'button', 'aria-label': 'Larger text', onclick: () => { GB.fontStep(1); fill(); } }, h('span.a2', { text: 'A' })))),
        h('div.rp-cell', null, h('div.rp-h', { text: 'Theme' }), seg([['day', 'Day'], ['night', 'Night']], P.night ? 'night' : 'day', v => { if ((v === 'night') !== !!P.night) { GB.toggleNight(); fill(); } }))));
      box.append(h('div.rp-sec', null, h('div.rp-h', { text: 'Accent' }), accentDots()));
      box.append(h('button.rp-more', { type: 'button', onclick: () => { s.close(); GB.verseOrderPage(); } }, ico('list'), h('span', { text: 'Verse order' }), h('span.rp-arr', { text: '›' })));
    }
    panel = { fill, close: s.close }; fill();
  };

  // ================= go to verse: canto . chapter . verse boxes, jumps as soon as a number changes =================
  // go to verse exists only for the three verse works
  const GOTO = { BG: 1, SB: 1, CC: 1 };
  GB.canGoto = B => !!(B && (GOTO[lib.shortAbbr(B)] || GOTO[String(B.type || '').toUpperCase()]));
  GB.gotoBooks = () => lib.books.filter(GB.canGoto);
  function verseBooks(lang) {
    const seen = new Map();
    for (const B of lib.books) { if (!GB.canGoto(B)) continue; const k = B.abbr || B.key; if (!seen.has(k) || (B.lang === lang && seen.get(k).lang !== lang)) seen.set(k, B); }
    return Array.from(seen.values());
  }
  const lastNum = no => { const m = String(no).match(/(\d+)(?!.*\d)/); return m ? Number(m[1]) : 0; };
  const firstNum = no => { const m = String(no).match(/\d+/); return m ? Number(m[0]) : 0; };
  GB.gotoVerse = async function (ctx) {
    ctx = ctx || {}; const R = GB.reader; const cur = R.current();
    const last = () => { const e = Array.from(GB.reading.map.values()).filter(x => GB.canGoto(lib.book(x.id))).sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0]; return e ? lib.book(e.id) : null; };
    const lang = GB.home && GB.home.curLang ? GB.home.curLang() : '';
    let B = [ctx.B, cur && cur.B].find(GB.canGoto) || last() || GB.gotoBooks().find(x => !lang || x.lang === lang) || GB.gotoBooks()[0];
    if (!B) { GB.ui.toast('Go to verse works in Bhagavad-gītā, Śrīmad-Bhāgavatam and Caitanya-caritāmṛta'); return; }
    if (ctx.B !== B) ctx = {};
    const box = h('div.gv'); const s = GB.ui.sheet({ title: 'Go to verse', content: box, cls: 'gvsheet' });
    let st = null, seq = 0;
    const songsOf = B => B.hasSongs ? B.songs.map(x => x.song) : Array.from(new Set(B.chapters.map(c => String(c.song)))).filter(x => x && x !== 'null' && x !== '0');
    async function init(B2, at) {
      B = B2; const songs = songsOf(B); const three = songs.length > 0 && (B.hasSongs || songs.length > 1 || ['SB', 'CC'].includes(B.abbr));
      let ch = (at && at.ch && at.B === B) ? at.ch : (cur && cur.B === B ? cur.ch : null);
      const rd = GB.reading.get(B); if (!ch && rd) ch = lib.findChapter(B, rd.song, rd.ch); if (!ch) ch = B.chapters[0];
      const rows = await lib.chapterTexts(B, ch);
      let i = (at && at.ch === ch && at.i != null) ? at.i : (cur && cur.B === B && cur.ch === ch ? cur.i : (rd && rd.ch === String(ch.ch) && rd.song === String(ch.song) ? Math.max(0, lib.findTextIndex(rows, rd.no)) : 0));
      st = { three, songs, song: String(ch.song), ch, rows, i: Math.max(0, i) };
      draw();
    }
    const chaptersIn = song => B.chapters.filter(c => !st.three || String(c.song) === String(song));
    // a box only ever holds a number from min to max: a digit that would make it invalid or too big is not typed at all
    function numBox(label, val, max, onSet, min) {
      min = min == null ? 1 : min;
      const inp = h('input.gv-in', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', value: String(val), placeholder: label, 'aria-label': label + ' (' + min + ' to ' + max + ')', enterkeyhint: 'go', maxlength: String(String(max).length) });
      const ok = v => v === '' || (/^\d+$/.test(v) && !(v.length > 1 && v[0] === '0') && !(v === '0' && min > 0) && Number(v) <= max);
      let last = inp.value;
      const fire = GB.debounce(() => { const v = parseInt(inp.value, 10); if (!isNaN(v) && v >= min && v <= max) onSet(v); }, 220);
      inp.addEventListener('beforeinput', e => {
        if (!e.inputType || !e.inputType.startsWith('insert')) return;
        const v = inp.value, a = inp.selectionStart, z = inp.selectionEnd, add = e.data != null ? e.data : '';
        if (!ok(v.slice(0, a) + add + v.slice(z))) e.preventDefault();
      });
      inp.addEventListener('input', () => { if (!ok(inp.value)) { inp.value = last; return; } last = inp.value; fire(); });
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('blur', () => { const v = parseInt(inp.value, 10); if (isNaN(v) || v < min) { inp.value = String(val); last = inp.value; } });
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(min, Math.min(max, (parseInt(inp.value, 10) || min) + (e.key === 'ArrowUp' ? 1 : -1))); inp.value = String(v); last = inp.value; fire(); }
        if (e.key === 'Enter') s.close();
      });
      return h('label.gv-f', null, h('span.gv-l', { text: label }), inp, h('span.gv-max', { text: 'of ' + max }));
    }
    async function jump() {
      const my = ++seq; const row = st.rows[st.i]; if (!row) return;
      preview.textContent = GB.ut(row.preview || ''); ref.textContent = lib.label(B, st.ch.song, st.ch.ch, row.no);
      await GB.reader.open(B, st.ch, st.i, { noAsk: true }); if (my !== seq) return;
      if (GB.isWide()) { const top = L.top(); if (!top || top.kind !== 'chapter' || top.ch !== st.ch) GB.chapter.open(B, st.ch, st.i); }
    }
    const ref = h('div.gv-ref'), preview = h('div.gv-prev');
    function draw() {
      box.innerHTML = '';
      // work (BG · SB · CC), then its language, then the edition when a language has two (BG As It Is / 1972)
      const all = GB.gotoBooks(), work = lib.shortAbbr(B);
      const works = ['BG', 'SB', 'CC'].filter(w => all.some(x => lib.shortAbbr(x) === w));
      const ofWork = w => all.filter(x => lib.shortAbbr(x) === w);
      const pick = (w, lang, ed) => { const c = ofWork(w); return c.find(x => x.lang === lang && lib.edition(x) === ed) || c.find(x => x.lang === lang && !lib.edition(x)) || c.find(x => x.lang === lang) || c.find(x => !lib.edition(x)) || c[0]; };
      const langs = Array.from(new Set(ofWork(work).map(x => x.lang)));
      const eds = ofWork(work).filter(x => x.lang === B.lang);
      const rows = h('div.gv-books');
      if (works.length > 1) rows.append(seg(works.map(w => [w, w]), work, w => init(pick(w, B.lang, '')), 'wide'));
      rows.append(seg(langs.map(l => [l, (lib.LANG_NAMES && lib.LANG_NAMES[l]) || l]), B.lang, l => init(pick(work, l, lib.edition(B))), 'wide'));
      if (eds.length > 1) rows.append(seg(eds.map(x => [x.key, lib.edition(x) || 'Current']), B.key, k => init(lib.book(k)), 'wide'));
      box.append(rows);
      const f = h('div.gv-fields');
      if (st.three) {
        const sNums = st.songs.map(Number).filter(n => !isNaN(n)); const maxS = Math.max(...sNums);
        f.append(numBox(B.lang === 'eng' || !B.hasSongs ? 'Canto' : 'Canto', Number(st.song), maxS, async v => { const sg = String(v); const chs = chaptersIn(sg); if (!chs.length) return; st.song = sg; st.ch = chs[0]; st.rows = await lib.chapterTexts(B, st.ch); st.i = 0; redrawNums(); jump(); }), h('span.gv-dot', { text: '.' }));
      }
      const chs = chaptersIn(st.song); const chMin = Math.min(...chs.map(c => Number(c.ch))), chMax = Math.max(...chs.map(c => Number(c.ch)));
      f.append(numBox('Chapter', Number(st.ch.ch), chMax, async v => { const c = chs.find(x => Number(x.ch) === v) || chs.reduce((a, x) => Math.abs(Number(x.ch) - v) < Math.abs(Number(a.ch) - v) ? x : a); st.ch = c; st.rows = await lib.chapterTexts(B, c); st.i = 0; redrawNums(); jump(); }, chMin), h('span.gv-dot', { text: '.' }));
      const vMax = st.rows.length ? lastNum(st.rows[st.rows.length - 1].no) : 1, vMin = st.rows.length ? Math.min(1, firstNum(st.rows[0].no)) : 1;
      f.append(numBox('Verse', st.rows[st.i] ? firstNum(st.rows[st.i].no) : 1, Math.max(vMin, vMax), v => { const k = lib.findTextIndex(st.rows, String(v)); st.i = k >= 0 ? k : st.rows.findIndex(r => firstNum(r.no) >= v); if (st.i < 0) st.i = st.rows.length - 1; jump(); }, vMin));
      box.append(f, h('div.gv-out', null, ref, preview), h('div.gv-hint', { text: 'Changes jump straight there. Arrow keys step, Enter closes.' }));
      const row = st.rows[st.i]; if (row) { ref.textContent = lib.label(B, st.ch.song, st.ch.ch, row.no); preview.textContent = GB.ut(row.preview || ''); }
      setTimeout(() => { const ins = box.querySelectorAll('.gv-in'); const last = ins[ins.length - 1]; if (last && !matchMedia('(pointer: coarse)').matches) last.focus(); }, 60);
    }
    function redrawNums() { const keep = document.activeElement && document.activeElement.getAttribute('aria-label'); draw(); if (keep) { const e = box.querySelector('.gv-in[aria-label="' + keep + '"]'); if (e) { e.focus(); const v = e.value; e.value = ''; e.value = v; } } }
    await init(B, ctx);
  };
  // "10.14.8", "SB 10.14.8", "bg 2.13": resolve in the library
  GB.parseRef = function (q) {
    const m = String(q || '').trim().match(/^(?:([a-z]{2,4})\s*)?(\d+(?:[.:\s]\d+){1,2})$/i); if (!m) return null;
    return { abbr: m[1] ? m[1].toUpperCase() : null, nums: m[2].split(/[.:\s]/).filter(Boolean) };
  };
  GB.resolveRef = async function (q) {
    const r = GB.parseRef(q); if (!r) return null; const cur = GB.reader.current(); const lang = GB.home.curLang() || (cur && cur.B.lang);
    const tryAbbr = async a => { try { return await lib.resolve(a, r.nums, lang); } catch (e) { return null; } };
    if (r.abbr) return tryAbbr(r.abbr);
    const pref = r.nums.length === 3 ? ['SB', 'CC'] : ['BG'];
    if (cur && cur.B.abbr) pref.unshift(cur.B.abbr);
    for (const a of pref) { const x = await tryAbbr(a); if (x) return x; }
    return null;
  };

  // ================= share a verse as a picture =================
  function wrapLines(ctx, text, maxW) {
    const out = []; for (const para of String(text).split(/\n+/)) { const words = para.split(/\s+/).filter(Boolean); let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
      if (line) out.push(line); }
    return out;
  }
  GB.shareCard = async function (cur, verseEl) {
    cur = cur || GB.reader.current(); if (!cur) return; verseEl = verseEl || GB.reader.curVerse(); if (!verseEl) return;
    if (GB.reader.focusVerse) GB.reader.focusVerse(verseEl); cur = GB.reader.current();
    const txt = sel => { const e = verseEl.querySelector(sel); return e ? e.innerText.replace(/\s+\n/g, '\n').trim() : ''; };
    const skt = txt('#verseSanskrit') || txt('.verseSanskrit'), tl = txt('#verseTranslit') || txt('.verseTranslit'), tr = txt('#verseTransl2') || txt('.verseTransl2');
    const label = lib.label(cur.B, cur.ch.song, cur.ch.ch, cur.row.no);
    await document.fonts.ready;
    const A = GB.ACCENTS[GB.prefs.accent] || GB.ACCENTS.tulasi;
    const W = 1080, PAD = 96, cv = document.createElement('canvas'); const c = cv.getContext('2d');
    const dev = s => /[\u0900-\u097F]/.test(s);
    const F = { skt: '500 40px "Tiro Devanagari Sanskrit", "Noto Serif Devanagari", serif', tl: 'italic 36px Diakritics, Georgia, serif', tr: s => (dev(s) ? '600 40px "Noto Serif Devanagari", "Tiro Devanagari Hindi", serif' : 'bold 42px Diakritics, Georgia, serif') };
    const blocks = [];
    const measure = () => { const tmp = document.createElement('canvas').getContext('2d'); let y = 0; const lay = [];
      const add = (font, text, lh, gap, color, align) => { tmp.font = font; const lines = wrapLines(tmp, text, W - PAD * 2); lay.push({ font, lines, lh, color, align, y }); y += lines.length * lh + gap; };
      if (skt) add(F.skt, skt, 62, 28, '#39405c', 'center');
      if (tl && !dev(tl)) add(F.tl, tl, 50, 40, '#8a5a1c', 'center');
      if (tr) add(F.tr(tr), tr, dev(tr) ? 64 : 58, 0, A.day, 'left');
      return { lay, h: y };
    };
    const m = measure(); const H = Math.max(1080, Math.min(2400, m.h + 360));
    cv.width = W; cv.height = H;
    c.fillStyle = '#fbf8f1'; c.fillRect(0, 0, W, H);
    c.fillStyle = A.hdr; c.fillRect(0, 0, W, 14); c.fillRect(0, H - 14, W, 14);
    c.fillStyle = '#c18b2f'; c.font = '700 34px "Reader Display", Diakritics, Georgia, serif'; c.textAlign = 'center'; c.fillText(label, W / 2, 132);
    c.fillRect(W / 2 - 40, 158, 80, 3);
    let y0 = 230 + Math.max(0, (H - 360 - m.h) / 2);
    for (const b of m.lay) { c.font = b.font; c.fillStyle = b.color; c.textAlign = b.align; c.textBaseline = 'alphabetic';
      b.lines.forEach((ln, k) => c.fillText(ln, b.align === 'center' ? W / 2 : PAD + (b.color === A.day ? 22 : 0), y0 + b.y + k * b.lh + b.lh * .75));
      if (b.color === A.day) { c.fillStyle = '#c18b2f'; c.fillRect(PAD, y0 + b.y + 8, 5, b.lines.length * b.lh - 4); } }
    c.fillStyle = '#7b8580'; c.font = '500 26px Roboto, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(GB.ut(cur.B.title) + '  ·  ' + GB.APP_NAME, W / 2, H - 70);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const url = URL.createObjectURL(blob); const name = label.replace(/\s+/g, '_') + '.png';
    const file = new File([blob], name, { type: 'image/png' });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    const buttons = [{ label: 'Close', value: null }, { label: 'Save image', onClick: () => { const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); return false; } }];
    if (canShare) buttons.push({ label: 'Share', onClick: () => { navigator.share({ files: [file], title: label }).catch(() => {}); return false; } });
    GB.ui.dialog({ title: 'Verse picture', body: h('div.card-prev', null, h('img', { src: url, alt: 'Picture of ' + label })), buttons, cls: 'carddlg', onClose: () => setTimeout(() => URL.revokeObjectURL(url), 2000) });
  };

  // ================= save a book for offline =================
  const OFF = GB.offline = { saved: new Set(), busy: false };
  OFF.files = B => Array.from(new Set(B.parts.map(p => p.D))).map(D => (lib.catalog && (lib.catalog.files || []).find(f => 'h:' + f.id === D.id)) || null).filter(Boolean);
  OFF.can = B => !!(lib.hosted && OFF.files(B).length && 'caches' in window);
  OFF.has = B => OFF.files(B).every(f => OFF.saved.has(f.id + '|' + f.size));
  OFF.load = async () => { (await GB.store.kvGet('offlineFiles', [])).forEach(k => OFF.saved.add(k)); };
  OFF.download = async function (B) {
    if (OFF.busy) { GB.ui.toast('A download is already running'); return; }
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) { GB.ui.toast('Reload the page once, then try again (the offline store starts after the first visit)', 4000); return; }
    const files = OFF.files(B); const total = files.reduce((a, f) => a + f.size, 0);
    if (OFF.has(B)) { if (!(await GB.ui.confirm('Saved for offline', GB.ut(B.title) + ' is already on this device (' + GB.fmtSize(total) + '). Check it again?', 'Check'))) return; }
    else if (!(await GB.ui.confirm('Save for offline', 'Download ' + GB.ut(B.title) + ' (' + GB.fmtSize(total) + ') to this device? Use Wi-Fi for big books.', 'Download'))) return;
    const urls = []; for (const f of files) { const n = Math.ceil(f.size / f.chunkSize); const base = new URL(f.base, document.baseURI).href; for (let i = 0; i < n; i++) urls.push(base + String(i).padStart(5, '0') + '.bin'); }
    let done = 0, stop = false, failed = 0;
    const bar = h('i'), txt = h('span.off-t', { text: '0%' });
    const box = h('div.off', null, h('div.off-title', { text: GB.ut(B.title) }), h('div.off-bar', null, bar), h('div.off-row', null, txt, h('button.btn.small', { type: 'button', text: 'Cancel', onclick: () => { stop = true; s.close(); } })));
    const s = GB.ui.sheet({ title: 'Saving for offline', content: box, onClose: () => { stop = true; } });
    OFF.busy = true;
    const step = () => { const p = done / urls.length; bar.style.width = (p * 100).toFixed(1) + '%'; txt.textContent = Math.round(p * 100) + '% · ' + GB.fmtSize(total * p) + ' of ' + GB.fmtSize(total); };
    let k = 0;
    async function worker() { while (!stop && k < urls.length) { const u = urls[k++]; try { const r = await fetch(u); if (!r.ok) failed++; else await r.arrayBuffer(); } catch (e) { failed++; } done++; if (done % 4 === 0 || done === urls.length) step(); } }
    try { await Promise.all([worker(), worker(), worker(), worker()]); } finally { OFF.busy = false; }
    if (stop && done < urls.length) { GB.ui.toast('Download stopped. The parts already saved stay on this device.'); return; }
    if (failed) { GB.ui.toast(failed + ' parts could not be saved. Try again on a steadier connection.', 4000); s.close(); return; }
    files.forEach(f => OFF.saved.add(f.id + '|' + f.size)); await GB.store.kvSet('offlineFiles', Array.from(OFF.saved));
    s.close(); GB.ui.toast(GB.ut(B.title) + ' is saved for offline reading'); GB.refreshAll();
  };

  // ================= Verse order (Settings > Advanced) =================
  GB.verseOrderPage = function () {
    const ex = L.find('verseorder'); if (ex) { while (L.top() !== ex) L.pop(); return; }
    const pg = GB.page({ kind: 'verseorder', title: 'Verse order', cls: 'vopage' });
    let sample = null;
    async function getSample() {
      if (sample) return sample; const cur = GB.reader.current(); let B, ch, i;
      if (cur) ({ B, ch, i } = cur); else { B = lib.books.find(x => x.hasSanskrit) || lib.books[0]; if (!B) return null; ch = B.chapters[0]; i = 0; }
      const rows = await lib.chapterTexts(B, ch); const row = rows[Math.min(i, rows.length - 1)]; const t = await lib.text(ch.part.D, row.id);
      sample = { B, ch, row, t }; return sample;
    }
    const prev = h('div.vo-prev');
    async function drawPreview() {
      const sm = await getSample(); prev.innerHTML = ''; if (!sm) return;
      const v = GB.render.verse(sm.t, { B: sm.B, ch: sm.ch, row: sm.row, label: lib.label(sm.B, sm.ch.song, sm.ch.ch, sm.row.no), wbwHidden: false, notes: [], mode: 'verse' });
      v.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); v.querySelectorAll('[data-act]').forEach(e => e.removeAttribute('data-act')); prev.append(v);
    }
    function fill() {
      const P = GB.prefs; pg.body.innerHTML = '';
      pg.body.append(h('div.vo-top', null, h('div.vo-tt', null, h('div.vo-t', { text: 'Custom order' }), h('div.vo-s', { text: 'Off: the original order (Sanskrit, transliteration, word for word, translation, purport).' })),
        sw(P.customOrder, () => { GB.setPref('customOrder', !P.customOrder); changed(); }, 'Custom order')));
      const list = h('div.vo-list' + (P.customOrder ? '' : '.off'));
      const order = GB.parts.order(); const show = GB.parts.shown('verse');
      order.forEach((k, idx) => {
        const row = h('div.vo-row', { 'data-k': k }, h('span.vo-grip', { html: GB.icons.svg('grip'), title: 'Drag to move', 'aria-hidden': 'true' }), h('span.vo-name', { text: GB.parts.NAMES[k] }),
          h('span.vo-mv', null, h('button.vo-b', { type: 'button', 'aria-label': 'Move up', disabled: !P.customOrder || idx === 0, onclick: () => move(idx, idx - 1), html: GB.icons.svg('chev') }), h('button.vo-b.dn', { type: 'button', 'aria-label': 'Move down', disabled: !P.customOrder || idx === order.length - 1, onclick: () => move(idx, idx + 1), html: GB.icons.svg('chev') })),
          sw(!!show[k], () => { GB.parts.set('verse', k, !show[k]); changed(); }, 'Show ' + GB.parts.NAMES[k]));
        list.append(row); if (P.customOrder) dragify(row, list);
      });
      pg.body.append(list, h('div.vo-acts', null, h('button.btn.ghost', { type: 'button', onclick: () => { GB.setPref('order', GB.parts.LIST.slice()); GB.setPref('customOrder', false); GB.parts.preset('verse', 'full'); changed(); } }, ico('restore'), h('span', { text: 'Reset' })),
        h('span.vo-note', { text: 'Switches set what verse-by-verse reading shows. Continuous reading keeps its own set (Aa).' })),
        h('div.vo-ph', { text: 'Preview' }), prev);
      drawPreview();
    }
    function move(a, b) { const o = GB.parts.order(); const [x] = o.splice(a, 1); o.splice(b, 0, x); GB.setPref('order', o); changed(); }
    function changed() { fill(); GB.reader.rerender(); }
    function dragify(row, list) {
      const grip = row.querySelector('.vo-grip'); grip.style.touchAction = 'none';
      grip.addEventListener('pointerdown', e => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId); row.classList.add('drag'); const y0 = e.clientY; const rows = Array.from(list.children); const hgt = row.offsetHeight; const from = rows.indexOf(row); let to = from;
        const mvh = ev => { const dy = ev.clientY - y0; row.style.transform = 'translateY(' + dy + 'px)'; to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / hgt)));
          rows.forEach((r, j) => { if (r === row) return; const sh = (from < to && j > from && j <= to) ? -hgt : (from > to && j < from && j >= to) ? hgt : 0; r.style.transform = sh ? 'translateY(' + sh + 'px)' : ''; }); };
        const up = () => { grip.removeEventListener('pointermove', mvh); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); rows.forEach(r => { r.style.transform = ''; }); row.classList.remove('drag'); if (to !== from) move(from, to); };
        grip.addEventListener('pointermove', mvh); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
      });
    }
    pg.refresh = fill; fill(); L.push(pg);
  };
  const ap = GB.applyPrefs; GB.applyPrefs = function () { ap(); GB.applyAccent(); };

  // ================= breadcrumb: Library › book › canto › chapter › verse; every crumb but the last steps back there =================
  const songName = (B, song) => GB.songInfo(B, song).short;
  const bookShort = B => B.abbr && B.abbr.length <= 4 && GB.canGoto(B) ? B.abbr : GB.bookShort(B);
  const clip = (t, n) => { t = GB.ut(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  GB.navTo = async function (lvl, B, song, ch, i) {
    if (!GB.isWide() && document.body.classList.contains('reading')) GB.reader.close();
    if (GB.desk && GB.desk.collapsed()) GB.desk.expand();
    L.home('L'); if (lvl === 'lib') return;
    GB.book.open(B, lvl === 'book' ? null : song);
    if (lvl === 'chapter') await GB.chapter.open(B, ch, i);
  };
  // at: 'chapter' (chapter page) or 'verse' (reader)
  GB.crumbs = function (B, ch, row, at) {
    const nav = h('nav.crumbs', { 'aria-label': 'You are here' });
    const songOn = B.hasSongs && ch && ch.song != null && String(ch.song) !== '' && String(ch.song) !== 'null';
    const items = [['Library', () => GB.navTo('lib')], [bookShort(B), () => GB.navTo('book', B)]];
    if (songOn) items.push([songName(B, ch.song), () => GB.navTo('song', B, String(ch.song))]);
    if (ch) items.push([Number(ch.ch) === 0 || !GB.numbered(B) ? clip(ch.title || 'Intro', 18) : (B.lang === 'hin' ? 'अध्याय ' : 'Ch ') + ch.ch, at === 'verse' ? () => GB.navTo('chapter', B, String(ch.song), ch, GB.reader.current() ? GB.reader.current().i : null) : null]);
    if (at === 'verse' && row) items.push([GB.numbered(B) ? lib.label(B, ch.song, ch.ch, row.no).split(' ').pop() : clip(row.preview, 22), null]);
    items.forEach(([t, go], k) => {
      if (k) nav.append(h('span.cr-sep', { 'aria-hidden': 'true', text: '›' }));
      const last = k === items.length - 1;
      nav.append(last || !go ? h('span.cr' + (last ? '.cur' : ''), { text: t, 'aria-current': last ? 'location' : null }) : h('button.cr', { type: 'button', text: t, onclick: e => { e.stopPropagation(); go(); } }));
    });
    requestAnimationFrame(() => { nav.scrollLeft = nav.scrollWidth; });
    return nav;
  };

  // ================= now-reading bar (phones): the verse you are on stays one tap away =================
  const NB = GB.nowbar = {};
  let nbEl = null, nbBusy = false;
  const lastEntry = () => Array.from(GB.reading.map.values()).filter(x => lib.book(x.id)).sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0] || null;
  async function nbStep(dir) {
    if (nbBusy) return; const e = lastEntry(); if (!e) return; const B = lib.book(e.id); nbBusy = true;
    try {
      const ch = lib.findChapter(B, e.song, e.ch) || B.chapters[0]; const rows = await lib.chapterTexts(B, ch); const i = Math.max(0, lib.findTextIndex(rows, e.no));
      const n = await lib.neighbour(B, ch, i, dir); if (!n) { GB.ui.toast(dir > 0 ? 'Last verse of the book' : 'First verse of the book'); return; }
      const rows2 = n.ch === ch ? rows : await lib.chapterTexts(B, n.ch);
      nbEl.classList.remove('step-l', 'step-r'); void nbEl.offsetWidth; nbEl.classList.add(dir > 0 ? 'step-r' : 'step-l');
      await GB.reading.touch(B, n.ch, n.i, n.row, rows2.length, { scroll: 0 });
    } finally { nbBusy = false; }
  }
  NB.sync = function () {
    if (!nbEl) {
      nbEl = h('div#nowbar', { role: 'region', 'aria-label': 'Now reading' });
      document.body.append(nbEl);
    }
    const e = lastEntry(); const show = !!e && !document.documentElement.classList.contains('desk') && GB.prefs.nowBar !== false;
    document.body.classList.toggle('has-now', show); nbEl.classList.toggle('on', show);
    if (!e) { nbEl.innerHTML = ''; return; }
    const B = lib.book(e.id); const key = e.id + '|' + e.label + '|' + (e.preview || '').length;
    if (nbEl.dataset.k === key) return; nbEl.dataset.k = key; nbEl.innerHTML = '';
    const ch = lib.findChapter(B, e.song, e.ch);
    const where = ch && B.hasSongs ? songName(B, ch.song) : GB.ut(e.chTitle || '').slice(0, 30);
    nbEl.append(
      h('button.nb-main', { type: 'button', title: 'Open the reader', onclick: () => GB.reader.openSaved(B, lastEntry()) },
        h('span.nb-cover', { text: (B.abbr || GB.ut(B.title).slice(0, 2)).slice(0, 3) }),
        h('span.nb-txt', null, h('span.nb-ref', null, h('b', { text: GB.numbered(B) ? e.label : GB.bookShort(B) }), where ? h('span', { text: ' · ' + where }) : null), h('span.nb-prev' + (/[\u0900-\u097F]/.test(e.preview || '') ? '.devui' : ''), { text: GB.ut(e.preview || '').slice(0, 120) }))),
      h('button.nb-b', { type: 'button', title: 'Previous verse', 'aria-label': 'Previous verse', onclick: () => nbStep(-1), html: GB.icons.svg('chevL') || '‹' }),
      h('button.nb-b', { type: 'button', title: 'Next verse', 'aria-label': 'Next verse', onclick: () => nbStep(1), html: GB.icons.svg('chevR') || '›' }));
  };
  document.addEventListener('gb:reading', () => NB.sync());
  window.addEventListener('gb:layout', () => NB.sync());
})(window.GB);
