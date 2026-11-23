#!/usr/bin/env python3
"""Estrae tutti i riferimenti audio (music/sounds/songs) da Funkin.js
e verifica esistenza locale + CDN, producendo la lista da scaricare."""
import re, os, urllib.parse

JS = '/home/z/my-project/public/games/friday-night-funkin/Funkin.js'
ROOT = '/home/z/my-project/public/games/friday-night-funkin'
CDN = 'https://friday-night-funkin.game-files.crazygames.com/friday-night-funkin/6'

s = open(JS, encoding='utf-8', errors='ignore').read()

# 1) musica con nome letterale: getPath("music/" + "NAME" + "." + "mp3"
music_names = set(re.findall(r'"music/" \+ "([A-Za-z0-9_\-]+)" \+ "\." \+ "mp3"', s))
# 2) suoni: Paths.sound("name") / getPath("sounds/" + "name" ...
sound_names = set(re.findall(r'Paths\.sound\("([A-Za-z0-9_\-]+)"\)', s))
sound_names |= set(re.findall(r'"sounds/" \+ "([A-Za-z0-9_\-]+)"', s))
# 3) canzoni = cartelle chart in assets/data
songs = []
data_dir = os.path.join(ROOT, 'assets/data')
for d in os.listdir(data_dir):
    if os.path.isdir(os.path.join(data_dir, d)):
        songs.append(d)

paths = set()
for m in music_names:
    paths.add(f'assets/music/{m}.mp3')
for m in sound_names:
    paths.add(f'assets/sounds/{m}.mp3')
for song in songs:
    paths.add(f'assets/songs/{song}/Inst.mp3')
    paths.add(f'assets/songs/{song}/Voices.mp3')

print('canzoni trovate:', len(songs), sorted(songs))
print('nomi musica:', sorted(music_names))
print('nomi suoni:', sorted(sound_names))
print()
missing = [p for p in sorted(paths) if not os.path.exists(os.path.join(ROOT, p))]
print('riferimenti totali:', len(paths), '- mancanti locali:', len(missing))
for p in missing:
    print('  ', p)

# scrive lista per il downloader
with open('/home/z/my-project/scripts/fnf_missing_audio.txt', 'w') as f:
    f.write('\n'.join(missing))
print('\nlista salvata in scripts/fnf_missing_audio.txt')
