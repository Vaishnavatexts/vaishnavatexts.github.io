/* Vaishnava Texts: user data. Notes (highlights, quotes, comments, questions, favourite texts, general notes)
   with #topics, the reading list and browsing history. Backup/restore as JSON. */
'use strict';
(function (GB) {
  const { store } = GB;
  const emit = (n) => document.dispatchEvent(new CustomEvent(n));
  // ---------- notes ----------
  const N = GB.notes = { list: [], topics: [] };
  N.TYPES = { highl: 'Highlight', quote: 'Quote', note: 'Note', quest: 'Question', fav: 'Favourite text' };
  N.load = async () => {
    N.list = (await store.all('notes')) || []; N.topics = await store.kvGet('topics', []);
    // v2: topics became Notebook folders (same data). Keep one copy of the v1 topics and tags, just in case
    if (!(await store.kvGet('topicsBackupV1', null))) await store.kvSet('topicsBackupV1', { saved: Date.now(), topics: N.topics.slice(), tags: N.list.filter(n => n.tags && n.tags.length).map(n => ({ id: n.id, tags: n.tags.slice() })) });
  };
  N.save = async n => {
    n.updated = Date.now(); if (!n.created) n.created = n.updated; if (!n.id) n.id = GB.uid();
    n.tags = Array.from(new Set((n.tags || []).map(t => String(t).replace(/^#+/, '').trim()).filter(Boolean)));
    const i = N.list.findIndex(x => x.id === n.id); if (i >= 0) N.list[i] = n; else N.list.push(n);
    await store.put('notes', n); emit('gb:notes'); return n;
  };
  N.remove = async id => { N.list = N.list.filter(x => x.id !== id); await store.del('notes', id); emit('gb:notes'); };
  N.ref = (B, ch, row) => ({ book: B.key, abbr: B.abbr, lang: B.lang, title: B.title, song: String(ch.song), ch: String(ch.ch), no: String(row.no), textId: row.id, label: GB.lib.label(B, ch.song, ch.ch, row.no) });
  const same = (r, B, ch, row) => r && r.book === B.key && r.song === String(ch.song) && r.ch === String(ch.ch) && (!row || r.no === String(row.no));
  N.forText = (B, ch, row) => N.list.filter(n => same(n.ref, B, ch, row));
  N.forChapter = (B, ch) => N.list.filter(n => same(n.ref, B, ch, null));
  N.forBook = B => N.list.filter(n => n.ref && n.ref.book === B.key);
  N.isFav = (B, ch, row) => N.list.some(n => n.type === 'fav' && same(n.ref, B, ch, row));
  N.counts = list => { const c = { highl: 0, quote: 0, note: 0, quest: 0, fav: 0 }; for (const n of list) c[n.type] = (c[n.type] || 0) + 1; return c; };
  N.addTopic = async name => { name = String(name || '').replace(/^#+/, '').trim(); if (!name) return; if (!N.topics.some(t => t.toLowerCase() === name.toLowerCase())) { N.topics.push(name); await store.kvSet('topics', N.topics); } emit('gb:notes'); };
  N.renameTopic = async (from, to) => {
    to = String(to || '').replace(/^#+/, '').trim(); if (!to) return; const fl = from.toLowerCase();
    for (const n of N.list) { let ch = false; n.tags = (n.tags || []).map(t => { const tl = t.toLowerCase(); if (tl === fl || tl.startsWith(fl + '/')) { ch = true; return to + t.slice(from.length); } return t; }); if (ch) await store.put('notes', n); }
    N.topics = N.topics.map(t => (t.toLowerCase() === fl || t.toLowerCase().startsWith(fl + '/')) ? to + t.slice(from.length) : t); await store.kvSet('topics', N.topics); emit('gb:notes');
  };
  N.deleteTopic = async name => {
    const fl = name.toLowerCase();
    for (const n of N.list) { const before = (n.tags || []).length; n.tags = (n.tags || []).filter(t => !(t.toLowerCase() === fl || t.toLowerCase().startsWith(fl + '/'))); if (n.tags.length !== before) await store.put('notes', n); }
    N.topics = N.topics.filter(t => !(t.toLowerCase() === fl || t.toLowerCase().startsWith(fl + '/'))); await store.kvSet('topics', N.topics); emit('gb:notes');
  };
  // topic tree: "a/b" makes b a subtopic of a
  N.allTopics = () => { const m = new Map(); for (const t of N.topics) m.set(t.toLowerCase(), t); for (const n of N.list) for (const t of n.tags || []) if (!m.has(t.toLowerCase())) m.set(t.toLowerCase(), t); return Array.from(m.values()).sort((a, b) => a.localeCompare(b)); };
  N.children = parent => {
    const p = parent ? parent.toLowerCase() + '/' : ''; const kids = new Map();
    for (const t of N.allTopics()) { const tl = t.toLowerCase(); if (p && !tl.startsWith(p)) continue; const rest = t.slice(p.length); if (!rest) continue; const head = rest.split('/')[0]; const full = (parent ? parent + '/' : '') + head; if (!kids.has(full.toLowerCase())) kids.set(full.toLowerCase(), full); }
    return Array.from(kids.values()).sort((a, b) => a.localeCompare(b));
  };
  N.inTopic = (t, deep) => { const tl = t.toLowerCase(); return N.list.filter(n => (n.tags || []).some(x => { const xl = x.toLowerCase(); return xl === tl || (deep && xl.startsWith(tl + '/')); })); };
  // ---------- reading list ----------
  const RD = GB.reading = { map: new Map() };
  RD.load = async () => { for (const e of (await store.all('reading')) || []) RD.map.set(e.id, e); };
  RD.get = B => RD.map.get(B.key) || null;
  RD.progressOf = (B, ch, i, n) => B.chapters.length ? Math.min(1, (ch.idx + (i + 1) / Math.max(1, n)) / B.chapters.length) : 0;
  RD.touch = async (B, ch, i, row, nRows, extra) => {
    let e = RD.map.get(B.key);
    if (!e) e = { id: B.key, title: B.title, author: B.author, lang: B.lang, created: Date.now(), timeSpent: 0, mode: GB.prefs.defaultLayout, fromStart: false };
    Object.assign(e, { song: String(ch.song), ch: String(ch.ch), no: String(row.no), textId: row.id, preview: (row.preview || '').slice(0, 400), label: GB.lib.label(B, ch.song, ch.ch, row.no), chTitle: ch.title, lastOpened: Date.now() }, extra || {});
    const p = RD.progressOf(B, ch, i, nRows); e.progress = p; e.maxProgress = Math.max(e.maxProgress || 0, p);
    // a book counts as finished once the last verse of every chapter has been reached
    if (i === nRows - 1) { const done = new Set(e.done || []); done.add(ch.idx); e.done = Array.from(done).sort((a, b) => a - b); }
    if (!e.finished && (e.done || []).length >= B.chapters.length) { e.finished = true; e.finishedAt = Date.now(); GB.ui.toast('Finished! The book is now on your Finished shelf'); }
    RD.map.set(B.key, e); await store.put('reading', e); emit('gb:reading'); return e;
  };
  RD.addTime = async (B, ms) => { const e = RD.map.get(B.key); if (!e) return; e.timeSpent = (e.timeSpent || 0) + ms; await store.put('reading', e); };
  RD.set = async (B, patch) => { const e = RD.map.get(B.key); if (!e) return; Object.assign(e, patch); await store.put('reading', e); emit('gb:reading'); };
  RD.remove = async id => { RD.map.delete(id); await store.del('reading', id); emit('gb:reading'); };
  // ---------- browsing history ----------
  const HS = GB.history = { list: [] };
  HS.load = async () => { HS.list = ((await store.all('history')) || []).sort((a, b) => b.ts - a.ts); };
  HS.add = async (B, ch, row) => {
    const id = B.key + '|' + ch.song + '|' + ch.ch + '|' + row.no;
    const e = { id, ts: Date.now(), book: B.key, title: B.title, label: GB.lib.label(B, ch.song, ch.ch, row.no), chTitle: ch.title, song: String(ch.song), ch: String(ch.ch), no: String(row.no), preview: (row.preview || '').slice(0, 200) };
    HS.list = [e].concat(HS.list.filter(x => x.id !== id));
    await store.put('history', e);
    for (const old of HS.list.splice(300)) await store.del('history', old.id);
  };
  HS.remove = async id => { HS.list = HS.list.filter(x => x.id !== id); await store.del('history', id); };
  HS.clear = async () => { HS.list = []; await store.clear('history'); };
  // ---------- backup / restore ----------
  N.backupJson = () => JSON.stringify({ app: 'gitabase-reader-web', format: 1, exported: new Date().toISOString(), notes: N.list, topics: N.topics, reading: Array.from(RD.map.values()), history: HS.list.slice(0, 300), prefs: Object.assign({}, GB.prefs) }, null, 1);
  N.backup = () => { const d = new Date(); GB.download('vaishnava-texts-notes-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json', N.backupJson()); };
  N.restore = async (obj, replace) => {
    if (!obj || !Array.isArray(obj.notes)) throw new Error('Not a Gitabase notes backup');
    if (replace) { await store.clear('notes'); N.list = []; }
    for (const n of obj.notes) { if (!n.id) n.id = GB.uid(); const i = N.list.findIndex(x => x.id === n.id); if (i >= 0) N.list[i] = n; else N.list.push(n); await store.put('notes', n); }
    if (Array.isArray(obj.topics)) { for (const t of obj.topics) if (!N.topics.includes(t)) N.topics.push(t); await store.kvSet('topics', N.topics); }
    if (Array.isArray(obj.reading)) for (const e of obj.reading) { if (!RD.map.has(e.id) || replace) { RD.map.set(e.id, e); await store.put('reading', e); } }
    if (Array.isArray(obj.history)) { for (const e of obj.history) if (!HS.list.some(x => x.id === e.id)) { HS.list.push(e); await store.put('history', e); } HS.list.sort((a, b) => b.ts - a.ts); }
    emit('gb:notes'); emit('gb:reading');
    return obj.notes.length;
  };
})(window.GB);
