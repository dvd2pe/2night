#!/usr/bin/env python3
# Raggruppa le regioni dell'atlante con contenuto PIXEL-IDENTICO (hash dei
# byte del crop): è una misura deterministica, non un'inferenza. Serve al
# reskin: sostituendo uno sprite, le copie identiche possono essere
# aggiornate insieme (caso gametitle/chainsawTitle in Chainsaw Dance).
# Aggiorna registry.json in place aggiungendo "identicalRects".

import json, os, sys, hashlib
import numpy as np
import cv2

def main(game_dir):
    reg_path = os.path.join(game_dir, "registry.json")
    reg = json.load(open(reg_path, encoding="utf-8"))
    pages = {}
    for t in reg["textures"]:
        p = os.path.join(game_dir, t["file"])
        if os.path.exists(p):
            pages[t["index"]] = cv2.imread(p, cv2.IMREAD_UNCHANGED)

    # hash -> lista di rect (con sprite proprietario)
    by_hash = {}
    for s in reg.get("sprites", []):
        for f in s.get("frames", []):
            page = pages.get(f["page"])
            if page is None:
                continue
            x, y, w, h = f["x"], f["y"], f["w"], f["h"]
            if y + h > page.shape[0] or x + w > page.shape[1] or w <= 0 or h <= 0:
                continue
            crop = np.ascontiguousarray(page[y:y + h, x:x + w])
            if crop.shape[2] == 4 and crop[:, :, 3].min() == 0:
                # le zone trasparenti possono differire di RGB senza effetto
                # visivo: normalizza i pixel trasparenti a zero
                mask = crop[:, :, 3] == 0
                crop[:, :, :3][mask] = 0
            digest = hashlib.md5(crop.tobytes()).hexdigest()
            by_hash.setdefault(digest, []).append({
                "page": f["page"], "x": x, "y": y, "w": w, "h": h,
                "sprite": s["name"],
            })

    identical = {}
    for digest, rects in by_hash.items():
        if len(rects) < 2:
            continue
        for r in rects:
            others = [o for o in rects if o is not r]
            key = f"{r['sprite']}:{r['page']}:{r['x']}:{r['y']}"
            identical.setdefault(key, [])
            for o in others:
                identical[key].append(o)

    # mappa per sprite -> lista di rect identici (esclusi i propri frame)
    per_sprite = {}
    for s in reg.get("sprites", []):
        own = {(f["page"], f["x"], f["y"], f["w"], f["h"]) for f in s.get("frames", [])}
        others = []
        for f in s.get("frames", []):
            key = f"{s['name']}:{f['page']}:{f['x']}:{f['y']}"
            for o in identical.get(key, []):
                k = (o["page"], o["x"], o["y"], o["w"], o["h"])
                if k not in own and o not in others:
                    others.append(o)
        if others:
            per_sprite[s["name"]] = others

    reg["identicalRects"] = per_sprite
    reg["verification"]["identicalRects"] = (
        "gruppi di regioni con contenuto pixel-identico (hash md5 del crop "
        "RGBA normalizzato): il reskin di uno sprite può aggiornare le copie"
    )
    with open(reg_path, "w", encoding="utf-8") as fh:
        json.dump(reg, fh, ensure_ascii=False, indent=1)
    total = sum(len(v) for v in per_sprite.values())
    print(f"sprite con copie identiche: {len(per_sprite)}, rect totali: {total}")
    for name, rects in list(per_sprite.items())[:8]:
        print(f"  {name}: {len(rects)} copie -> {[(r['sprite'], r['x'], r['y']) for r in rects[:3]]}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/public/games/chainsaw-dance")
