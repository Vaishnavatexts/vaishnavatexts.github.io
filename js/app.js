/* Vaishnava Texts: boot. */
'use strict';
(function (GB) {
  const { $ } = GB;
  GB.paths = !!document.querySelector('meta[name="gb-paths"]');
  async function openHash() {
    let m = decodeURIComponent(location.hash || '').match(/^#\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!m && GB.paths) { const base = new URL(document.baseURI).pathname, p = decodeURIComponent(location.pathname); if (p.startsWith(base)) m = ('/' + p.slice(base.length)).match(/^\/([^/]+)\/([^/]+)\/(.+?)\/?$/); }
    if (!m) return false;
    const [, lang, abbr, rest] = m; const nums = rest.split('/').filter(Boolean);
    let B = GB.lib.books.find(b => b.lang === lang && (b.abbr === abbr || b.title === abbr)) || GB.lib.resolveBook(abbr, lang); if (!B) return false;
    const r = await GB.lib.resolve(B.abbr || abbr, nums, lang); if (!r) return false;
    GB.reader.open(r.B, r.ch, r.i, { noAsk: true }); return true;
  }
  async function addFiles(files) {
    if (GB.lib.hosted) { GB.ui.toast('This online library is managed by its owner'); return; }
    files = Array.from(files || []); if (!files.length) return;
    GB.ui.toast('Adding ' + files.length + ' file(s)…', 1500);
    const added = await GB.lib.addFiles(files);
    if (added.length) { GB.ui.toast('Added: ' + added.map(D => D.name).join(', ')); GB.home.sub = 'books'; GB.left.home('L'); }
  }
  GB.addFiles = addFiles;
  async function boot() {
    const bootEl = $('#boot'), msg = bootEl.querySelector('.boot-msg');
    try {
      await GB.loadPrefs(); GB.applyPrefs();
      GB.home.build(); GB.reader.build(); GB.nav.init();
      msg.textContent = 'Opening library…';
      await Promise.all([GB.notes.load(), GB.reading.load(), GB.history.load(), GB.offline.load()]);
      GB.reader.wbwHidden = await GB.store.kvGet('wbwHidden', false);
      await GB.lib.boot();
      document.body.classList.toggle('hosted', GB.lib.hosted);
      GB.home.render();
    } catch (e) { console.error(e); msg.textContent = 'Could not start: ' + e.message; return; }
    bootEl.classList.add('gone'); setTimeout(() => bootEl.remove(), 400);
    document.addEventListener('gb:library', () => GB.home.render());
    $('#fileAdd').addEventListener('change', e => addFiles(e.target.files));
    $('#fileRestore').addEventListener('change', e => { const f = e.target.files[0]; if (f) GB.doRestore(f); });
    window.addEventListener('dragover', e => { if (GB.lib.hosted) return; e.preventDefault(); document.body.classList.add('dropping'); });
    window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
    window.addEventListener('drop', e => { if (GB.lib.hosted) return; e.preventDefault(); document.body.classList.remove('dropping'); addFiles(e.dataTransfer.files); });
    document.addEventListener('keydown', e => {
      const t = e.target; const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === 'Escape') { if (GB.back()) e.preventDefault(); return; }
      if (typing) return;
      if (GB.reader.key(e)) e.preventDefault();
    });
    if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
      const ln = document.createElement('link'); ln.rel = 'manifest'; ln.href = 'manifest.webmanifest'; document.head.append(ln);
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('offline cache unavailable', e));
    }
    if (await openHash()) return;
    if (GB.prefs.openHistoryOnLaunch) { GB.historyPage(); return; }
    if (GB.isWide()) {
      const last = Array.from(GB.reading.map.values()).sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0];
      const B = last && GB.lib.book(last.id); if (B) GB.reader.openSaved(B, last);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.GB);
