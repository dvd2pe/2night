#!/usr/bin/env python3
"""Inietta i bridge di input per l'automazione schermate:

1. `index.html` di ogni gioco: interceptor addEventListener che raccoglie
   i listener keydown/keyup del gioco e li espone come window.__sendKey
   (funziona per engine che accettano eventi sintetici, es. GameMaker).

2. `*.js` engine OpenFL/lime (es. Funkin.js): espone le funzioni interne
   __onLimeKeyDown/__onLimeKeyUp come window.__openflKeyDown/Up, cosi'
   il parent puo' iniettare input DIRETTAMENTE nel motore (necessario per
   engine che ignorano gli eventi DOM sintetici).
"""
import os
import re

GAMES_ROOT = "/home/z/my-project/public/games"

INTERCEPTOR = """    <script>
    // Bridge tasti per il pannello asset 2Night: cattura i listener
    // keydown/keyup registrati dal gioco e permette al parent di
    // invocarli direttamente (window.__sendKey). Fallback sicuro.
    (function () {
        try {
            if (window.__sendKey) return;
            window.__keyHandlers = [];
            var origAdd = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (type, fn, opts) {
                if ((type === 'keydown' || type === 'keyup') && typeof fn === 'function') {
                    window.__keyHandlers.push({ target: this, fn: fn, type: type });
                }
                return origAdd.call(this, type, fn, opts);
            };
            window.__sendKey = function (key, keyCode) {
                var sent = 0;
                var handlers = window.__keyHandlers;
                for (var i = 0; i < handlers.length; i++) {
                    var h = handlers[i];
                    try {
                        var e = new KeyboardEvent(h.type, {
                            key: key,
                            code: key,
                            bubbles: true,
                            cancelable: true
                        });
                        Object.defineProperty(e, 'keyCode', { get: function () { return keyCode; } });
                        Object.defineProperty(e, 'which', { get: function () { return keyCode; } });
                        h.fn.call(h.target, e);
                        sent++;
                    } catch (err) { /* listener rifiutato: ignora */ }
                }
                return sent;
            };
        } catch (err) { /* niente bridge, il gioco funziona comunque */ }
    })();
    </script>
"""

OPENFL_PATCH = """$window.onKeyDown.add(tmp); window.__openflKeyDown = _g9; window.__openflKeyDownWin = window10; window.__openflKeyUp = _g10; window.__openflKeyUpWin = window11;"""


def patch_index_html():
    for game in sorted(os.listdir(GAMES_ROOT)):
        idx = os.path.join(GAMES_ROOT, game, "index.html")
        if not os.path.isfile(idx):
            continue
        s = open(idx, encoding="utf-8").read()
        if "__sendKey" in s:
            print(f"{game}: interceptor gia' presente")
            continue
        if re.search(r"<head[^>]*>", s):
            s = re.sub(r"(<head[^>]*>)", r"\1\n" + INTERCEPTOR, s, count=1)
        else:
            s = INTERCEPTOR + s
        open(idx, "w", encoding="utf-8").write(s)
        print(f"{game}: interceptor iniettato")


def patch_openfl_js():
    for game in sorted(os.listdir(GAMES_ROOT)):
        gdir = os.path.join(GAMES_ROOT, game)
        if not os.path.isdir(gdir):
            continue
        for fn in os.listdir(gdir):
            if not fn.endswith(".js"):
                continue
            path = os.path.join(gdir, fn)
            if os.path.getsize(path) > 40 * 1024 * 1024:
                continue
            s = open(path, encoding="utf-8", errors="ignore").read()
            if "__openflKeyDown" in s:
                print(f"{game}/{fn}: patch openfl gia' presente")
                continue
            needle = "$window.onKeyDown.add(tmp);"
            if needle not in s or "$bind(this, this.__onLimeKeyUp)" not in s:
                continue
            i = s.find(needle)
            s = s[:i] + OPENFL_PATCH + s[i + len(needle):]
            open(path, "w", encoding="utf-8").write(s)
            print(f"{game}/{fn}: patch openfl applicata")


if __name__ == "__main__":
    patch_index_html()
    patch_openfl_js()
