#!/usr/bin/env python3
"""Build this site from the Gitabase Reader web app (github.com/dasadasanudas/gitabase-reader-web, branch main).

  python3 mirror/build.py <checkout of the base repo> <this repo>

Same app, same books: the books stay on the base site and are read from there (catalog.json points at it),
so nothing big is copied. Only the name, title, icon text, loading quote and About quote come from brand.json.
Edit the app in the base repo; .github/workflows/mirror.yml copies every change here automatically.
"""
import json, re, shutil, subprocess, sys, tempfile, urllib.request
from pathlib import Path

BASE_SITE = 'https://dasadasanudas.github.io/gitabase-reader-web/'
KEEP = {'.git', '.github', 'mirror', 'brand.json', 'README.md', '.mirror-key', 'LICENSE', 'CNAME'}

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def brand_index(s, b):
    name, q, src = b['name'], b['quote'], b['source']
    s = re.sub(r'<title>.*?</title>', '<title>' + esc(name) + '</title>', s, count=1, flags=re.S)
    s = re.sub(r"APP_NAME:\s*'[^']*'", 'APP_NAME: ' + json.dumps(name) + ', BRAND: ' + json.dumps({'quote': q, 'source': src}, ensure_ascii=False), s, count=1)
    desc = b['tagline']
    meta = ('<meta name="description" content="' + esc(desc) + '">\n'
            '<meta property="og:title" content="' + esc(name) + '">\n'
            '<meta property="og:description" content="' + esc('“' + q + '” (' + src + ')') + '">\n'
            '<meta property="og:site_name" content="' + esc(name) + '">\n')
    s = s.replace('</title>', '</title>\n' + meta, 1)
    # loading screen: the quote right below the logo, then "Loading…"
    quote = ('<div class="boot-q"><div class="boot-qt">“' + esc(q) + '”</div><div class="boot-qs">' + esc(src) + '</div></div>')
    s2 = re.sub(r'(<div id="boot"><img[^>]*>)', lambda m: m.group(1) + quote, s, count=1)
    if s2 == s: raise SystemExit('index.html: loading screen not found')
    s = s2
    css = ('<style>#boot .boot-q{max-width:min(30em,84vw);text-align:center;display:grid;gap:6px;margin-top:2px}'
           '#boot .boot-qt{font:italic 19px/1.45 "Gaura Times","Noto Serif",Georgia,serif;color:var(--book-title,#1f3c35)}'
           '#boot .boot-qs{font:13px var(--ui,system-ui,sans-serif);opacity:.62;letter-spacing:.02em}'
           '.about .about-q{font-style:italic;margin:.2em 0 .1em}.about .about-qs{opacity:.65;font-size:.88em;margin-top:0}</style>\n')
    s = s.replace('</head>', css + '</head>', 1)
    # verse links without '#' (as on the base site), from the site root
    if 'name="gb-paths"' not in s:
        s = s.replace('<head>', '<head>\n<base href="/">\n<meta name="gb-paths" content="1">', 1)
    return s

def brand_about(p, b):
    s = p.read_text(encoding='utf-8')
    a = "h('p', null, h('b', { text: GB.APP_NAME })),"
    if a in s:
        s = s.replace(a, a + " ...(GB.BRAND ? [h('p.about-q', { text: '“' + GB.BRAND.quote + '”' }), h('p.about-qs', { text: GB.BRAND.source })] : []),", 1)
        p.write_text(s, encoding='utf-8')
    else: print('note: About dialog anchor not found, About keeps its old text')

def brand_sw(p):
    s = p.read_text(encoding='utf-8')
    a = "if (url.origin !== location.origin) return;"
    if a not in s: raise SystemExit('sw.js: origin check not found')
    # the books live on the base site: keep caching their chunks for offline reading
    s = s.replace(a, "if (url.origin !== location.origin && !url.href.startsWith(" + json.dumps(BASE_SITE + 'library/') + ")) return;", 1)
    p.write_text(s, encoding='utf-8')


# ---------- no "gitabase" anywhere people can see it ----------
SPECIAL = {'sb_gitabase_linked_cantofixed': 'sb_hin'}
def clean_name(n):
    """gitabase_texts_eng.db -> texts_eng.db, SB_Gitabase_Linked_CantoFixed.db -> sb_hin.db (the language part stays: the reader reads it)."""
    stem, dot, ext = n.rpartition('.')
    if not dot: stem, ext = n, ''
    k = SPECIAL.get(stem.lower())
    if k: stem = k
    else:
        parts = [x for x in re.split(r'([_\- .]+)', stem)]
        out = [x for x in parts if x.lower() != 'gitabase']
        stem = re.sub(r'^[_\- .]+|[_\- .]+$', '', re.sub(r'([_\- .])[_\- .]+', r'\1', ''.join(out))) or 'books'
    return stem + ('.' + ext if ext and ext.lower() != 'gitabase' else '.db')

PROSE = [(re.compile(r'book files in the gitabase format'), '.db book files'), (re.compile(r'\bgitabases\b'), 'book files'), (re.compile(r'\bgitabase format\b'), 'book file format'),
         (re.compile(r'\bgitabase files?\b'), lambda m: 'book file' + ('s' if m.group(0).endswith('s') else '')),
         (re.compile(r'\bGitabase books\b'), 'books'), (re.compile(r'\bgitabase\b'), 'book file')]
STR = re.compile(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`")
def scrub_text(s, name):
    s = s.replace('Gitabase Reader web', name).replace('Gitabase Reader', name).replace('Drop .db / .gitabase files', 'Drop .db files')
    def fix(m):
        t = m.group(0)
        if ' ' not in t or not re.search(r'(?i)gitabase', t): return t   # ids, file names, extensions: untouched
        for rx, rep in PROSE: t = rx.sub(rep, t)
        return t.replace('.db / files', '.db files').replace('.db /  files', '.db files')
    s = STR.sub(fix, s)
    return s
def scrub_site(site, name, slug):
    for p in list(site.rglob('*.js')) + list(site.rglob('*.css')) + [site / 'index.html']:
        s = p.read_text(encoding='utf-8'); t = scrub_text(s, name)
        if p.name == 'notes.js': t = t.replace("'gitabase-notes-'", "'" + slug + "-notes-'")
        if t == s: continue
        p.write_text(t, encoding='utf-8')
        # a word swap must never break the app: a file that no longer parses keeps its original text
        if p.suffix == '.js' and shutil.which('node') and subprocess.run(['node', '--check', str(p)], capture_output=True).returncode != 0:
            p.write_text(s, encoding='utf-8'); print('note: kept', p.name, 'unchanged (the swap broke its syntax)')
    left = []
    for p in list(site.rglob('*.js')) + [site / 'index.html']:
        for m in STR.finditer(p.read_text(encoding='utf-8')):
            if ' ' in m.group(0) and re.search(r'(?i)gitabase', m.group(0)): left.append(p.name + ': ' + m.group(0)[:90])
    print('visible "gitabase" left:', len(left)); [print('  ', x) for x in left]

def main():
    base, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    b = json.loads((out / 'brand.json').read_text(encoding='utf-8'))
    sys.path.insert(0, str(base / 'tools'))
    import os; os.chdir(base)
    import build_site
    with tempfile.TemporaryDirectory() as t:
        t = Path(t); site = t / 'site'; site.mkdir()
        if build_site.ZIP.exists(): build_site.unpack_zip(site, t)
        build_site.copy_app(site)
        # books: the base site's catalogue, every file pointing at the base site
        src = os.environ.get('MIRROR_CATALOG')  # tests only: a local catalogue instead of the live one
        raw = Path(src).read_bytes() if src else urllib.request.urlopen(BASE_SITE + 'library/catalog.json', timeout=60).read()
        cat = json.loads(raw.decode('utf-8'))
        for f in cat.get('files', []):
            if not re.match(r'^https?://', f.get('base', '')): f['base'] = BASE_SITE + f['base']
            if f.get('name'): f['name'] = clean_name(f['name'])
        (site / 'library').mkdir(exist_ok=True)
        (site / 'library/catalog.json').write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        scrub_site(site, b['name'], re.sub(r'[^a-z0-9]+', '-', b['name'].lower()).strip('-'))
        ix = site / 'index.html'; s = brand_index(ix.read_text(encoding='utf-8'), b)
        ix.write_text(s, encoding='utf-8'); (site / '404.html').write_text(s, encoding='utf-8')
        mf = site / 'manifest.webmanifest'; m = json.loads(mf.read_text(encoding='utf-8'))
        m['name'] = b['name']; m['short_name'] = b['short']; m['description'] = b['tagline']
        mf.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')
        if (site / 'js/ui-extra.js').exists(): brand_about(site / 'js/ui-extra.js', b)
        brand_sw(site / 'sw.js')
        (site / '.nojekyll').write_text('')
        build_site.stamp_sw(site)
        for p in out.iterdir():
            if p.name in KEEP: continue
            shutil.rmtree(p) if p.is_dir() else p.unlink()
        for p in site.iterdir():
            shutil.move(str(p), str(out / p.name))
    print('built', b['name'], 'from', base)

if __name__ == '__main__': main()
