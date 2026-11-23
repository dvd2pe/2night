#!/usr/bin/env python3
"""Confronta TUTTI i manifest asset embedded in Funkin.js con i file su disco."""
import re, os, urllib.parse

JS = '/home/z/my-project/public/games/friday-night-funkin/Funkin.js'
ROOT = '/home/z/my-project/public/games/friday-night-funkin'

s = open(JS, encoding='utf-8', errors='ignore').read()

seen = set()
assets = []
for m in re.finditer(r'(?:R0y|pathy)(\d+):', s):
    ln = int(m.group(1))
    start = m.end()
    enc = s[start:start + ln]
    # deve essere un percorso asset valido (non contenere spazi/parentesi)
    if not re.fullmatch(r'[0-9A-Za-z%_\-.]+', enc):
        continue
    path = urllib.parse.unquote(enc.replace('%2F', '/'))
    if not (path.startswith('assets/') or path.startswith('mods/') or path.startswith('flixel/')):
        continue
    if path in seen:
        continue
    seen.add(path)
    assets.append(path)

print('asset totali univoci nel manifest:', len(assets))
missing = [p for p in assets if not os.path.exists(os.path.join(ROOT, p))]
print('MANCANTI dal filesystem:', len(missing))
for p in missing:
    print(' ', p)
