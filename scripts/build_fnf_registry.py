"""Build the FNF registry from the ORIGINAL mirror files:
- every file: path, size, type
- png: real width/height (PIL)
- mp3/ogg: real duration (ffprobe)
- xml: spritesheet frame count (real SubTexture entries)
- json: real element counts/keys
- txt: line count
- states -> assets: string literals present in each state class body of
  Funkin.js matched against real file basenames (deterministic code reading).
Output: public/games/friday-night-funkin/registry.json
"""
import json
import os
import re
import subprocess

PROJ = '/home/z/my-project'
GAME = f'{PROJ}/public/games/friday-night-funkin'
OUT = f'{GAME}/registry.json'


def ffprobe_duration(path):
    try:
        r = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', path],
            capture_output=True, text=True, timeout=30)
        return round(float(r.stdout.strip()), 2)
    except Exception:
        return None


files = []
for dirpath, dirnames, fnames in os.walk(GAME):
    dirnames[:] = [d for d in dirnames if d != 'registry.json']
    rel_dir = os.path.relpath(dirpath, GAME)
    for fn in sorted(fnames):
        if fn == 'registry.json':
            continue
        rel = os.path.normpath(os.path.join(rel_dir, fn)) if rel_dir != '.' else fn
        if rel.startswith('_original'):
            continue
        p = os.path.join(dirpath, fn)
        ext = os.path.splitext(fn)[1].lower()
        entry = {'path': rel.replace(os.sep, '/'), 'type': ext[1:], 'sizeBytes': os.path.getsize(p)}
        try:
            if ext == '.png':
                from PIL import Image
                im = Image.open(p)
                entry['width'], entry['height'] = im.size
            elif ext in ('.mp3', '.ogg'):
                entry['durationSec'] = ffprobe_duration(p)
            elif ext == '.xml':
                data = open(p, encoding='utf8', errors='replace').read()
                sub = data.count('<SubTexture')
                if sub:
                    entry['subTextures'] = sub
                    names = re.findall(r'<SubTexture name="([^"]+)"', data)
                    entry['subTextureNames'] = names[:400]
                else:
                    entry['textLines'] = data.count('\n') + 1
            elif ext == '.json':
                try:
                    j = json.load(open(p, encoding='utf8'))
                    if isinstance(j, dict):
                        entry['jsonKeys'] = sorted(j.keys())[:30]
                        entry['jsonElements'] = len(j)
                    elif isinstance(j, list):
                        entry['jsonElements'] = len(j)
                        if j and isinstance(j[0], dict):
                            entry['jsonKeys'] = sorted(j[0].keys())[:30]
                except Exception:
                    pass
            elif ext in ('.txt', '.ini', '.dat', '.html'):
                data = open(p, encoding='utf8', errors='replace').read()
                entry['textLines'] = data.count('\n') + 1
        except Exception as e:
            entry['metaError'] = str(e)[:80]
        files.append(entry)

# ---- states -> assets from Funkin.js (deterministic code slicing) ----
src = open(f'{GAME}/Funkin.js', encoding='utf8', errors='replace').read()

# class body boundaries: 'var NameState = function(' ... next 'var X = function('
starts = [(m.start(), m.group(1)) for m in re.finditer(r'var\s+([A-Za-z_$][\w$]*State)\s*=\s*function\s*\(', src)]
states = []
for i, (pos, name) in enumerate(starts):
    end = starts[i + 1][0] if i + 1 < len(starts) else len(src)
    body = src[pos:end]
    literals = set(re.findall(r'"([^"\\\n]{1,120})"', body)) | set(re.findall(r"'([^'\\\n]{1,120})'", body))
    states.append({'state': name, 'offset': pos, 'literals': sorted(literals)})

# match literals against real files
by_base = {}
for f in files:
    base = os.path.splitext(os.path.basename(f['path']))[0]
    by_base.setdefault(base, []).append(f['path'])

state_assets = []
for st in states:
    refs = set()
    for lit in st['literals']:
        if lit in by_base:
            refs.update(by_base[lit])
    state_assets.append({
        'state': st['state'],
        'referencedFiles': sorted(refs),
    })

reg = {
    'game': 'friday-night-funkin',
    'engine': 'haxeflixel-openfl-html5',
    'source': 'Funkin.js + mirror file',
    'totals': {
        'files': len(files),
        'byType': {},
    },
    'files': files,
    'states': state_assets,
}
for f in files:
    reg['totals']['byType'][f['type']] = reg['totals']['byType'].get(f['type'], 0) + 1

json.dump(reg, open(OUT, 'w'), indent=1)
print('registry ->', OUT)
print('file totali:', len(files), '| per tipo:', reg['totals']['byType'])
print('stati analizzati:', len(states), '| con asset referenziati:', sum(1 for s in state_assets if s['referencedFiles']))
for s in state_assets:
    if s['referencedFiles']:
        print(' ', s['state'], '->', len(s['referencedFiles']), 'file')
