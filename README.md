# 2Night Arcade — giochi offline + asset manager

Repo del progetto: due giochi HTML5 (mirror CrazyGames completati) giocabili
nel browser + un pannello di gestione/inspezione degli asset pensato per il
**reskin**.

## Giochi

| Gioco | Engine | Cartella |
|---|---|---|
| Chainsaw Dance | GameMaker Studio 2 (HTML5) | `public/games/chainsaw-dance/` |
| Friday Night Funkin' (0.3.0) | OpenFL / HaxeFlixel | `public/games/friday-night-funkin/` |

Gli asset mancanti nei mirror originali sono stati recuperati dal CDN
CrazyGames (canzoni `Inst/Voices`, libreria `shared`, settimane `week1-6`,
manifest OpenFL `manifest/*.json`, suoni menu). Vedi `scripts/` per gli
script di completamento.

## App (Next.js 16)

```bash
bun install
bun run dev     # sviluppo (porta 3000)
```

Funzioni principali (`src/app/page.tsx`):

- **Sidebar asset** (`src/components/asset-sidebar.tsx`): elenco per tipo con
  contatore, ricerca, filtri per tipo e per schermata di gioco, download
  dell'intero manifest o del risultato filtrato come JSON.
- **Inspector** (`src/components/asset-inspector.tsx`): anteprima immagine,
  player audio, dimensioni/durate, frame degli atlas Sparrow (nome + size),
  guida reskin e link al file originale.
- **Navigazione schermate**: il bottone "vai alla schermata" ricarica il
  gioco e invia le combinazioni tasti definite in `screens.json` per portare
  il gioco alla schermata dove l'asset viene mostrato.

## Come aggiungere un nuovo gioco (generico)

1. Copia la cartella del gioco in `public/games/<id>/` con `index.html`
   funzionante.
2. Crea `game.config.json` (id, nome, src, `bootDelayMs`...).
3. Opzionale ma consigliato: `screens.json` (schermate + sequenze tasti) e
   `asset.rules.json` (pattern → schermate/ruolo/note).
4. Lancia `python3 scripts/scan_assets.py` — genera
   `assets.manifest.json` + aggiorna `public/games/index.json`.
5. Il gioco appare automaticamente nell'UI.

Per i giochi OpenFL/lime lancia anche
`python3 scripts/inject_key_bridge.py`: aggiunge alle pagine il bridge tasti
(`__sendKey`) ed espone l'input engine-level (`__openflKeyDown/Up`) usato
dall'automazione (gli eventi DOM sintetici vengono ignorati da lime).

## Note reskin

- **Sparrow atlas (FNF)**: i personaggi sono PNG+XML (`SubTexture` con
  nome/x/y/w/h). Per reskinare: stesso PNG, stesse dimensioni, STESSO layout
  dei frame (l'XML resta invariato). Il manifest elenca ogni frame.
- **Texture atlas GameMaker (Chainsaw)**: tutti gli sprite stanno in
  `html5game/benedance_texture_0/1.png`; sostituisci i pixel mantenendo le
  posizioni.
- **Audio**: sostituzione con stesso nome/path; `Inst.mp3` = strumentale,
  `Voices.mp3` = voci (FNF); OGG per Chainsaw.

## Token GitHub

Il token per il push NON è nel repo. Inseriscilo in `GITHUB_TOKEN.md`
(escluso da git) alla radice del progetto sandbox se vuoi abilitare i push
automatici con `scripts/push_to_github.sh`.
