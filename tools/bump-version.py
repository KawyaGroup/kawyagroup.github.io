"""Stamp a new version on every JS/CSS reference so browsers load fresh files after an update.

Run from the site folder before pushing:  python tools/bump-version.py
GitHub Pages lets browsers cache files for ~10 minutes; a changed ?v= tag skips that cache.
All modules must share one tag, otherwise the same module could load twice.
"""
import pathlib, re, time

root = pathlib.Path(__file__).resolve().parent.parent
ver = time.strftime('%Y%m%d%H%M')
files = [root / 'index.html', root / 'admin.html', *sorted((root / 'js').glob('*.js'))]
pat = re.compile(r"""((?:src|href)="(?:js|css)/[\w.-]+\.(?:js|css)|from '\./[\w.-]+\.js|import\('\./[\w.-]+\.js)(?:\?v=\w+)?""")
for f in files:
    s = f.read_text(encoding='utf-8')
    n = pat.sub(lambda m: m.group(1) + '?v=' + ver, s)
    if n != s:
        f.write_text(n, encoding='utf-8')
print('version', ver)
