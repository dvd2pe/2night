"""Scan both game mirrors for corrupted files (saved CDN error pages,
wrong magic bytes)."""
import os
import json

ROOTS = [
    '/home/z/my-project/public/games/chainsaw-dance',
    '/home/z/my-project/public/games/friday-night-funkin',
]

MAGIC = {
    '.ogg': b'OggS',
    '.png': b'\x89PNG',
    '.js': None,
    '.html': None,
    '.json': None,
    '.xml': None,
    '.txt': None,
    '.ini': None,
    '.dat': None,
    '.mp3': None,
    '.woff': None,
    '.svg': None,
}

ERROR_MARKS = [b'<Error>', b'NoSuchKey', b'AccessDenied', b'<?xml version="1.0" encoding="UTF-8"?>\n<Error']


def is_error_page(head):
    return any(m in head for m in ERROR_MARKS)


def check_magic(path, ext):
    m = MAGIC.get(ext)
    if not m:
        return None
    with open(path, 'rb') as f:
        head = f.read(16)
    return head.startswith(m)


def audio_ok(path):
    with open(path, 'rb') as f:
        head = f.read(4)
    return head.startswith(b'OggS') or head.startswith(b'ID3') or head[0] == 0xFF


report = []
for root in ROOTS:
    for dirpath, _, files in os.walk(root):
        for fn in files:
            p = os.path.join(dirpath, fn)
            ext = os.path.splitext(fn)[1].lower()
            try:
                with open(p, 'rb') as f:
                    head = f.read(4096)
            except OSError as e:
                report.append({'file': p, 'problem': 'unreadable: ' + str(e)})
                continue
            problems = []
            if is_error_page(head):
                problems.append('CDN error page')
            if ext == '.ogg' and not head.startswith(b'OggS'):
                problems.append('ogg without OggS magic: ' + head[:8].hex())
            if ext == '.mp3' and not (head.startswith(b'ID3') or (head and head[0] == 0xFF)):
                problems.append('mp3 without valid magic: ' + head[:8].hex())
            if ext == '.png' and not head.startswith(b'\x89PNG'):
                problems.append('png without PNG magic: ' + head[:8].hex())
            if ext in ('.json',) and head.strip() and not head.strip().startswith((b'{', b'[')):
                problems.append('json without braces: ' + head[:40].decode('utf8', 'replace'))
            if problems:
                report.append({'file': p, 'problem': '; '.join(problems), 'size': os.path.getsize(p)})

print(json.dumps(report, indent=1))
print('totale file con problemi:', len(report))
