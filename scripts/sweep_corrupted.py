#!/usr/bin/env python3
# Sweep dei file del mirror: segnalany file di media (.png/.ogg/.mp3/.dat/...)
# che in realtà contengono pagine di errore del CDN (NoSuchKey/AccessDenied
# XML di S3 o HTML di errore). Questi file NON sono asset originali: vanno
# riscaricati dal CDN o rimossi.

import os, sys

ROOT = "/home/z/my-project/public/games"
MEDIA_EXT = {".png", ".ogg", ".mp3", ".wav", ".dat", ".ini", ".json", ".xml", ".txt", ".ttf", ".woff"}
MARKERS = (b"NoSuchKey", b"AccessDenied", b"<Error>", b"Error Code:", b"Code: NotFound")

bad = []
checked = 0
for dp, dn, fn in os.walk(ROOT):
    if "_original" in dp:
        continue
    for f in fn:
        p = os.path.join(dp, f)
        ext = os.path.splitext(f)[1].lower()
        if ext not in MEDIA_EXT:
            continue
        try:
            size = os.path.getsize(p)
            head = open(p, "rb").read(4096)
        except OSError:
            continue
        checked += 1
        if any(m in head for m in MARKERS):
            rel = os.path.relpath(p, ROOT)
            bad.append((rel, size, head[:60]))

print(f"controllati {checked} file media")
if not bad:
    print("nessun file corrotto: OK")
for rel, size, head in bad:
    print(f"  CORROTTO {rel} ({size} B): {head[:60]!r}")
