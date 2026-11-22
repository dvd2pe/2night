#!/usr/bin/env python3
"""Estrae tutti i percorsi asset dai manifest OpenFL (formato haxe serializzato)
e verifica/downliada quelli mancanti dal CDN."""
import re, os, urllib.parse, json

ROOT = '/home/z/my-project/public/games/friday-night-funkin'
CDN = 'https://friday-night-funkin.game-files.crazygames.com/friday-night-funkin/6'

missing = []
for mf in sorted(os.listdir(os.path.join(ROOT, 'manifest'))):
    data = json.load(open(os.path.join(ROOT, 'manifest', mf)))
    s = data.get('assets', '')
    if not s:
        continue
    paths = set()
    for m in re.finditer(r'(?:R0y|pathy|R5y)(\d+):', s):
        ln = int(m.group(1))
        enc = s[m.end():m.end() + ln]
        if not re.fullmatch(r'[0-9A-Za-z%_\-.]+', enc):
            continue
        p = urllib.parse.unquote(enc.replace('%2F', '/'))
        if p.startswith('assets/') or p.startswith('mods/') or p.startswith('flixel/'):
            paths.add(p)
    for p in sorted(paths):
        full = os.path.join(ROOT, p)
        if not os.path.exists(full):
            missing.append((mf, p))
            print(f'[{mf}] MANCA: {p}')

print()
print('totale mancanti:', len(missing))
