#!/bin/bash
# Completa il mirror di Friday Night Funkin' con i file mancanti dal CDN
BASE="https://friday-night-funkin.game-files.crazygames.com/friday-night-funkin/6"
DEST="/home/z/my-project/public/games/friday-night-funkin"
FILES="mods/introMod/_append/data/introText.txt mods/modList.txt mods/readme.txt assets/data/data-goes-here.txt assets/fonts/fonts-go-here.txt"
for f in $FILES; do
  mkdir -p "$DEST/$(dirname "$f")"
  if [ -f "$DEST/$f" ]; then echo "SKIP $f"; continue; fi
  code=$(curl -s -o "$DEST/$f" -w "%{http_code}" --max-time 30 "$BASE/$f")
  if [ "$code" = "200" ] && [ -s "$DEST/$f" ]; then
    echo "OK   $f ($(stat -c%s "$DEST/$f") bytes)"
  else
    echo "FAIL $f (http $code)"
    rm -f "$DEST/$f"
  fi
done
