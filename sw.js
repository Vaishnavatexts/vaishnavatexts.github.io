/* Vaishnava Texts: offline support for the hosted site (GitHub Pages). Not used when index.html is opened as a file.
   App files: network first, cached copy when offline. Fonts and images: cache first.
   Library chunks (library/<id>-<hash>/NNNNN.bin) and word-index shards (library/<id>-<hash>-idx/*): cache first, so every
   page read once stays readable offline.
   A changed database gets a new folder name, and folders no longer listed in catalog.json are dropped from the cache. */
'use strict';
const BUILD = '83520c09c7c8';                 // stamped by tools/build_site.py
const ASSETS = ["fonts/GauraTimes-Italic.ttf", "fonts/GauraTimes.ttf", "fonts/Inter-Bold.woff2", "fonts/Inter-Medium.woff2", "fonts/Inter-Regular.woff2", "fonts/Inter-SemiBold.woff2", "fonts/NOTICE-fonts.txt", "fonts/NotoSerifDevanagari.ttf", "fonts/ReaderDisplay-Bold.ttf", "fonts/Roboto-Italic.ttf", "fonts/Roboto.ttf", "fonts/TiroDevanagariHindi-Italic.ttf", "fonts/TiroDevanagariHindi-Regular.ttf", "fonts/TiroDevanagariSanskrit-Regular.ttf"];          // fonts and toolbar images, stamped by tools/build_site.py
const SHELL = 'gb-shell-' + BUILD, STATIC = 'gb-static-v3', CHUNKS = 'gb-chunks-v1';
const CORE = ['./', 'index.html', 'css/app.css', 'css/own-art.css', 'css/theme.css', 'manifest.webmanifest', 'js/sqlite-src.js', 'js/db.js', 'js/util.js', 'js/assets.js', 'js/icons.js',
  'js/store.js', 'js/library.js', 'js/render.js', 'js/notes.js', 'js/ui-home.js', 'js/ui-book.js', 'js/ui-reader.js', 'js/ui-extra.js', 'js/ui-v2.js', 'js/ui-desk.js', 'js/ui-look.js', 'js/ui-search.js', 'css/v2.css', 'css/desk.css', 'css/penta.css', 'css/penta-size.css', 'css/shelf.css', 'js/app.js'];

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(SHELL); await c.addAll(CORE);
  const s = await caches.open(STATIC); await Promise.all(ASSETS.map(u => s.match(u).then(hit => hit || s.add(u)).catch(() => {})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if ((k.startsWith('gb-shell-') && k !== SHELL) || (k.startsWith('gb-static-') && k !== STATIC)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin && !url.href.startsWith("https://dasadasanudas.github.io/gitabase-reader-web/library/")) return;
  const p = url.pathname;
  if (/\/library\/[^/]+\/\d+\.bin$/.test(p) || /\/library\/[^/]+-idx\/[^/]+$/.test(p)) e.respondWith(cacheFirst(CHUNKS, req));
  else if (/\/library\/catalog\.json$/.test(p)) e.respondWith(catalog(req));
  else if (/\.(ttf|otf|woff2?|png|jpe?g|gif|webp|svg)$/i.test(p)) e.respondWith(cacheFirst(STATIC, req));
  else e.respondWith(networkFirst(req));
});
async function cacheFirst(name, req) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit;
  const r = await fetch(req); if (r.ok) await c.put(req, r.clone()); return r;
}
async function networkFirst(req) {
  const c = await caches.open(SHELL);
  try { const r = await fetch(req); if (r.ok && r.type === 'basic') await c.put(req, r.clone()); return r; }
  catch (err) {
    const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit) return hit; throw err;
  }
}
async function catalog(req) {
  const c = await caches.open(SHELL);
  try {
    const r = await fetch(req.url, { cache: 'no-cache' });
    if (r.ok) { await c.put(req, r.clone()); prune(await r.clone().json()); }
    return r;
  } catch (err) { const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit; throw err; }
}
async function prune(cat) {
  try {
    const keep = new Set();
    for (const f of cat.files || []) {
      const b = new URL(f.base, self.registration.scope); keep.add(b.pathname);
      if (f.search && f.search.dir) keep.add(new URL('../' + f.search.dir, b).pathname);
    }
    const c = await caches.open(CHUNKS);
    for (const k of await c.keys()) { const p = new URL(k.url).pathname; if (!keep.has(p.slice(0, p.lastIndexOf('/') + 1))) await c.delete(k); }
  } catch (e) { /* keep the cache as it is */ }
}
