/* Vaishnava Texts: database layer. SQLite runs in a worker; files are read lazily page by page
   (local File/Blob via FileReaderSync, hosted chunk files via sync XHR), so a 190 MB gitabase never sits in memory. */
'use strict';
function GB_WORKER_MAIN() {
  let sqlite3, capi, wasm;
  const sources = new Map();   // vfs filename -> source
  const files = new Map();     // sqlite3_file* -> source
  const dbs = new Map();       // dbId -> {db, name, src}
  const aux = new Map();       // dbId -> cached js indexes
  let lastErr = null;
  function blobSource(blob) {
    const BS = 65536, MAX = 768, cache = new Map(), frs = new FileReaderSync();
    const st = { reads: 0, bytes: 0 };
    function block(i) {
      let b = cache.get(i);
      if (b) { cache.delete(i); cache.set(i, b); return b; }
      const s = i * BS, e = Math.min(blob.size, s + BS);
      b = new Uint8Array(frs.readAsArrayBuffer(blob.slice(s, e)));
      st.reads++; st.bytes += b.length;
      cache.set(i, b); if (cache.size > MAX) cache.delete(cache.keys().next().value);
      return b;
    }
    return { size: blob.size, stats: st, block, BS };
  }
  function httpSource(m) {
    const BS = m.chunkSize, MAX = Math.max(24, Math.floor(64 * 1048576 / BS)), cache = new Map();
    const st = { reads: 0, bytes: 0 };
    function block(i) {
      let b = cache.get(i);
      if (b) { cache.delete(i); cache.set(i, b); return b; }
      const x = new XMLHttpRequest();
      x.open('GET', m.base + String(i).padStart(5, '0') + '.bin', false);
      x.responseType = 'arraybuffer'; x.send();
      if (!(x.status === 200 || x.status === 0) || !x.response) throw new Error('chunk ' + i + ' HTTP ' + x.status);
      b = new Uint8Array(x.response); st.reads++; st.bytes += b.length;
      cache.set(i, b); if (cache.size > MAX) cache.delete(cache.keys().next().value);
      return b;
    }
    return { size: m.size, stats: st, block, BS };
  }
  function readInto(src, off, n, dest) {
    let done = 0;
    while (done < n) {
      const pos = off + done; if (pos >= src.size) break;
      const bi = Math.floor(pos / src.BS), b = src.block(bi), bo = pos - bi * src.BS;
      const take = Math.min(n - done, b.length - bo); if (take <= 0) break;
      wasm.heap8u().set(b.subarray(bo, bo + take), dest + done); done += take;
    }
    return done;
  }
  function installVfs() {
    const io = new capi.sqlite3_io_methods(); io.$iVersion = 1;
    const vfs = new capi.sqlite3_vfs();
    vfs.$iVersion = 2; vfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof; vfs.$mxPathname = 512;
    vfs.$zName = wasm.allocCString('gbvfs');
    const ioM = {
      xCheckReservedLock(pF, pOut) { wasm.poke32(pOut, 0); return 0; },
      xClose(pF) { files.delete(Number(pF)); return 0; },
      xDeviceCharacteristics() { return capi.SQLITE_IOCAP_IMMUTABLE; },
      xFileControl() { return capi.SQLITE_NOTFOUND; },
      xFileSize(pF, pSz) { wasm.poke64(pSz, BigInt(files.get(Number(pF)).size)); return 0; },
      xLock() { return 0; }, xUnlock() { return 0; }, xSync() { return 0; },
      xRead(pF, pDest, n, off64) {
        try {
          const src = files.get(Number(pF)), dest = Number(pDest);
          const got = readInto(src, Number(off64), n, dest);
          if (got < n) { wasm.heap8u().fill(0, dest + got, dest + n); return capi.SQLITE_IOERR_SHORT_READ; }
          return 0;
        } catch (e) { lastErr = e; return capi.SQLITE_IOERR_READ; }
      },
      xSectorSize() { return 4096; },
      xTruncate() { return capi.SQLITE_READONLY; }, xWrite() { return capi.SQLITE_READONLY; }
    };
    const vfsM = {
      xAccess(pV, zName, flags, pOut) { wasm.poke32(pOut, sources.has(wasm.cstrToJs(zName)) ? 1 : 0); return 0; },
      xDelete() { return 0; },
      xFullPathname(pV, zName, nOut, pOut) {
        const s = wasm.cstrToJs(zName), bytes = new TextEncoder().encode(s);
        if (bytes.length + 1 > nOut) return capi.SQLITE_CANTOPEN;
        wasm.heap8u().set(bytes, Number(pOut)); wasm.heap8u()[Number(pOut) + bytes.length] = 0; return 0;
      },
      xGetLastError() { return 0; },
      xOpen(pV, zName, pF, flags, pOutFlags) {
        const name = zName ? wasm.cstrToJs(zName) : '';
        const src = sources.get(name);
        if (!src) return capi.SQLITE_CANTOPEN;
        files.set(Number(pF), src);
        const f = new capi.sqlite3_file(pF); f.$pMethods = io.pointer; f.dispose();
        if (pOutFlags) wasm.poke32(pOutFlags, capi.SQLITE_OPEN_READONLY);
        return 0;
      },
      xRandomness(pV, n, pOut) { const h = wasm.heap8u(), p = Number(pOut); for (let i = 0; i < n; i++) h[p + i] = (Math.random() * 256) | 0; return n; },
      xSleep() { return 0; },
      xCurrentTime(pV, pOut) { wasm.poke(pOut, 2440587.5 + Date.now() / 86400000, 'double'); return 0; },
      xCurrentTimeInt64(pV, pOut) { wasm.poke64(pOut, BigInt(Math.floor(2440587.5 * 86400000 + Date.now()))); return 0; }
    };
    sqlite3.vfs.installVfs({ io: { struct: io, methods: ioM }, vfs: { struct: vfs, methods: vfsM } });
  }
  function rows(db, sql, bind) {
    const out = [];
    db.exec({ sql, bind: bind && bind.length ? bind : undefined, rowMode: 'object', resultRows: out });
    return out;
  }
  // Word-by-word headword index ("word—meaning; ...") so tapping a Sanskrit word finds every verse that glosses it.
  function wbwIndex(dbId) {
    const a = aux.get(dbId) || {}; if (a.wbw) return a.wbw;
    const { db } = dbs.get(dbId); const map = new Map();
    const strip = s => s.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    db.exec({ sql: 'SELECT _id, transl1 FROM texts WHERE transl1 IS NOT NULL AND length(transl1) > 0', rowMode: 'array', callback: r => {
      const t = strip(String(r[1] || '')); if (t.indexOf('—') < 0 && t.indexOf(' - ') < 0) return;
      for (const part of t.split(/;\s*/)) {
        const m = part.split(/\s*—\s*|\s+-\s+/); if (m.length < 2) continue;
        const words = m[0].trim().normalize('NFC'); const mean = m.slice(1).join(' — ').trim().replace(/[.।]+$/, '');
        if (!words || words.length > 60) continue;
        for (const w of [words].concat(words.includes('-') ? words.split('-') : [])) {
          const k = w.trim().toLowerCase(); if (!k) continue;
          let arr = map.get(k); if (!arr) map.set(k, arr = []);
          if (arr.length < 3000) arr.push([r[0], w === words ? mean : words + ' — ' + mean]);
        }
      }
    } });
    a.wbw = map; aux.set(dbId, a); return map;
  }

  // ---- FTS3 reader. The official SQLite WASM has no fts3 module, so we read the shadow tables
  // (<t>_segdir / <t>_segments) directly and evaluate MATCH-style queries in JS. Only the b-tree
  // blocks a query touches are read, so this stays lazy on 190 MB books.
  const TE = new TextEncoder();
  function vr(b, st) { let v = 0, m = 1, c; do { c = b[st.p++]; v += (c & 127) * m; m *= 128; } while (c & 128); return v; }
  function bcmp(a, b) { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return a.length - b.length; }
  function bstarts(a, p) { if (a.length < p.length) return false; for (let i = 0; i < p.length; i++) if (a[i] !== p[i]) return false; return true; }
  function ftsInfo(dbId) {
    const a = aux.get(dbId) || {}; aux.set(dbId, a);
    if (a.fts !== undefined) return a.fts;
    const { db } = dbs.get(dbId); let info = null;
    try {
      const segs = [];
      db.exec({ sql: 'SELECT level, idx, start_block, leaves_end_block, end_block, root FROM textindex_segdir', rowMode: 'array', callback: r => {
        segs.push({ level: r[0], idx: r[1], start: Number(r[2]) || 0, leavesEnd: Number(r[3]) || 0, root: r[5] instanceof Uint8Array ? r[5] : new Uint8Array(0) });
      } });
      segs.sort((x, y) => (y.level - x.level) || (x.idx - y.idx)); // oldest first; newer segments override
      const sel = db.prepare('SELECT block FROM textindex_segments WHERE blockid = ?');
      const cache = new Map();
      const block = id => {
        let b = cache.get(id); if (b) return b;
        sel.bind(1, id); b = sel.step() ? sel.get(0) : null; sel.reset();
        if (!(b instanceof Uint8Array)) b = new Uint8Array(0);
        cache.set(id, b); if (cache.size > 512) cache.delete(cache.keys().next().value);
        return b;
      };
      info = { segs, block };
    } catch (e) { info = null; }
    a.fts = info; return info;
  }
  // Scan one leaf; calls hit(termBytes, doclist subarray). Returns true when the scan can stop.
  function scanLeaf(b, key, prefix, hit) {
    if (!b.length) return false;
    const st = { p: 0 }; if (vr(b, st) !== 0) return false;
    let prev = new Uint8Array(0), first = true;
    while (st.p < b.length) {
      let term;
      if (first) { const n = vr(b, st); term = b.subarray(st.p, st.p + n); st.p += n; first = false; }
      else { const np = vr(b, st), ns = vr(b, st); term = new Uint8Array(np + ns); term.set(prev.subarray(0, np)); term.set(b.subarray(st.p, st.p + ns), np); st.p += ns; }
      const nd = vr(b, st), dl = b.subarray(st.p, st.p + nd); st.p += nd; prev = term;
      const c = bcmp(term, key);
      if (prefix) { if (bstarts(term, key)) hit(term, dl); else if (c > 0) return true; }
      else { if (c === 0) { hit(term, dl); return true; } if (c > 0) return true; }
    }
    return false;
  }
  function interiorChild(b, key) {
    const st = { p: 0 }; const h = vr(b, st); let child = vr(b, st);
    let prev = new Uint8Array(0), first = true;
    while (st.p < b.length) {
      let term;
      if (first) { const n = vr(b, st); if (!n) break; term = b.subarray(st.p, st.p + n); st.p += n; first = false; }
      else { const np = vr(b, st); if (st.p >= b.length) break; const ns = vr(b, st); term = new Uint8Array(np + ns); term.set(prev.subarray(0, np)); term.set(b.subarray(st.p, st.p + ns), np); st.p += ns; }
      if (bcmp(term, key) > 0) break;
      child++; prev = term;
    }
    return { h, child };
  }
  function segTerms(info, seg, key, prefix, hit) {
    let node = seg.root;
    if (!node.length) return;
    const st = { p: 0 }; let h = vr(node, st);
    if (h === 0) { scanLeaf(node, key, prefix, hit); return; }
    let child = 0;
    for (let guard = 0; h > 0 && guard < 16; guard++) {
      const r = interiorChild(node, key); child = r.child;
      if (r.h === 1) break;
      node = info.block(child); const s2 = { p: 0 }; h = node.length ? vr(node, s2) : 0;
      if (!node.length) return;
    }
    for (let id = child; id <= seg.leavesEnd; id++) { if (scanLeaf(info.block(id), key, prefix, hit)) break; }
  }
  // Doclist -> Map(docid -> [col<<20 | pos, ...])
  function readDoclist(dl, cols, out) {
    const st = { p: 0 }; let doc = 0;
    while (st.p < dl.length) {
      doc += vr(dl, st); const hits = []; let col = 0, pos = 0;
      for (;;) {
        if (st.p >= dl.length) break;
        const c = vr(dl, st);
        if (c === 0) break;
        if (c === 1) { col = vr(dl, st); pos = 0; continue; }
        pos += c - 2; if (!cols || cols.has(col)) hits.push(col * 1048576 + pos);
      }
      out.set(doc, hits);
    }
  }
  function termDocs(info, tok, prefix, cols) {
    const key = TE.encode(tok); const perTerm = new Map();
    for (const seg of info.segs) {
      segTerms(info, seg, key, prefix, (term, dl) => {
        const k = term.join(','); let m = perTerm.get(k); if (!m) perTerm.set(k, m = new Map());
        const tmp = new Map(); readDoclist(dl, null, tmp);
        for (const [d, h] of tmp) { if (!h.length) m.delete(d); else m.set(d, h); }
      });
    }
    const res = new Map();
    for (const m of perTerm.values()) for (const [d, h] of m) {
      const f = cols ? h.filter(x => cols.has(Math.floor(x / 1048576))) : h; if (!f.length) continue;
      const e = res.get(d); if (e) { for (const x of f) e.push(x); } else res.set(d, f.slice());
    }
    if (perTerm.size > 1) for (const h of res.values()) h.sort((x, y) => x - y);
    return res;
  }
  // query AST: {t:'term', tokens:[...], prefix} | {t:'and'|'or', kids} | {t:'not', a, b}
  function evalNode(info, n, cols) {
    if (n.t === 'term') {
      const cc = n.cols ? new Set(n.cols) : cols;
      if (n.tokens.length === 1) return termDocs(info, n.tokens[0], n.prefix, cc);
      const lists = n.tokens.map((tk, i) => termDocs(info, tk, n.prefix && i === n.tokens.length - 1, cc));
      const res = new Map();
      for (const [d, h0] of lists[0]) {
        const sets = []; let ok = true;
        for (let i = 1; i < lists.length; i++) { const h = lists[i].get(d); if (!h) { ok = false; break; } sets.push(new Set(h)); }
        if (!ok) continue;
        const keep = h0.filter(x => sets.every((s, i) => s.has(x + i + 1)));
        if (keep.length) res.set(d, keep);
      }
      return res;
    }
    if (n.t === 'or') {
      const res = new Map();
      for (const k of n.kids) for (const [d, h] of evalNode(info, k, cols)) { const e = res.get(d); if (e) { for (const x of h) e.push(x); } else res.set(d, h.slice()); }
      return res;
    }
    if (n.t === 'and') {
      let res = null;
      for (const k of n.kids) {
        const m = evalNode(info, k, cols);
        if (!res) { res = m; continue; }
        const nx = new Map(); for (const [d, h] of res) { const o = m.get(d); if (o) nx.set(d, h.concat(o)); } res = nx;
        if (!res.size) break;
      }
      return res || new Map();
    }
    if (n.t === 'not') { const a = evalNode(info, n.a, cols), b = evalNode(info, n.b, null); for (const d of b.keys()) a.delete(d); return a; }
    return new Map();
  }
  function ftsSearch(dbId, ast, cols, distAst) {
    const info = ftsInfo(dbId); if (!info) return null;
    const cs = cols && cols.length ? new Set(cols) : null;
    const m = evalNode(info, ast, cs);
    // "by distance btw results": per document, the tightest window holding every positive part of the query
    let dist = null;
    if (distAst) {
      const base = distAst.t === 'not' ? distAst.a : distAst; const kids = base.t === 'and' ? base.kids : [base];
      if (kids.length > 1) {
        const lists = kids.map(k => evalNode(info, k, cs)); dist = new Map();
        for (const d of m.keys()) {
          const tagged = []; lists.forEach((L, ti) => { const h = L.get(d); if (h) for (const x of h) tagged.push([x, ti]); });
          tagged.sort((p, q) => p[0] - q[0]); dist.set(d, minWindow(tagged, kids.length));
        }
      }
    }
    const out = [];
    for (const [d, h] of m) { const pc = {}; for (const x of h) { const c = Math.floor(x / 1048576); pc[c] = (pc[c] || 0) + 1; } out.push([d, h.length, pc, dist ? (dist.has(d) ? dist.get(d) : 1e9) : null]); }
    out.sort((x, y) => x[0] - y[0]);
    return out;
  }

  // Column lookup: plain SQL. On unindexed read-only files SQLite scans in C (about 40 ms per 250k rows once cached);
  // hosted files carry real indexes from prepare_library.py. Nothing is built or held in JS memory.
  function lookup({ dbId, table, col, key, offset, limit, cols, norm }) {
    const d = dbs.get(dbId); if (!d) throw new Error('db not open');
    const c = norm ? 'lower(trim("' + col + '"))' : '"' + col + '"';
    const k = norm ? String(key).trim().toLowerCase() : key;
    const total = rows(d.db, 'SELECT count(*) AS n FROM "' + table + '" WHERE ' + c + ' = ?', [k])[0].n;
    const got = total ? rows(d.db, 'SELECT rowid AS __r, ' + (cols || '*') + ' FROM "' + table + '" WHERE ' + c + ' = ? ORDER BY rowid LIMIT ? OFFSET ?', [k, limit || 40, offset || 0]) : [];
    return { total, rows: got };
  }
  function tableSet(dbId) {
    const a = aux.get(dbId) || {}; aux.set(dbId, a);
    if (!a.tabs) a.tabs = new Set(rows(dbs.get(dbId).db, "SELECT name FROM sqlite_master WHERE type IN ('table','view')").map(r => r.name));
    return a.tabs;
  }
  const foldKey = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // smallest span (in token positions, same column) that holds one hit of every query part; tagged = [[pos, part], ...] sorted
  function minWindow(tagged, k) {
    const cnt = new Array(k).fill(0); let have = 0, best = Infinity, l = 0;
    for (let r = 0; r < tagged.length; r++) {
      if (cnt[tagged[r][1]]++ === 0) have++;
      while (have === k) { const w = tagged[r][0] - tagged[l][0]; if (w < best) best = w; if (--cnt[tagged[l][1]] === 0) have--; l++; }
    }
    return best === Infinity ? 1e9 : best;
  }
  const ops = {
    async init({ wasmBuf }) {
      sqlite3 = await sqlite3InitModule({
        print() {}, printErr() {},
        instantiateWasm(imports, ok) { WebAssembly.instantiate(wasmBuf, imports).then(r => ok(r.instance, r.module)); return {}; }
      });
      capi = sqlite3.capi; wasm = sqlite3.wasm; installVfs();
      return { version: capi.sqlite3_libversion() };
    },
    open({ dbId, source }) {
      const name = '/gb_' + dbId;
      const src = source.blob ? blobSource(source.blob) : httpSource(source);
      sources.set(name, src);
      const db = new sqlite3.oo1.DB({ filename: name, flags: 'r', vfs: 'gbvfs' });
      db.exec('PRAGMA temp_store=MEMORY; PRAGMA cache_size=-12000;');
      dbs.set(dbId, { db, name, src });
      const tables = {};
      for (const t of rows(db, "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view','index')")) {
        if (t.type === 'index') { (tables.__idx = tables.__idx || []).push(String(t.sql || '')); continue; }
        try { tables[t.name] = rows(db, 'PRAGMA table_info("' + t.name + '")').map(c => c.name); } catch (e) { tables[t.name] = []; }
      }
      return { tables };
    },
    close({ dbId }) { const d = dbs.get(dbId); if (d) { try { d.db.close(); } catch (e) {} sources.delete(d.name); dbs.delete(dbId); aux.delete(dbId); } return true; },
    query({ dbId, sql, bind }) {
      const d = dbs.get(dbId); if (!d) throw new Error('db not open ' + dbId);
      try { return rows(d.db, sql, bind); }
      catch (e) { if (lastErr) { const m = String(lastErr.message || lastErr); lastErr = null; throw new Error(m); } throw e; }
    },
    batch({ dbId, list }) { const d = dbs.get(dbId); return list.map(q => { try { return rows(d.db, q.sql, q.bind); } catch (e) { return { error: String(e.message || e) }; } }); },
    // word-by-word headwords: a prebuilt gbweb_wbw table on hosted files (prepare_library.py), else the in-worker index
    wbwLookup({ dbId, word }) {
      const k = String(word).trim().normalize('NFC').toLowerCase();
      if (tableSet(dbId).has('gbweb_wbw')) return rows(dbs.get(dbId).db, 'SELECT txt_id, mean FROM gbweb_wbw WHERE k = ? ORDER BY rowid LIMIT 3000', [k]).map(r => [r.txt_id, r.mean]);
      return (wbwIndex(dbId).get(k) || []).slice(0, 3000);
    },
    wbwSuggest({ dbId, prefix, limit }) {
      const p = foldKey(String(prefix).trim().normalize('NFC')); if (!p) return [];
      if (tableSet(dbId).has('gbweb_wbw')) return rows(dbs.get(dbId).db, 'SELECT k, count(*) AS n FROM gbweb_wbw WHERE f >= ? AND f < ? GROUP BY k ORDER BY f, k LIMIT ?', [p, p + '\uffff', limit || 60]).map(r => [r.k, r.n]);
      const out = []; for (const [k, v] of wbwIndex(dbId)) { const f = foldKey(k); if (f.startsWith(p)) out.push([k, v.length, f]); }
      out.sort((x, y) => (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0) || (x[0] < y[0] ? -1 : 1));
      return out.slice(0, limit || 60).map(x => [x[0], x[1]]);
    },
    lookup(args) { return lookup(args); },
    fts({ dbId, ast, cols, distAst }) { return ftsSearch(dbId, ast, cols, distAst); },
    hasFts({ dbId }) { return !!ftsInfo(dbId); },
    stats({ dbId }) { const d = dbs.get(dbId); return d ? d.src.stats : null; }
  };
  self.onmessage = async e => {
    const { id, op, args } = e.data;
    try { self.postMessage({ id, ok: true, result: await ops[op](args || {}) }); }
    catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err) }); }
  };
}

const GBDB = (() => {
  let worker = null, seq = 0, ready = null;
  const pending = new Map();
  function b64bytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function call(op, args, transfer) {
    return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); worker.postMessage({ id, op, args }, transfer || []); });
  }
  function init() {
    if (ready) return ready;
    ready = (async () => {
      // One blob holds SQLite + the worker main: importScripts() of a second blob fails on file:// (opaque origin).
      const src = window.GB_SQLITE_SRC + '\n;(' + GB_WORKER_MAIN.toString() + ')();';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = e => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error)); };
      worker.onerror = e => console.error('worker error', e.message);
      const w = b64bytes(window.GB_WASM_B64);
      return call('init', { wasmBuf: w.buffer }, [w.buffer]);
    })();
    return ready;
  }
  return {
    init,
    open: (dbId, source) => call('open', { dbId, source }),
    close: dbId => call('close', { dbId }),
    q: (dbId, sql, bind) => call('query', { dbId, sql, bind }),
    batch: (dbId, list) => call('batch', { dbId, list }),
    wbwLookup: (dbId, word) => call('wbwLookup', { dbId, word }),
    wbwSuggest: (dbId, prefix, limit) => call('wbwSuggest', { dbId, prefix, limit }),
    lookup: args => call('lookup', args),
    fts: (dbId, ast, cols, distAst) => call('fts', { dbId, ast, cols, distAst: distAst || null }),
    hasFts: dbId => call('hasFts', { dbId }),
    stats: dbId => call('stats', { dbId })
  };
})();

/* MATCH-style query parsing for the JS FTS3 reader. Mirrors the "simple" tokenizer the gitabase index was
   built with (ASCII letters/digits and every non-ASCII char are token chars; only ASCII is lowercased). */
const GBFTS = (() => {
  const isTok = c => c >= 0x80 || (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  function toks(s) {
    const out = []; let cur = '';
    for (const ch of s) { const c = ch.codePointAt(0); if (isTok(c)) cur += c < 128 ? ch.toLowerCase() : ch; else if (cur) { out.push(cur); cur = ''; } }
    if (cur) out.push(cur); return out;
  }
  const DEV = /[\u0900-\u097F]/;
  // Gaura/Balaram convention used by gitabase texts: a i u s n precomposed (U+0100 block), dot-below letters
  // decomposed (base + U+0323), anusvara m + U+0301, guttural nasal as n-acute.
  function gbForm(w) {
    let s = w.normalize('NFC').replace(/[\u1E41\u1E43]/g, 'm\u0301').replace(/[\u1E40\u1E42]/g, 'M\u0301').replace(/\u1E45/g, '\u0144').replace(/\u1E44/g, '\u0143');
    return Array.from(s).map(ch => { const c = ch.codePointAt(0); return (c >= 0x1E00 && c <= 0x1EFF) ? ch.normalize('NFD') : ch; }).join('');
  }
  const asciiFold = w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7f]/g, '');
  const ent = s => s.replace(/[^\x00-\x7f]/gu, ch => '&#' + ch.codePointAt(0) + ';');
  function variants(word, entityMode) {
    const out = []; const prefix = /\*$/.test(word); const w = word.replace(/\*+$/, '');
    const add = (s, pre) => { const t = toks(s); if (!t.length) return; const k = t.join(' ') + (pre ? '*' : ''); if (!out.some(o => o.k === k)) out.push({ t: 'term', tokens: t, prefix: pre, k }); };
    if (!w) return out;
    if (DEV.test(w)) { add(w.normalize('NFC'), true); return out; }   // danda / punctuation stay glued to Devanagari tokens
    if (/[^\x00-\x7f]/.test(w)) {
      const g = gbForm(w);
      if (entityMode) add(ent(g), prefix);
      add(g, prefix); add(w.normalize('NFC'), prefix);
      add(asciiFold(w), prefix);                                      // gb:// word links carry ASCII slugs
    } else add(w, prefix);
    return out;
  }
  function phrase(words, entityMode) {
    const prim = [], alt = [];
    for (const w of words) {
      const v = variants(w, entityMode); if (!v.length) continue;
      prim.push(...v[0].tokens); const raw = v.find(x => !/&#/.test(x.k)) || v[0]; alt.push(...raw.tokens);
    }
    const lastPre = /\*$/.test(words[words.length - 1] || '');
    const a = { t: 'term', tokens: prim, prefix: lastPre }, b = { t: 'term', tokens: alt, prefix: lastPre };
    if (!prim.length) return null;
    return prim.join(' ') === alt.join(' ') ? a : { t: 'or', kids: [a, b] };
  }
  function lex(q) {
    const out = []; const re = /"([^"]*)"(\*)?|\(|\)|-?[^\s()"]+/g; let m;
    while ((m = re.exec(q))) {
      if (m[1] !== undefined) out.push({ k: 'phrase', words: m[1].trim().split(/\s+/).filter(Boolean), star: !!m[2] });
      else if (m[0] === '(' || m[0] === ')') out.push({ k: m[0] });
      else if (m[0] === 'OR' || m[0] === '|') out.push({ k: 'OR' });
      else if (m[0] === 'AND') out.push({ k: 'AND' });
      else if (m[0] === 'NOT') out.push({ k: 'NOT' });
      else if (m[0][0] === '-' && m[0].length > 1) { out.push({ k: 'NOT' }); out.push({ k: 'word', w: m[0].slice(1) }); }
      else out.push({ k: 'word', w: m[0] });
    }
    return out;
  }
  // grammar: and := unit+ (implicit AND, NOT excludes) ; unit := prim ('OR' prim)* ; prim := '(' and ')' | phrase | word
  function parse(q, opts) {
    opts = opts || {}; const em = !!opts.entityMode;
    if (opts.exact) { const ws = q.replace(/"/g, ' ').trim().split(/\s+/).filter(Boolean); return ws.length ? phrase(ws, em) : null; }
    const T = lex(q); let i = 0;
    function prim() {
      const t = T[i]; if (!t) return null;
      if (t.k === '(') { i++; const n = andE(); if (T[i] && T[i].k === ')') i++; return n; }
      if (t.k === 'phrase') { i++; const ws = t.words.slice(); if (t.star && ws.length) ws[ws.length - 1] += '*'; return ws.length ? phrase(ws, em) : null; }
      if (t.k === 'word') { i++; const v = variants(t.w, em); return !v.length ? null : v.length === 1 ? v[0] : { t: 'or', kids: v }; }
      i++; return null;
    }
    function unit() { let n = prim(); while (T[i] && T[i].k === 'OR') { i++; const r = prim(); if (r) n = n ? { t: 'or', kids: [n, r] } : r; } return n; }
    function andE() {
      const pos = [], neg = [];
      while (i < T.length && T[i].k !== ')') {
        if (T[i].k === 'AND') { i++; continue; }
        if (T[i].k === 'NOT') { i++; const n = unit(); if (n) neg.push(n); continue; }
        const n = unit(); if (n) pos.push(n);
      }
      if (!pos.length) return null;
      let a = pos.length === 1 ? pos[0] : { t: 'and', kids: pos };
      if (neg.length) a = { t: 'not', a, b: neg.length === 1 ? neg[0] : { t: 'or', kids: neg } };
      return a;
    }
    return andE();
  }
  // words worth highlighting (plain, no operators)
  function needles(q) {
    const out = [];
    for (const t of lex(q)) {
      if (t.k === 'word') out.push(t.w.replace(/\*+$/, ''));
      else if (t.k === 'phrase') out.push(t.words.join(' '));
    }
    return out.filter(Boolean);
  }
  return { parse, needles, toks, variants };
})();
