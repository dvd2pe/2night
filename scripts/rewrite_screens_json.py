#!/usr/bin/env python3
"""Riscrive screens.json dei due giochi nel formato step-oggetto:
   { "k": "Enter", "delay": 2500, "expect": "MainMenuState" }
- FNF: expect = classe Haxe dello stato Flixel atteso (hook in Funkin.js)
- Chainsaw (GameMaker): nessun hook -> solo k/delay, verifiche disattive
Contenuti (nomi/descrizioni) restano identici alla versione precedente.
"""
import json

FNF = '/home/z/my-project/public/games/friday-night-funkin/screens.json'
CSW = '/home/z/my-project/public/games/chainsaw-dance/screens.json'

fnf = {"screens": [
    {"id": "title", "name": "Titolo (Girlfriend sugli speaker)", "auto": True, "steps": [],
     "description": "Logo Friday Night Funkin' che 'pompa' + Girlfriend che balla e la scritta PRESS ENTER TO BEGIN. Arrivi qui automaticamente dopo il caricamento."},
    {"id": "menu", "name": "Menu principale (STORY MODE / FREEPLAY / DONATE)", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500, "expect": "MainMenuState"}],
     "description": "Menu giallo con Boyfriend. Naviga con frecce su/giù, conferma con Invio."},
    {"id": "story", "name": "Story Mode · selezione settimana", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500, "expect": "MainMenuState"},
               {"k": "Enter", "delay": 4500, "expect": "StoryMenuState"}],
     "description": "Selezione settimana (WEEK SCORE in alto, TRACKS a sinistra). Frecce sinistra/destra per cambiare settimana, su/giù per la difficoltà."},
    {"id": "freeplay", "name": "Freeplay (lista brani)", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500, "expect": "MainMenuState"},
               {"k": "ArrowDown", "delay": 2500},
               {"k": "Enter", "delay": 4000, "expect": "FreeplayState"}],
     "description": "Lista libera dei brani sbloccati con punteggio personale."},
    {"id": "gameplay", "name": "Gameplay (Week 1 · Bopeebo · NORMAL)", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500, "expect": "MainMenuState"},
               {"k": "Enter", "delay": 4500, "expect": "StoryMenuState"},
               {"k": "Enter", "delay": 5000, "expect": "PlayState"}],
     "description": "Partita avviata su Week 1 (Bopeebo, difficoltà NORMAL): note che salgono sulle frecce, barra salute, punteggio. Frecce per colpire le note."},
    {"id": "week6", "name": "Week 6 · selezione (settimana pixel)", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500, "expect": "MainMenuState"},
               {"k": "Enter", "delay": 4500, "expect": "StoryMenuState"},
               {"k": "ArrowRight", "delay": 2500}, {"k": "ArrowRight", "delay": 2500},
               {"k": "ArrowRight", "delay": 2500}, {"k": "ArrowRight", "delay": 2500},
               {"k": "ArrowRight", "delay": 2500},
               {"k": "Enter", "delay": 4500, "expect": "PlayState"}],
     "description": "Cinque frecce destra portano alla settimana 6 (SENPAI) in stile pixel. Alla conferma parte il dialogo dentro la partita: premi Invio per avanzare."},
    {"id": "gameover", "name": "Game Over (Blue Balls Anthem)", "auto": False, "manualOnly": True, "steps": [],
     "description": "Perdi apposta durante una canzone (barra salute vuota): Boyfriend gira la testa e parte la musica di game over. Invio = riprova, ESC = menu."},
    {"id": "pause", "name": "Pausa (RESUME / RESTART / EXIT TO MENU)", "auto": False, "manualOnly": True, "steps": [],
     "description": "ESC durante il gameplay apre la pausa con musica breakfast.mp3."},
    {"id": "results", "name": "Risultati fine settimana", "auto": False, "manualOnly": True, "steps": [],
     "description": "Completando tutte le canzoni di una settimana: schermata 'Week Cleared' con punteggio."},
]}

csw = {"screens": [
    {"id": "title", "name": "Titolo · Press Enter", "auto": True, "steps": [],
     "description": "Splash rosso di apertura, poi logo CHAINSAW DANCE con Kobeni e Chainsaw Man e la scritta PRESS ENTER. Arrivi qui automaticamente dopo il caricamento (o premi F5 nel browser)."},
    {"id": "menu", "name": "Menu principale (PLAY! / SETTINGS / SUPPORT / CREDITS)", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500}],
     "description": "Menu arcade con dancepad a sinistra. Su PLAY! premi Invio. Naviga con frecce/WASD."},
    {"id": "select", "name": "Selezione dancer & brano", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500}, {"k": "Enter", "delay": 2500}],
     "description": "CHOOSE A DANCER (frecce sinistra/destra per cambiare dancer) + PICK A SONG! (frecce su/giù per scorrere i brani). A destra i pannelli difficoltà."},
    {"id": "gameplay", "name": "Gameplay (Bug Thief · Easy Vance)", "auto": False,
     "steps": [{"k": "Enter", "delay": 2500}, {"k": "Enter", "delay": 2500},
               {"k": "Enter", "delay": 2500}, {"k": "Enter", "delay": 2200}],
     "description": "Partita avviata con dancer Kobeni e brano Bug Thief in difficoltà Easy Vance: frecce che scendono sul dancepad, barra salute in alto, countdown iniziale."},
    {"id": "pause", "name": "Pausa (RESUME / RESTART / MENU)", "auto": False, "manualOnly": True, "steps": [],
     "description": "Premi ESC durante il gameplay per aprire il menu pausa: RESUME, RESTART, MENU."},
    {"id": "settings", "name": "Settings (tasti e modalità)", "auto": False, "manualOnly": True, "steps": [],
     "description": "Dal menu principale seleziona SETTINGS: configurazione tasti key1/key2/key3, modalità practice/survive, automatizzazione dei set."},
    {"id": "score", "name": "Risultati / Score screen", "auto": False, "manualOnly": True, "steps": [],
     "description": "Fine brano: schermata punteggio con conteggio tick, giudizi, applausi o fischi a seconda del risultato."},
]}

for path, data in ((FNF, fnf), (CSW, csw)):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print('ok', path)
