"""Empirically locate sprite content near declared rects to discover the
true convention (padding, trim, flip)."""
import json
from PIL import Image

d = json.load(open('/home/z/my-project/scripts/gm_root_dump.json'))
rc = d['_B4']
sp = d['_41']

pages = {i: Image.open(f'/home/z/my-project/public/games/chainsaw-dance/html5game/benedance_texture_{i}.png').convert('RGBA') for i in (0, 1)}

# total area + duplicates
area = sum(r.get('_G4', 0) * r.get('_H4', 0) for r in rc)
uniq = len({(r.get('x'), r.get('y'), r.get('_G4'), r.get('_H4'), r.get('_I4')) for r in rc})
print('area totale celle:', area, '| 2 pagine:', 2 * 2048 * 2048, '| rect unici:', uniq, '/', len(rc))

# pick single-frame sprites with declared width/height matching rect size
picks = []
for s in sp:
    fr = s.get('_e1', [])
    if len(fr) == 1 and 'width' in s and 'height' in s:
        r = rc[fr[0]]
        if r.get('_G4') == s['width'] and r.get('_H4') == s['height'] and s['width'] >= 24 and s['width'] <= 400:
            picks.append((s['_W'], s['width'], s['height'], r))
    if len(picks) >= 12:
        break

for (name, w, h, r) in picks:
    pg = r.get('_I4')
    x, y = r['x'], r['y']
    im = pages[pg]
    x0, y0 = max(0, x - 30), max(0, y - 30)
    x1, y1 = min(2048, x + w + 30), min(2048, y + h + 30)
    region = im.crop((x0, y0, x1, y1))
    bbox = region.getbbox()  # bbox of non-zero pixels (any channel)
    alpha_bbox = region.split()[3].getbbox()
    print(f'{name}: rect=({x},{y},{w},{h}) page{pg} | alphaBBox regione +-30: {alpha_bbox} -> assoluto: '
          f'{(alpha_bbox[0]+x0, alpha_bbox[1]+y0, alpha_bbox[2]+x0, alpha_bbox[3]+y0) if alpha_bbox else None} | alpha che chiama rect: '
          f'{(x0,y0,x1,y1)}')
