/* Vaishnava Texts: fast search. When library/catalog.json lists a prebuilt word index for a file
   (tools/gb_index.py), single words, word beginnings (adhikar*), AND / OR / NOT and "search in this book" are answered
   from a few small gzip shards instead of walking the 500 MB file's full-text blocks. Phrases, "closest words first"
   and files without an index go to the original reader unchanged. */
'use strict';
(function (root) {
  const BIT = { 1: 1, 5: 2, 6: 4, 7: 8 }, ALL = 14, MAXSHARDS = 16;
  const NO = new Error('fast search: not applicable');
  const dirs = new Map(), shards = new Map();
  const TD = new TextDecoder();

  async function gunzip(buf) {
    if (typeof DecompressionStream === 'undefined') throw NO;
    const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  function vr(b, st) { let v = 0, m = 1, c; do { c = b[st.p++]; v += (c & 127) * m; m *= 128; } while (c & 128); return v; }
  function parseShard(b) {
    const st = { p: 0 }, terms = new Map();
    while (st.p < b.length) {
      const n = vr(b, st), t = TD.decode(b.subarray(st.p, st.p + n)); st.p += n;
      const nd = vr(b, st), nb = vr(b, st); terms.set(t, { off: st.p, len: nb, n: nd }); st.p += nb;
    }
    return { b, terms };
  }
  function lastLE(arr, t) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }

  function makeEngine(base, fetchFn, loose) {   // loose: files without a real full-text index; a phrase becomes all its words
    const get = fetchFn || ((u) => fetch(u));
    const key = u => base + u;
    async function dir() {
      if (!dirs.has(base)) dirs.set(base, get(base + 'dir.json').then(r => { if (!r.ok) throw NO; return r.json(); }));
      return dirs.get(base);
    }
    async function shard(i) {
      const k = key(i);
      if (!shards.has(k)) {
        const p = get(base + 's' + String(i).padStart(4, '0') + '.gz').then(async r => { if (!r.ok) throw NO; return parseShard(await gunzip(await r.arrayBuffer())); });
        shards.set(k, p); p.catch(() => shards.delete(k));
        if (shards.size > 24) shards.delete(shards.keys().next().value);
      }
      return shards.get(k);
    }
    // term -> Map(docid -> {m: mask, h: tf})
    async function postings(tok, prefix, want, noTf) {
      const d = await dir(), out = new Map();
      if (!tok) return out;
      if (prefix && tok.length < 2) throw NO;
      let i = lastLE(d.first, tok); if (i < 0) { if (!prefix) return out; i = 0; }
      const list = [i];
      if (prefix) { while (i + 1 < d.n && d.first[i + 1].startsWith(tok)) { list.push(++i); if (list.length > MAXSHARDS) throw NO; } }
      const sh = await Promise.all(list.map(shard));
      for (const s of sh) {
        for (const [t, e] of s.terms) {
          if (prefix ? !t.startsWith(tok) : t !== tok) continue;
          const st = { p: e.off }, end = e.off + e.len; let doc = 0;
          while (st.p < end) {
            const v = vr(s.b, st), m = v % 16, tf = vr(s.b, st); doc += (v - m) / 16;
            const mm = m & want; if (!mm) continue;
            const o = out.get(doc); if (o) { o.m |= mm; o.h += noTf ? 0 : tf; } else out.set(doc, { m: mm, h: noTf ? 0 : tf });
          }
        }
      }
      return out;
    }
    async function ev(n, want) {
      if (n.t === 'term') {
        if (n.tokens.length !== 1) {
          if (!loose) throw NO;
          const ks = n.tokens.map((t, i) => ({ t: 'term', tokens: [t], prefix: !!n.prefix && i === n.tokens.length - 1, cols: n.cols }));
          return ev({ t: 'and', kids: ks }, want);
        }
        let w = want, noTf = false;
        if (n.cols) { w = 0; for (const c of n.cols) w |= BIT[c] || 0; if (!w) throw NO; noTf = n.cols.length === 1 && n.cols[0] === 1; }
        return postings(n.tokens[0], !!n.prefix, w, noTf);
      }
      if (n.t === 'or') {
        const res = new Map();
        for (const m of await Promise.all(n.kids.map(k => ev(k, want)))) for (const [d, x] of m) { const o = res.get(d); if (o) { o.m |= x.m; o.h += x.h; } else res.set(d, { m: x.m, h: x.h }); }
        return res;
      }
      if (n.t === 'and') {
        const lists = await Promise.all(n.kids.map(k => ev(k, want)));
        lists.sort((a, b) => a.size - b.size);
        const res = new Map();
        for (const [d, x] of lists[0]) {
          let m = x.m, h = x.h, ok = true;
          for (let i = 1; i < lists.length; i++) { const o = lists[i].get(d); if (!o) { ok = false; break; } m |= o.m; h += o.h; }
          if (ok) res.set(d, { m, h });
        }
        return res;
      }
      if (n.t === 'not') {
        const [a, b] = await Promise.all([ev(n.a, want), ev(n.b, 15)]);
        for (const d of b.keys()) a.delete(d);
        return a;
      }
      throw NO;
    }
    async function search(ast, cols) {
      const d = await dir(); let want = 0;
      if (cols && cols.length) { for (const c of cols) { if (!(c in BIT) || !d.cols.includes(BIT[c])) throw NO; want |= BIT[c]; } } else want = ALL;
      const m = await ev(ast, want), out = [];
      for (const [doc, x] of m) {
        const pc = {}; for (const c of [5, 6, 7]) if (x.m & BIT[c]) pc[c] = 1;
        out.push([doc, Math.max(1, x.h), pc, null]);
      }
      out.sort((a, b) => a[0] - b[0]);
      return out;
    }
    return { search, dir };
  }

  // ---- result rows: the reader fetches the 40 rows of a results page one 256 KB chunk at a time. loc.gz says which chunks hold
  // each docid, so they are fetched in parallel first (the service worker / HTTP cache then answers the reader's own reads).
  const locs = new Map(), asked = new Set();
  async function locMap(base, chunkSize) {
    if (!locs.has(base)) locs.set(base, (async () => {
      const d = await dirOf(base); if (!d.loc || d.chunk !== chunkSize) return null;
      const r = await fetch(base + 'loc.gz'); if (!r.ok) return null;
      const b = await gunzip(await r.arrayBuffer()), st = { p: 0 }, doc = [], c0 = [], sp = [];
      let id = 0; while (st.p < b.length) { id += vr(b, st); doc.push(id); c0.push(vr(b, st)); sp.push(vr(b, st)); }
      return { doc, c0, sp };
    })().catch(() => null));
    return locs.get(base);
  }
  async function dirOf(base) { if (!dirs.has(base)) dirs.set(base, fetch(base + 'dir.json').then(r => { if (!r.ok) throw NO; return r.json(); })); return dirs.get(base); }
  async function prefetchRows(D, ids) {
    note('prefetch ' + ids.length); const lib = root.GB.lib, f = (lib.catalog && lib.catalog.files || []).find(x => D.rec && 'h:' + x.id === D.rec.id);
    if (!f || !f.search || f.search.synth) return;
    const base = new URL('../' + f.search.dir, new URL(f.base, document.baseURI)).href, m = await locMap(base, f.chunkSize); if (!m) return;
    const want = new Set();
    for (const id of ids) {
      let lo = 0, hi = m.doc.length - 1, k = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (m.doc[mid] < id) lo = mid + 1; else { if (m.doc[mid] === id) k = mid; hi = mid - 1; } }
      if (k < 0) continue;
      const a = m.c0[k], z = a + m.sp[k]; want.add(a); if (z !== a) want.add(z);
    }
    const todo = Array.from(want).filter(c => !asked.has(base + c)).sort((a, b) => a - b); todo.forEach(c => asked.add(base + c));
    const cb = new URL(f.base, document.baseURI).href; let next = 0;
    const lane = async () => { while (next < todo.length) { const c = todo[next++]; try { const r = await fetch(cb + String(c).padStart(5, '0') + '.bin'); await r.arrayBuffer(); } catch (e) { asked.delete(base + c); } } };
    await Promise.all(Array.from({ length: Math.min(10, todo.length) }, lane));
    note('prefetched ' + todo.length);
  }
  if (root.GB && root.GB.lib && root.GB.lib.q && typeof document !== 'undefined') {
    const q0 = root.GB.lib.q;
    root.GB.lib.q = async function (D, sql, bind) {
      if (Array.isArray(bind) && bind.length > 1 && /FROM textindex_content WHERE docid IN/.test(sql)) { try { await prefetchRows(D, bind); } catch (e) { console.warn('row prefetch skipped', e); } }
      const t0 = performance.now(), isRows = /FROM textindex_content WHERE docid IN/.test(sql);
      try { const r = await q0.apply(this, arguments); if (isRows) note('rows ' + (r && r.length) + ' ' + Math.round(performance.now() - t0) + 'ms'); return r; }
      catch (e) { note('qERR ' + String(e && e.message || e).slice(0, 90)); throw e; }
    };
  }

  // ?dbg in the address shows what the search is doing in the page title (no console needed)
  const dbg = typeof location !== 'undefined' && /[?&]dbg\b/.test(location.search), trace = [];
  function note(s) { if (!dbg) return; trace.push(s); document.title = trace.slice(-6).join(' | '); }
  if (dbg) {
    window.addEventListener('unhandledrejection', e => note('REJECT ' + String(e.reason && e.reason.message || e.reason).slice(0, 80)));
    window.addEventListener('error', e => note('ERR ' + String(e.message).slice(0, 80)));
  }

  const engines = new Map();
  function engineFor(dbId) {
    const lib = root.GB && root.GB.lib; if (!lib || !lib.catalog) return null;
    const D = Array.from(lib.dbs.values()).find(x => x.num === dbId); if (!D || !D.rec || !/^h:/.test(D.rec.id)) return null;
    const f = (lib.catalog.files || []).find(x => 'h:' + x.id === D.rec.id); if (!f || !f.search) return null;
    const base = new URL('../' + f.search.dir, new URL(f.base, document.baseURI)).href;
    if (!engines.has(base)) engines.set(base, makeEngine(base, null, !!f.search.synth));
    return engines.get(base);
  }
  if (typeof GBDB !== 'undefined' && typeof document !== 'undefined') {
    const orig = GBDB.fts;
    GBDB.fts = async function (dbId, ast, cols, distAst) {
      if (!distAst) {
        try {
          const e = engineFor(dbId);
          if (e) { const t0 = performance.now(), r = await e.search(ast, cols); r.fastMs = Math.round(performance.now() - t0); console.log('fast search', r.length, 'texts,', r.fastMs, 'ms'); note('fts ' + r.length + ' ' + r.fastMs + 'ms'); return r; }
        } catch (err) { if (err !== NO) console.warn('fast search failed, using the file index', err); }
      }
      return orig.apply(GBDB, arguments);
    };
  }
  root.GBSearchFast = { makeEngine, NO };
  if (typeof module !== 'undefined') module.exports = { makeEngine, NO, gunzip };
})(typeof window !== 'undefined' ? window : globalThis);
