"""Determine the true coordinate convention of GM texture rects (_B4)
by testing hypotheses against the real atlas pages (overflow, overlap, alpha content)."""
import json
from PIL import Image

d = json.load(open('/home/z/my-project/scripts/gm_root_dump.json'))
rc = d['_B4']

pages = {i: Image.open(f'/home/z/my-project/public/games/chainsaw-dance/html5game/benedance_texture_{i}.png').convert('RGBA') for i in (0, 1)}

def test(fn, name):
    ovf = 0
    overlap = 0
    empty = 0
    checked = 0
    per_page = {}
    for pg in (0, 1):
        rects = [r for r in rc if r.get('_I4') == pg]
        boxes = []
        bad = 0
        for r in rects:
            x, y = r.get('x'), r.get('y')
            w, h = r.get('_G4'), r.get('_H4')
            bx, by = fn(x, y, w, h)
            if bx < 0 or by < 0 or bx + w > 2048 or by + h > 2048:
                bad += 1
                continue
            boxes.append((bx, by, w, h))
        # pairwise overlap
        ol = 0
        for i in range(len(boxes)):
            x1, y1, w1, h1 = boxes[i]
            for j in range(i + 1, len(boxes)):
                x2, y2, w2, h2 = boxes[j]
                if x1 < x2 + w2 and x2 < x1 + w1 and y1 < y2 + h2 and y2 < y1 + h1:
                    ol += 1
        # sample alpha content on up to 60 rects
        emp = 0
        samp = boxes[::max(1, len(boxes) // 60)][:60]
        for (x, y, w, h) in samp:
            im = pages[pg].crop((x, y, x + w, y + h))
            if im.getextrema()[3][1] == 0:
                emp += 1
        per_page[pg] = (len(rects), bad, ol, emp)
        ovf += bad
        overlap += ol
        empty += emp
        checked += len(boxes)
    print(f'{name}: overflow={ovf} overlap={overlap} emptyCrops={empty}/{checked} perPage={per_page}')

test(lambda x, y, w, h: (x, y), 'A top-left (x,y)')
test(lambda x, y, w, h: (x - w // 2, y - h // 2), 'B center (x,y)')
test(lambda x, y, w, h: (x - w, y - h), 'C bottom-right')
test(lambda x, y, w, h: (x - w // 2, y), 'D top-center-x')
test(lambda x, y, w, h: (x, y - h), 'E bottom-left-y')

# stats on _Y1/_Z1 vs _G4/_H4
diff = sum(1 for r in rc if (r.get('_Y1'), r.get('_Z1')) != (r.get('_G4'), r.get('_H4')))
print('rects con _Y1/_Z1 != _G4/_H4:', diff, 'su', len(rc))
print('esempio mismatch:', [ {k: r.get(k) for k in ('_W' if '_W' in r else 'x','y','_Y1','_Z1','_E4','_F4','_G4','_H4','_I4')} for r in rc if (r.get('_Y1'), r.get('_Z1')) != (r.get('_G4'), r.get('_H4')) ][:4])
