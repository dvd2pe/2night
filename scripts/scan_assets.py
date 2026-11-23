#!/usr/bin/env python3
"""
Scanner GENERICO di asset per giochi HTML5 in public/games/.

Per ogni cartella gioco con un `game.config.json`:
  1. scansiona i file utente-visibili (immagini, audio, font, testi) — esclude codice;
  2. estrae metadati: dimensioni immagini (PIL), durata audio (mutagen),
     frame degli atlas Sparrow (PNG+XML), famiglia font TTF/OTF;
  3. applica le regole per-gioco (`asset.rules.json`) per associare
     schermate di gioco, ruolo e note reskin;
  4. genera `assets.manifest.json` per gioco e `index.json` per tutti.

Uso:  python3 scripts/scan_assets.py            # scansiona tutti i giochi
      python3 scripts/scan_assets.py <game-id>  # solo un gioco
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    from mutagen import File as MutaFile
except ImportError:
    MutaFile = None

ROOT = "/home/z/my-project/public/games"

IMAGE_EXTS = {"png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"}
AUDIO_EXTS = {"ogg", "mp3", "wav", "flac", "m4a"}
FONT_EXTS = {"woff", "woff2", "ttf", "otf"}
TEXT_EXTS = {"txt", "md"}

# nomi placeholder vuoti generati dai template engine: inutili all'utente
PLACEHOLDER_RE = re.compile(r"(stuff_here|goes-here|goes_here)\.(txt|png|xml)$")


def rel_url(game_id, rel):
    return f"/games/{game_id}/{rel}"


def image_meta(path):
    """Dimensioni immagine + frame atlas Sparrow se c'e' XML sibling."""
    meta = {}
    if Image and os.path.getsize(path) > 0:
        try:
            with Image.open(path) as im:
                meta["width"], meta["height"] = im.size
        except Exception:
            pass
    xml_path = os.path.splitext(path)[0] + ".xml"
    if os.path.exists(xml_path) and os.path.getsize(xml_path) > 0:
        try:
            import xml.etree.ElementTree as ET

            tree = ET.parse(xml_path)
            subs = tree.findall("SubTexture")
            if subs:
                frames = []
                maxw = maxh = 0
                for st in subs:
                    name = st.get("name", "")
                    w = int(float(st.get("width", 0) or 0))
                    h = int(float(st.get("height", 0) or 0))
                    maxw, maxh = max(maxw, w), max(maxh, h)
                    frames.append(name)
                # animazioni = prefisso del nome prima del primo gruppo di cifre
                anims = []
                for n in frames:
                    pref = re.sub(r"\d+.*$", "", n).strip()
                    if pref and pref not in anims:
                        anims.append(pref)
                meta["frames"] = {
                    "count": len(frames),
                    "animations": anims[:24],
                    "maxFrameWidth": maxw,
                    "maxFrameHeight": maxh,
                    "examples": frames[:8],
                }
        except Exception:
            pass
    return meta


def audio_meta(path):
    """Durata + bitrate/Hz audio via mutagen."""
    meta = {}
    if MutaFile and os.path.getsize(path) > 0:
        try:
            f = MutaFile(path)
            if f is not None and f.info is not None:
                if getattr(f.info, "length", None):
                    meta["durationSec"] = round(f.info.length, 2)
                if getattr(f.info, "sample_rate", None):
                    meta["sampleRate"] = f.info.sample_rate
                if getattr(f.info, "bitrate", None):
                    meta["bitrateKbps"] = int(f.info.bitrate / 1000)
                if getattr(f.info, "channels", None):
                    meta["channels"] = f.info.channels
        except Exception:
            pass
    return meta


def font_meta(path):
    """Famiglia font da TTF/OTF (name table). WOFF/WOFF2: solo size."""
    meta = {}
    ext = path.rsplit(".", 1)[-1].lower()
    if ext in ("ttf", "otf") and os.path.getsize(path) > 0:
        try:
            from PIL import ImageFont

            f = ImageFont.truetype(path)
            meta["fontFamily"] = f.getname()[0]
            meta["fontStyle"] = f.getname()[1]
        except Exception:
            pass
    return meta


def classify(rel, ext):
    if ext in IMAGE_EXTS:
        return "image"
    if ext in AUDIO_EXTS:
        return "audio"
    if ext in FONT_EXTS:
        return "font"
    if ext in TEXT_EXTS:
        return "text"
    return None


def scan_game(game_dir):
    game_id = os.path.basename(game_dir)
    cfg = json.load(open(os.path.join(game_dir, "game.config.json"), encoding="utf-8"))
    screens = []
    sp = os.path.join(game_dir, "screens.json")
    if os.path.exists(sp):
        screens = json.load(open(sp, encoding="utf-8")).get("screens", [])
    rules, excludes, notes = [], [], {}
    rp = os.path.join(game_dir, "asset.rules.json")
    if os.path.exists(rp):
        rj = json.load(open(rp, encoding="utf-8"))
        rules = rj.get("rules", [])
        excludes = rj.get("exclude", [])
        notes = rj.get("notes", {})

    exclude_res = [re.compile(x) for x in excludes]
    assets = []
    counters = {}

    for dirpath, dirnames, filenames in os.walk(game_dir):
        dirnames[:] = [d for d in dirnames if d != "manifest"]  # manifest OpenFL = codice
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, game_dir).replace(os.sep, "/")
            ext = fn.rsplit(".", 1)[-1].lower() if "." in fn else ""
            if ext == "xml":
                continue  # atlas metadata, allegati ai PNG sibling
            if ext not in (IMAGE_EXTS | AUDIO_EXTS | FONT_EXTS | TEXT_EXTS):
                continue
            if any(x.search(rel) for x in exclude_res):
                continue
            if PLACEHOLDER_RE.search(rel) or fn == "favicon.png":
                continue
            typ = classify(rel, ext)
            if typ is None:
                continue

            asset = {
                "path": rel,
                "url": rel_url(game_id, rel),
                "name": fn,
                "type": typ,
                "format": ext,
                "bytes": os.path.getsize(full),
                "screens": [],
                "role": typ,
                "note": "",
                "engine": rel.startswith("flixel/"),
            }
            if typ == "image":
                asset.update(image_meta(full))
                if os.path.exists(os.path.splitext(full)[0] + ".xml"):
                    asset["atlasXml"] = rel.rsplit(".", 1)[0] + ".xml"
                if asset.get("frames"):
                    asset["role"] = "sprite-atlas"
                asset.setdefault(
                    "reskin",
                    f"PNG stesso nome e stesse dimensioni ({asset.get('width','?')}x{asset.get('height','?')})"
                    + (", stesso layout frame dell'XML" if asset.get("frames") else ""),
                )
            elif typ == "audio":
                asset.update(audio_meta(full))
                asset.setdefault("reskin", "Stesso nome, formato e durata equivalente (loop se maricato come loop)")
            elif typ == "font":
                asset.update(font_meta(full))
                asset.setdefault("reskin", "Stesso nome file e stessa famiglia font")
            else:
                asset.setdefault("reskin", "Testo: stesso nome file")

            # applica le regole (la prima che matcha vince per screens/role/note)
            for rule in rules:
                m = re.search(rule["match"], rel)
                if m:
                    asset["screens"] = rule.get("screens", [])
                    if rule.get("role"):
                        asset["role"] = rule["role"]
                    note = rule.get("note", "")
                    if m.groups():
                        for g in m.groups():
                            if g:
                                note = note.replace("$1", g, 1)
                    asset["note"] = note
                    break
            counters[typ] = counters.get(typ, 0) + 1
            assets.append(asset)

    totals = {"all": len(assets), **counters}
    manifest = {
        "game": game_id,
        "name": cfg.get("name", game_id),
        "engine": cfg.get("engine", ""),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "description": cfg.get("description", ""),
        "controls": cfg.get("controls", ""),
        "bootDelayMs": cfg.get("bootDelayMs", 3000),
        "notes": notes,
        "totals": totals,
        "screens": screens,
        "assets": assets,
    }
    out = os.path.join(game_dir, "assets.manifest.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"{game_id}: {totals['all']} asset -> {out} ({', '.join(f'{k}={v}' for k, v in counters.items())})")
    return {
        "id": game_id,
        "name": cfg.get("name", game_id),
        "tag": cfg.get("tag", ""),
        "src": cfg.get("src", f"/games/{game_id}/index.html"),
        "description": cfg.get("description", ""),
        "assetCount": totals["all"],
        "manifest": f"/games/{game_id}/assets.manifest.json",
    }


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    games = []
    for d in sorted(os.listdir(ROOT)):
        gdir = os.path.join(ROOT, d)
        if not os.path.isdir(gdir):
            continue
        if not os.path.exists(os.path.join(gdir, "game.config.json")):
            continue
        if only and d != only:
            continue
        games.append(scan_game(gdir))

    # Scansionando un solo gioco NON si deve perdere l'indice degli altri:
    # merge con le voci ancora valide di index.json (ordine alfabetico).
    if only:
        index_path = os.path.join(ROOT, "index.json")
        existing = []
        if os.path.exists(index_path):
            try:
                existing = json.load(open(index_path, encoding="utf-8")).get("games", [])
            except Exception:
                existing = []
        scanned_ids = {g["id"] for g in games}
        for g in existing:
            meta_path = os.path.join(ROOT, g["id"], "game.config.json")
            if g["id"] not in scanned_ids and os.path.exists(meta_path):
                games.append(g)
        games.sort(key=lambda g: g["id"])

    index_path = os.path.join(ROOT, "index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "games": games}, f, ensure_ascii=False, indent=1)
    print(f"index: {len(games)} giochi -> {index_path}")


if __name__ == "__main__":
    main()
