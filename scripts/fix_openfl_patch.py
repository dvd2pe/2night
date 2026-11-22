#!/usr/bin/env python3
"""Corregge la posizione della patch openfl: l'esposizione deve stare DOPO
la registrazione di onKeyUp, quando _g10/window11 sono gia' assegnati."""
import json

P = '/home/z/my-project/public/games/friday-night-funkin/Funkin.js'
OLD = "$window.onKeyDown.add(tmp); window.__openflKeyDown = _g9; window.__openflKeyDownWin = window10; window.__openflKeyUp = _g10; window.__openflKeyUpWin = window11;"
NEW = """$window.onKeyDown.add(tmp);
                    var _g10 = $bind(this, this.__onLimeKeyUp);
                    var window11 = $window;
                    var tmp = function(keyCode, modifier) {
                        _g10(window11, keyCode, modifier);
                    };
                    $window.onKeyUp.add(tmp); window.__openflKeyDown = _g9; window.__openflKeyDownWin = window10; window.__openflKeyUp = _g10; window.__openflKeyUpWin = window11;"""

s = open(P, encoding='utf-8', errors='ignore').read()
assert OLD in s, 'vecchia patch non trovata'
s = s.replace(OLD, NEW, 1)
open(P, 'w', encoding='utf-8').write(s)
print('patch corretta')
