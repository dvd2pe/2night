"""Probe the internal structure of the GameMaker HTML5 game file.
Goal: locate the original asset registry (sprites/rooms/audio) embedded in the JS.
"""
import re
import sys

P = '/home/z/my-project/public/games/chainsaw-dance/html5game/benedance.js'
d = open(P, encoding='utf8', errors='replace').read()
print('file len:', len(d))


def ctx(s, n=2, b=280):
    out = []
    start = 0
    for _ in range(n):
        i = d.find(s, start)
        if i < 0:
            break
        out.append(d[max(0, i - b):i + b].replace('\n', '\\n'))
        start = i + 1
    return out


keys = ['benedance_texture_0', 'resources.dat', 'audio_play_sound',
        'snd_makima_loop', 'draw_text', 'JSON.parse', 'pako',
        'inflate', 'atob(', 'charCodeAt', 'kobeni', 'makima', 'KOBENI']
for key in keys:
    print('=' * 25, key)
    for c in ctx(key):
        print('   ...', c[:600])

# longest double-quoted and single-quoted literals
best = re.findall(r'"[^"\\\n]{1500,}"', d) + re.findall(r"'[^'\\\n]{1500,}'", d)
best.sort(key=len, reverse=True)
print('=' * 25, 'long literals:', len(best))
for s in best[:8]:
    print(len(s), '|', s[:150], '...', s[-100:])

# base64-like candidates
b64 = re.findall(r'"([A-Za-z0-9+/]{500,}={0,2})"', d)
print('=' * 25, 'b64-like candidates:', len(b64))
for s in b64[:10]:
    print(len(s), s[:120])

# hex-ish / escaped-char blobs
esc = re.findall(r'"((?:\\x[0-9a-fA-F]{2}){200,})"', d)
print('=' * 25, 'hex-escaped blobs:', len(esc))
for s in esc[:6]:
    print(len(s), s[:120])
