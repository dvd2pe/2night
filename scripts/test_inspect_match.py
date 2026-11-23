#!/usr/bin/env python3
# Test del matcher: incolla crop reali degli sprite in un canvas sintetico
# e verifica che il matcher li trovi alle coordinate esatte.
import json, subprocess, sys, base64
import numpy as np
import cv2

GAME = "/home/z/my-project/public/games/chainsaw-dance"
reg = json.load(open(GAME + "/registry.json", encoding="utf-8"))

pages = {}
for t in reg["textures"]:
    pages[t["index"]] = cv2.imread(GAME + "/" + t["file"], cv2.IMREAD_UNCHANGED)

canvas = np.zeros((540, 960, 3), dtype=np.uint8)
expected = []
# prendi 5 sprite visibili di dimensioni varie
chosen = [s for s in reg["sprites"] if s["width"] and s["width"] >= 8 and s["height"] >= 8][:40]
spots = [(20, 20), (500, 60), (300, 300), (700, 420), (120, 460)]
i = 0
for s in chosen:
    if i >= len(spots):
        break
    f = s["frames"][0]
    page = pages[f["page"]]
    x, y, w, h = f["x"], f["y"], f["w"], f["h"]
    crop = page[y:y + h, x:x + w]
    if crop.shape[2] == 4:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGRA2BGR)
    sx, sy = spots[i]
    if sy + h > 540 or sx + w > 960:
        continue
    canvas[sy:sy + h, sx:sx + w] = crop
    expected.append((s["name"], sx, sy, w, h))
    i += 1

ok, buf = cv2.imencode(".png", canvas)
data_url = "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()

proc = subprocess.run(
    [sys.executable, "/home/z/my-project/scripts/inspect_match.py"],
    input=json.dumps({"gameDir": GAME, "image": data_url}),
    capture_output=True, text=True, timeout=180,
)
if proc.returncode != 0:
    print("ERRORE:", proc.stderr[-800:])
    sys.exit(1)
res = json.loads(proc.stdout)
found = {(m["name"], m["x"], m["y"]) for m in res["matches"]}
print("stats:", json.dumps(res["stats"]))
print(f"attesi {len(expected)}:")
fails = 0
for name, sx, sy, w, h in expected:
    hit = (name, sx, sy) in found
    if not hit:
        fails += 1
        near = [m for m in res["matches"] if m["name"] == name]
        print(f"  MANCATO {name} @({sx},{sy}) {w}x{h} - trovati: {near[:2]}")
    else:
        print(f"  ok {name} @({sx},{sy})")
print(f"trovati {len(res['matches'])} match totali (attesi >= {len(expected)}), mancati: {fails}")
