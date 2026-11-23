"""Enrich the raw GM registry with real file metadata (audio durations,
texture sizes, cross-sprite shared regions) and write the final registry."""
import json
import os
import subprocess

PROJ = '/home/z/my-project'
RAW = f'{PROJ}/scripts/gm_raw_registry.json'
OUT = f'{PROJ}/public/games/chainsaw-dance/registry.json'
HTML = f'{PROJ}/public/games/chainsaw-dance/html5game'


def ffprobe_duration(path):
    try:
        r = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', path],
            capture_output=True, text=True, timeout=30)
        return round(float(r.stdout.strip()), 2)
    except Exception:
        return None


reg = json.load(open(RAW))

# textures: real sizes via PIL
from PIL import Image
for t in reg['textures']:
    p = os.path.join(PROJ, 'public/games/chainsaw-dance', t['file'])
    im = Image.open(p)
    t['width'], t['height'] = im.size
    t['sizeBytes'] = os.path.getsize(p)

# audio: real durations + presence + size
missing = []
for a in reg['audio']:
    p = os.path.join(PROJ, 'public/games/chainsaw-dance', a['file'])
    if os.path.exists(p):
        a['present'] = True
        a['sizeBytes'] = os.path.getsize(p)
        a['durationSec'] = ffprobe_duration(p)
    else:
        a['present'] = False
        missing.append(a['file'])

# shared regions by geometry key (different rectIndex, same pixels)
geo = {}
for s in reg['sprites']:
    for fr in s['frames']:
        key = (fr['page'], fr['x'], fr['y'], fr['w'], fr['h'])
        geo.setdefault(key, []).append({'sprite': s['name'], 'spriteIndex': s['index'], 'frame': fr['rectIndex']})
shared = {k: v for k, v in geo.items() if len(v) > 1}
reg['sharedRegions'] = [
    {'region': {'page': k[0], 'x': k[1], 'y': k[2], 'w': k[3], 'h': k[4]}, 'users': v}
    for k, v in shared.items()
]

# verification summary
n_frames = sum(s['frameCount'] for s in reg['sprites'])
bad_rects = [
    fr for s in reg['sprites'] for fr in s['frames']
    if None in (fr['x'], fr['y'], fr['w'], fr['h']) or fr['x'] < 0 or fr['y'] < 0
]
objects_named = [o['name'] for o in reg['objects']]
insts = reg['rooms'][0]['instances'] if reg['rooms'] else []
bad_inst = [i for i in insts if i['objectName'] is None]

reg['verification'] = {
    'spriteFrames': n_frames,
    'framesOutOfRange': len(bad_rects),
    'roomInstances': len(insts),
    'instancesWithUnknownObject': len(bad_inst),
    'audioMissingOnDisk': missing,
    'sharedRegions': len(shared),
    'source': 'tutti i valori provengono dal registro compilato originale in benedance.js (variabile _M); semantica rect verificata sui pixel degli atlanti',
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(reg, open(OUT, 'w'), indent=1)

v = reg['verification']
print('registry ->', OUT)
print('sprite:', len(reg['sprites']), '| frame totali:', v['spriteFrames'],
      '| rect fuori range:', v['framesOutOfRange'])
print('istanze room:', v['roomInstances'], '| istanze con oggetto sconosciuto:', v['instancesWithUnknownObject'])
print('audio presenti:', sum(1 for a in reg['audio'] if a['present']), '| mancanti:', v['audioMissingOnDisk'])
print('regioni condivise:', v['sharedRegions'])
