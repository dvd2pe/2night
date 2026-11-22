#!/usr/bin/env python3
"""Aggiunge a Funkin.js (build OpenFL/HaxeFlixel, Haxe 4.1.5) un hook di stato:

  - window.$hxClasses  : registro classi Haxe esposto dalla closure del modulo
  - window.__flixelReq : stato RICHIESTO via FlxG.switchState (classe Haxe)
  - window.__flixelState : stato ATTIVO dopo che FlxGame.switchState ha
    completato create() — usato dal pannello asset per verificare che la
    navigazione automatica sia davvero arrivata alla schermata attesa
    (screens.json campo "expect").

Risoluzione nome classe: il pattern Haxe $extend maschera `constructor`
(la prototype chain passa per l'helper Inherit), quindi il nome viene
risolto cercando nel registro $hxClasses la classe il cui .prototype
coincide con Object.getPrototypeOf(state). Fall-back su constructor.__name__.
Hook passivo: non altera alcun comportamento di gioco.
"""
P = '/home/z/my-project/public/games/friday-night-funkin/Funkin.js'

s = open(P, encoding='utf-8', errors='ignore').read()

changed = []

# ---- 1. esponi il registro classi Haxe + pre-dichiara le variabili hook ----
# La pre-dichiarazione permette al pannello di distinguere "build con hook ma
# ancora in boot" (__flixelStateAt === 0) da "build senza hook" (undefined).
EXPOSE_ANCHOR = "$hxEnums = $hxEnums || {},\n                $_;"
EXPOSE = ("$hxEnums = $hxEnums || {},\n                $_;\n            "
          "window.$hxClasses = $hxClasses;"
          "window.__flixelState=null;window.__flixelStateAt=0;"
          "window.__flixelReq=null;window.__flixelReqAt=0;")
if 'window.$hxClasses' not in s:
    assert s.count(EXPOSE_ANCHOR) == 1, f'anchor hxClasses ambiguo ({s.count(EXPOSE_ANCHOR)})'
    s = s.replace(EXPOSE_ANCHOR, EXPOSE, 1)
    changed.append('esposizione $hxClasses')

# ---- 2. hook richiesta stato (FlxG.switchState) ---------------------------
REQ_ANCHOR = "flixel_FlxG.switchState = function(nextState) {"
REQ_HOOK = ("try{window.__flixelReq=(nextState&&nextState.constructor&&"
            "nextState.constructor.__name__)||'?';window.__flixelReqAt="
            "Date.now();}catch(e){}")
if 'window.__flixelReq' not in s:
    assert s.count(REQ_ANCHOR) == 1, f'anchor switchState ambiguo ({s.count(REQ_ANCHOR)})'
    s = s.replace(REQ_ANCHOR, REQ_ANCHOR + REQ_HOOK, 1)
    changed.append('hook richiesta')

# ---- 3. hook stato attivo (fine FlxGame.switchState) ----------------------
DONE_ANCHOR = "flixel_FlxG.signals.postStateSwitch.dispatch();"
DONE_CTX = DONE_ANCHOR + '\n                },\n                gameStart: function() {'
DONE_HOOK = """try{
    var __st=this._state, __cn='?';
    if(__st){
        var __p=Object.getPrototypeOf(__st), __reg=window.$hxClasses;
        if(__p&&__reg){
            for(var __k in __reg){
                var __c=__reg[__k];
                if(__c&&__c.prototype===__p&&__c.__name__){
                    var __n=__c.__name__;
                    __cn=(typeof __n==='string')?__n:(Array.isArray(__n)&&__n.length?__n[__n.length-1]:__k);
                    break;
                }
            }
        }
        if(__cn==='?'&&__st.constructor&&__st.constructor.__name__)__cn=__st.constructor.__name__;
    }
    window.__flixelState=__cn;
    window.__flixelStateAt=Date.now();
}catch(e){}"""

RESOLVER_MARK = 'Object.getPrototypeOf(__st)'
if RESOLVER_MARK in s:
    changed.append('hook attivo già aggiornato (resolver presente)')
elif 'window.__flixelState' in s:
    # aggiorna il vecchio hook naive (constructor.__name__ mascherato da $extend)
    OLD_HOOK = ("try{window.__flixelState=(this._state&&this._state.constructor&&"
                "this._state.constructor.__name__)||'?';window.__flixelStateAt="
                "Date.now();}catch(e){}")
    OLD_CTX = DONE_ANCHOR + OLD_HOOK + '\n                },\n                gameStart: function() {'
    NEW_CTX = DONE_ANCHOR + DONE_HOOK + '\n                },\n                gameStart: function() {'
    assert s.count(OLD_CTX) == 1, f'vecchio hook/contesto non trovato ({s.count(OLD_CTX)})'
    s = s.replace(OLD_CTX, NEW_CTX, 1)
    changed.append('hook attivo aggiornato (resolver via $hxClasses)')

open(P, 'w', encoding='utf-8').write(s)
print('patch Funkin.js:', ', '.join(changed))
