#!/bin/bash
# Completa gli audio mancanti di FNF dal CDN CrazyGames
BASE="https://friday-night-funkin.game-files.crazygames.com/friday-night-funkin/6"
DEST="/home/z/my-project/public/games/friday-night-funkin"
OK=0; FAIL=0; FAILED=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  mkdir -p "$DEST/$(dirname "$f")"
  if [ -f "$DEST/$f" ] && [ -s "$DEST/$f" ]; then echo "SKIP $f"; OK=$((OK+1)); continue; fi
  code=$(curl -s -o "$DEST/$f" -w "%{http_code}" --max-time 120 "$BASE/$f")
  if [ "$code" = "200" ] && [ -s "$DEST/$f" ]; then
    echo "OK   $f ($(stat -c%s "$DEST/$f") bytes)"; OK=$((OK+1))
  else
    echo "FAIL $f (http $code)"; FAIL=$((FAIL+1)); FAILED="$FAILED $f"; rm -f "$DEST/$f"
  fi
done < /home/z/my-project/scripts/fnf_missing_audio.txt
echo; echo "scaricati/presenti: $OK - falliti: $FAIL"
echo "falliti:$FAILED"
