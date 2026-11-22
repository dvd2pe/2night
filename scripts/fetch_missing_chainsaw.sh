#!/bin/bash
# Completa il mirror del gioco Chainsaw Dance scaricando i file mancanti
# dal CDN pubblico CrazyGames (stessa origine del mirror presente nel repo).
BASE="https://chainsaw-dance.game-files.crazygames.com/chainsaw-dance/3/html5game"
DEST="/home/z/my-project/public/games/chainsaw-dance/html5game"
FILES="snd_makima_loop.ogg snd_makima_start.ogg snd_phut.ogg snd_tokyo.ogg snd_fresh.ogg snd_garden.ogg snd_dope.ogg snd_stars.ogg snd_fnf_score_screen.ogg dancedata.ini sets.ini dancer_sprite.png dancer_preview.png dancer_icon.png dancer_score_icon.png dancer_failing.png"
mkdir -p "$DEST"
for f in $FILES; do
  if [ -f "$DEST/$f" ]; then echo "SKIP $f"; continue; fi
  code=$(curl -s -o "$DEST/$f" -w "%{http_code}" --max-time 60 "$BASE/$f")
  if [ "$code" = "200" ] && [ -s "$DEST/$f" ]; then
    echo "OK   $f ($(stat -c%s "$DEST/$f") bytes)"
  else
    echo "FAIL $f (http $code)"
    rm -f "$DEST/$f"
  fi
done
