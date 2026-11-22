#!/bin/bash
# Completa TUTTI gli asset mancanti di FNF dal CDN CrazyGames (lista da manifest)
BASE="https://friday-night-funkin.game-files.crazygames.com/friday-night-funkin/6"
DEST="/home/z/my-project/public/games/friday-night-funkin"
OK=0; FAIL=0; FAILED=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  mkdir -p "$DEST/$(dirname "$f")"
  if [ -f "$DEST/$f" ] && [ -s "$DEST/$f" ]; then OK=$((OK+1)); continue; fi
  code=$(curl -s -o "$DEST/$f" -w "%{http_code}" --max-time 120 "$BASE/$f")
  if [ "$code" = "200" ] && [ -s "$DEST/$f" ]; then
    OK=$((OK+1)); echo "OK   $f"
  elif [ "$code" = "200" ]; then
    # file legittimamente vuoto (placeholder 0-byte)
    OK=$((OK+1)); echo "OK0  $f (vuoto)"
  else
    FAIL=$((FAIL+1)); FAILED="$FAILED
  $f (http $code)"; rm -f "$DEST/$f"
  fi
done < /home/z/my-project/scripts/fnf_missing_full.txt
echo; echo "completati/presenti: $OK - falliti: $FAIL"
echo "falliti:$FAILED"
