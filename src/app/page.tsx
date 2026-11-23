'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Gamepad2,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssetSidebar } from '@/components/asset-sidebar'
import { AssetInspector } from '@/components/asset-inspector'
import { Asset, AssetManifest, GameMeta, GamesIndex } from '@/lib/asset-types'

// Codici DOM/standard: usati dal bridge addEventListener e dal fallback DOM
const KEY_CODES: Record<string, number> = {
  Enter: 13,
  Escape: 27,
  Space: 32,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
}

// Codici LIME: il canale motore (__openflKeyDown) riceve i KeyCode di lime.ui
// e OpenFL li converte (es. lime DOWN=1073741905 → OpenFL 40). Passare i codici
// DOM (40) al canale motore produce un tasto sbagliato: lime 40 = tasto "9".
// Enter/Escape/Space coincidono (13/27/32), le frecce no.
const LIME_CODES: Record<string, number> = {
  Enter: 13,
  Escape: 27,
  Space: 32,
  ArrowUp: 1073741906,
  ArrowDown: 1073741905,
  ArrowLeft: 1073741904,
  ArrowRight: 1073741903,
}

const limeCodeFor = (key: string): number => {
  if (LIME_CODES[key] !== undefined) return LIME_CODES[key]
  // lettere e cifre: lime usa i codici ASCII (A-Z maiuscole, 0-9)
  if (key.length === 1) return key.toUpperCase().charCodeAt(0)
  return KEY_CODES[key] ?? 0
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Home() {
  const [games, setGames] = useState<GameMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [selected, setSelected] = useState<Asset | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [navScreen, setNavScreen] = useState<string | null>(null)
  const [navLabel, setNavLabel] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const navTokenRef = useRef(0)

  // Carica l'indice dei giochi (generico: nuovi giochi compaiono da soli)
  useEffect(() => {
    fetch('/games/index.json')
      .then((r) => r.json())
      .then((idx: GamesIndex) => {
        setGames(idx.games)
        setActiveId(idx.games[0]?.id ?? null)
      })
      .catch(() => setGames([]))
  }, [])

  // Manifest asset del gioco attivo
  useEffect(() => {
    const game = games.find((g) => g.id === activeId)
    if (!game) return
    setManifest(null)
    setSelected(null)
    fetch(game.manifest)
      .then((r) => r.json())
      .then((m: AssetManifest) => setManifest(m))
      .catch(() => setManifest(null))
  }, [games, activeId])

  // readyState polling: l'evento load dell'iframe può scattare prima
  // dell'idratazione di React, quindi non è affidabile come listener.
  useEffect(() => {
    let cancelled = false
    const timer = window.setInterval(() => {
      const frame = iframeRef.current
      if (frame && frame.contentDocument?.readyState === 'complete') {
        setLoaded(true)
        window.clearInterval(timer)
      }
    }, 250)
    const fallback = window.setTimeout(() => {
      if (!cancelled) setLoaded(true)
    }, 9000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(fallback)
    }
  }, [activeId])

  const activeGame = games.find((g) => g.id === activeId) ?? null

  const switchGame = useCallback(() => {
    if (!games.length) return
    navTokenRef.current += 1
    setNavScreen(null)
    setNavLabel(null)
    setSelected(null)
    setLoaded(false)
    setActiveId((id) => {
      const i = games.findIndex((g) => g.id === id)
      return games[(i + 1) % games.length].id
    })
  }, [games])

  const selectGame = useCallback(
    (id: string) => {
      if (id === activeId) return
      navTokenRef.current += 1
      setNavScreen(null)
      setNavLabel(null)
      setSelected(null)
      setLoaded(false)
      setActiveId(id)
    },
    [activeId],
  )

  const goFullscreen = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen()
  }, [])

  // Invia un tasto dentro l'iframe del gioco. Canali in ordine di preferenza:
  // 1. __openflKeyDown/Up: iniezione DIRETTA nel motore OpenFL/lime (patch in
  //    Funkin.js) — indispensabile per engine che ignorano gli eventi DOM.
  // 2. __sendKey: bridge addEventListener nell'index.html (GameMaker e altri).
  // 3. fallback: dispatch standard di KeyboardEvent con keyCode legacy.
  const dispatchKeyToGame = useCallback((key: string) => {
    const frame = iframeRef.current
    if (!frame?.contentWindow) return
    const w = frame.contentWindow
    const keyCode = KEY_CODES[key] ?? 0
    try {
      w.focus()
    } catch {
      /* ignora */
    }
    // 1. canale motore OpenFL — i codici passati devono essere LIME, non DOM
    try {
      const eng = w as unknown as {
        __openflKeyDown?: (win: unknown, code: number, mod: number) => void
        __openflKeyDownWin?: unknown
        __openflKeyUp?: (win: unknown, code: number, mod: number) => void
        __openflKeyUpWin?: unknown
      }
      if (
        typeof eng.__openflKeyDown === 'function' &&
        typeof eng.__openflKeyUp === 'function' &&
        eng.__openflKeyDownWin
      ) {
        // Il keyup va ritardato di qualche frame: se arriva nello stesso tick
        // di Flixel cancella lo stato "justPressed" e il tasto viene perso.
        const lime = limeCodeFor(key)
        eng.__openflKeyDown(eng.__openflKeyDownWin, lime, 0)
        w.setTimeout(() => {
          try {
            eng.__openflKeyUp(eng.__openflKeyUpWin, lime, 0)
          } catch {
            /* ignora */
          }
        }, 120)
        return
      }
    } catch {
      /* motore non pronto: prosegue con i fallback */
    }
    // 2. bridge addEventListener
    try {
      const bridge = (w as unknown as { __sendKey?: (k: string, c: number) => number })
        .__sendKey
      if (typeof bridge === 'function') {
        const sent = bridge(key, keyCode)
        if (sent > 0) return
      }
    } catch {
      /* bridge assente: usa il fallback */
    }
    // 3. fallback DOM
    const make = (type: string) => {
      const ev = new w.KeyboardEvent(type, {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(ev, 'keyCode', { get: () => keyCode })
      Object.defineProperty(ev, 'which', { get: () => keyCode })
      return ev
    }
    const fire = (target: EventTarget) => {
      target.dispatchEvent(make('keydown'))
      target.dispatchEvent(make('keyup'))
    }
    try {
      fire(w)
      fire(w.document)
      const canvas =
        w.document.querySelector('#canvas') ?? w.document.querySelector('canvas')
      if (canvas) fire(canvas)
    } catch {
      /* iframe cross-origin o game non pronto */
    }
  }, [])

  // Navigazione automatica: ricarica il gioco e cammina le schermate.
  // Ogni fase è verificata, non affidata a ritri fissi:
  //  1. il documento dentro l'iframe deve essere quello NUOVO (URL ?nav=…):
  //     il vecchio è già "complete" e ingannerebbe il readyState check;
  //  2. il canale input del motore deve esistere (__openflKeyDown / __sendKey);
  //  3. boot: se esiste l'hook di stato (__flixelState, patch OpenFL) si
  //     aspetta il PRIMO stato reale del gioco, altrimenti fallback al
  //     bootDelayMs fisso del manifest (moti senza hook, es. GameMaker);
  //  4. ogni step con "expect" verifica lo stato Flixel raggiunto e, se il
  //     tasto non ha avuto alcun effetto (stato invariato), lo reinviA.
  const goToScreen = useCallback(
    async (screenId: string) => {
      if (!activeGame || !manifest) return
      const screen = manifest.screens.find((s) => s.id === screenId)
      if (!screen || screen.manualOnly) return
      const token = ++navTokenRef.current
      setNavScreen(screenId)
      setNavLabel('Ricarico il gioco…')
      setSelected(null)

      const navMark = `nav=${Date.now()}`
      if (iframeRef.current) iframeRef.current.src = `${activeGame.src}?${navMark}`

      const gameWin = () => iframeRef.current?.contentWindow ?? null
      const aborted = () => token !== navTokenRef.current
      // stato Flixel corrente (null = hook assente o non OpenFL)
      const stateOf = (): string | null => {
        try {
          const v = (gameWin() as unknown as { __flixelState?: string })?.__flixelState
          return typeof v === 'string' && v.length > 0 ? v : null
        } catch {
          return null
        }
      }
      const waitForState = async (want: string, ms: number): Promise<boolean> => {
        const deadline = Date.now() + ms
        while (Date.now() < deadline) {
          await sleep(250)
          if (aborted()) return false
          if (stateOf() === want) return true
        }
        return false
      }

      // 1. nuovo documento caricato (l'URL deve contenere il marchio nav)
      let docOk = false
      for (let i = 0; i < 200; i++) {
        await sleep(200)
        if (aborted()) return
        try {
          const w = gameWin()
          if (w?.location?.href?.includes(navMark) && w.document.readyState === 'complete') {
            docOk = true
            break
          }
        } catch {
          /* navigazione in corso: si riprova */
        }
      }
      if (!docOk && aborted()) return
      await sleep(400)
      if (aborted()) return

      // 2. canale input del motore disponibile
      for (let i = 0; i < 120; i++) {
        const w = gameWin() as unknown as Record<string, unknown> | null
        if (w && (typeof w.__openflKeyDown === 'function' || typeof w.__sendKey === 'function')) break
        await sleep(250)
        if (aborted()) return
      }

      // 3. boot: attende il PRIMO STATO reale del gioco quando l'hook di
      //    stato esiste (patch OpenFL), altrimenti il ritro fisso del
      //    manifest. L'hook viene rilevato CON l'attesa, quindi i giochi
      //    senza hook (es. GameMaker) non pagano nessun tempo extra.
      const bootMs = manifest.bootDelayMs ?? 3000
      const hasHook = (): boolean => {
        try {
          const w = gameWin() as unknown as { __flixelStateAt?: unknown }
          return w?.__flixelStateAt !== undefined // pre-dichiarato dalla patch
        } catch {
          return false
        }
      }
      setNavLabel('Attendo il primo schermo di gioco…')
      const bootDeadline = Date.now() + Math.round(bootMs * 1.8) + 15000
      const fixedDeadline = Date.now() + bootMs
      let hook = hasHook()
      while (Date.now() < bootDeadline) {
        await sleep(300)
        if (aborted()) return
        if (!hook && hasHook()) hook = true
        if (stateOf() !== null) break // primo stato creato (hook attivo)
        if (!hook && Date.now() >= fixedDeadline) break // nessun hook: ritro fisso
      }
      await sleep(1500)
      if (aborted()) return

      // 4. step con verifica dello stato e retry quando il tasto viene ignorato
      const steps = screen.steps ?? []
      for (let i = 0; i < steps.length; i++) {
        const st = steps[i]
        setNavLabel(`Passo ${i + 1}/${steps.length}: ${st.k}`)
        await sleep(st.delay)
        if (aborted()) return
        const stateBefore = stateOf()
        dispatchKeyToGame(st.k)
        if (st.expect && stateBefore !== null) {
          // Il primo Invio su TitleState puo' solo SKIPPARE l'intro (FNF):
          // se lo stato non cambia si reinvia finche' l'engine reagisce o
          // si esauriscono i tentativi (copre anche boot lenti / buffering).
          let ok = await waitForState(st.expect, 3500)
          if (aborted()) return
          let attempt = 0
          while (!ok && attempt < 4 && stateOf() === stateBefore) {
            attempt++
            setNavLabel(`Passo ${i + 1}: riprovo ${st.k} (${attempt})`)
            dispatchKeyToGame(st.k)
            ok = await waitForState(st.expect, 4000)
            if (aborted()) return
          }
        } else {
          await sleep(800)
          if (aborted()) return
        }
      }
      setNavLabel(null)
      window.setTimeout(() => {
        if (navTokenRef.current === token) setNavScreen(null)
      }, 1500)
    },
    [activeGame, manifest, dispatchKeyToGame],
  )

  const onSelectAsset = useCallback((a: Asset) => {
    setSelected(a)
    setShowInspector(true)
  }, [])

  const loadingVisible = !loaded || navScreen !== null

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-zinc-950 text-zinc-100">
      {/* Barra superiore */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSidebar((v) => !v)}
            aria-label="Mostra/nascondi pannello asset"
            title="Pannello asset"
            className="h-9 w-9 border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-white"
          >
            {showSidebar ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </Button>
          <Gamepad2 className="h-6 w-6 text-red-500" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">
            2Night <span className="text-zinc-400">Assets</span>
          </span>
        </div>

        {/* Selettore giochi */}
        <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
          {games.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={g.id === activeId}
              onClick={() => selectGame(g.id)}
              className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                g.id === activeId
                  ? 'border-red-500 bg-red-500/15 text-red-400'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {g.name}
            </button>
          ))}
          <Button
            onClick={switchGame}
            size="lg"
            disabled={!games.length}
            className="gap-2 rounded-lg bg-red-600 px-5 font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-500"
            aria-label="Passa all'altro gioco"
          >
            <Repeat className="h-5 w-5" aria-hidden="true" />
            Cambia gioco
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={goFullscreen}
          aria-label="Schermo intero"
          title="Schermo intero"
          className="h-9 w-9 border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 hover:text-white"
        >
          <Maximize2 className="h-5 w-5" aria-hidden="true" />
        </Button>
      </header>

      {/* Corpo a tre colonne */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar asset */}
        {manifest && showSidebar && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
              onClick={() => setShowSidebar(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 z-40 w-[300px] lg:static lg:z-auto lg:w-[300px] lg:shrink-0">
              <AssetSidebar
                manifest={manifest}
                selected={selected}
                onSelect={onSelectAsset}
                onClose={() => setShowSidebar(false)}
              />
            </div>
          </>
        )}

        {/* Stage di gioco */}
        <main ref={stageRef} className="relative min-w-0 flex-1 bg-black">
          {activeGame && (
            <iframe
              key={activeId}
              ref={iframeRef}
              src={activeGame.src}
              title={activeGame.name}
              className="absolute inset-0 h-full w-full border-0"
              allow="fullscreen; autoplay; gamepad"
            />
          )}
          {loadingVisible && (
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90"
              aria-hidden="true"
            >
              <Loader2 className="h-10 w-10 animate-spin text-red-500" />
              <p className="max-w-xs text-center text-sm text-zinc-300">
                {navLabel ??
                  `Caricamento ${activeGame?.name ?? 'gioco'}…`}
              </p>
              {navScreen && manifest && (
                <p className="text-xs text-zinc-500">
                  {
                    manifest.screens.find((s) => s.id === navScreen)?.name ??
                      ''
                  }
                </p>
              )}
            </div>
          )}
        </main>

        {/* Inspector */}
        {selected && manifest && showInspector && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60 xl:hidden"
              onClick={() => setShowInspector(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 right-0 z-40 w-[340px] xl:static xl:z-auto xl:w-[340px] xl:shrink-0">
              <AssetInspector
                asset={selected}
                manifest={manifest}
                navigating={navScreen}
                onGoToScreen={goToScreen}
                onClose={() => {
                  setShowInspector(false)
                  setSelected(null)
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Info gioco attivo */}
      <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-1.5 text-xs text-zinc-500">
        <span className="truncate">
          {activeGame?.name} <span className="text-zinc-700">·</span>{' '}
          {manifest?.controls || activeGame?.tag}
        </span>
        {manifest && (
          <span className="hidden shrink-0 sm:inline">
            {manifest.assets.length} asset · {manifest.screens.length} schermate
          </span>
        )}
      </div>
    </div>
  )
}
