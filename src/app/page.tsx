'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
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
import {
  GameRegistry,
  GameScreen,
  GamesIndex,
  RegistryAsset,
  ReskinState,
  downloadJson,
} from '@/lib/asset-types'
import { normalizeRegistry } from '@/lib/registry'

const KEY_CODES: Record<string, number> = {
  Enter: 13,
  Escape: 27,
  Space: 32,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Home() {
  const [games, setGames] = useState<GamesIndex['games']>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [registry, setRegistry] = useState<GameRegistry | null>(null)
  const [screens, setScreens] = useState<GameScreen[]>([])
  const [reskin, setReskin] = useState<ReskinState>({})
  const [selected, setSelected] = useState<RegistryAsset | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [navScreen, setNavScreen] = useState<string | null>(null)
  const [navLabel, setNavLabel] = useState<string | null>(null)
  const [navUrl, setNavUrl] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const stageRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const navTokenRef = useRef(0)

  // Indice giochi generico: nuovi giochi appaiono aggiungendo una cartella
  useEffect(() => {
    fetch('/games/index.json')
      .then((r) => r.json())
      .then((idx: GamesIndex) => {
        setGames(idx.games)
        setActiveId(idx.games[0]?.id ?? null)
      })
      .catch(() => setGames([]))
  }, [])

  // Registro reale + schermate + stato reskin del gioco attivo
  useEffect(() => {
    const game = games.find((g) => g.id === activeId)
    if (!game) return
    setRegistry(null)
    setScreens([])
    setReskin({})
    setSelected(null)
    const safeJson = async <T,>(url: string, fallback: T): Promise<T> => {
      try {
        const r = await fetch(url)
        if (!r.ok) return fallback
        return (await r.json()) as T
      } catch {
        return fallback
      }
    }
    void (async () => {
      const [reg, scr, res] = await Promise.all([
        safeJson<GameRegistry | null>(game.registry, null),
        safeJson<{ screens: GameScreen[] }>(game.screens, { screens: [] }),
        safeJson<{ state: ReskinState }>('/api/reskin?game=' + game.id, { state: {} }),
      ])
      setRegistry(reg)
      setScreens(scr.screens ?? [])
      setReskin(res.state ?? {})
    })()
  }, [games, activeId])

  const normalized = useMemo(
    () => (registry ? normalizeRegistry(registry, screens) : null),
    [registry, screens],
  )

  // readyState polling: l'evento load può scattare prima dell'idratazione.
  // Il documento conta solo se è quello del gioco (non about:blank né il
  // documento precedente): così lo switch non resta "caricamento" eterno.
  useEffect(() => {
    let cancelled = false
    const timer = window.setInterval(() => {
      const frame = iframeRef.current
      try {
        const doc = frame?.contentDocument
        if (
          doc &&
          doc.location.href.includes('/games/') &&
          doc.readyState === 'complete'
        ) {
          setLoaded(true)
          window.clearInterval(timer)
        }
      } catch {
        /* navigazione in corso */
      }
    }, 250)
    const fallback = window.setTimeout(() => {
      if (!cancelled) setLoaded(true)
    }, 12000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(fallback)
    }
  }, [activeId, reloadToken])

  const activeGame = games.find((g) => g.id === activeId) ?? null

  const resetTransient = useCallback(() => {
    navTokenRef.current += 1
    setNavScreen(null)
    setNavLabel(null)
    setNavUrl(null)
    setSelected(null)
    setLoaded(false)
    setReloadToken((t) => t + 1)
  }, [])

  const switchGame = useCallback(() => {
    if (!games.length) return
    resetTransient()
    setActiveId((id) => {
      const i = games.findIndex((g) => g.id === id)
      return games[(i + 1) % games.length].id
    })
  }, [games, resetTransient])

  const selectGame = useCallback(
    (id: string) => {
      if (id === activeId) return
      resetTransient()
      setActiveId(id)
    },
    [activeId, resetTransient],
  )

  const goFullscreen = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen()
  }, [])

  // Invia un tasto all'iframe: KeyboardEvent DOM standard. Nessuna patch nei
  // file del gioco: è automazione esterna. Dettagli che contano:
  //  - si spedisce sul CANVAS (un solo evento che bubble a window/document:
  //    dispatch multipli creano chiavi doppie);
  //  - l'iframe deve avere il FOCUS: Flixel (FlxGame.focusLost) scarta gli
  //    input quando non ce l'ha, quindi il chiamante attende dopo il focus;
  //  - il KEYUP è ritardato di 250ms: keydown+keyup nello stesso frame fanno
  //    perdere il "justPressed" a FlxG/GameMaker.
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
    try {
      const canvas =
        w.document.querySelector('#canvas') ?? w.document.querySelector('canvas')
      const target: Element | Window = canvas ?? w
      target.dispatchEvent(make('keydown'))
      window.setTimeout(() => {
        try {
          target.dispatchEvent(make('keyup'))
        } catch {
          /* ignora */
        }
      }, 250)
    } catch {
      /* gioco non pronto */
    }
  }, [])

  // Navigazione automatica alle schermate: ricarica il gioco dalla sua
  // origine originale, attende il boot reale e riproduce la sequenza di
  // tasti configurata (tutti i tempi sono espliciti, nessuna inferenza).
  const goToScreen = useCallback(
    async (screenId: string) => {
      if (!activeGame) return
      const screen = screens.find((s) => s.id === screenId)
      if (!screen || screen.manualOnly) return
      const token = ++navTokenRef.current
      setNavScreen(screenId)
      setNavLabel('Ricarico il gioco…')
      setSelected(null)
      setNavUrl(`${activeGame.src}?nav=${Date.now()}`)
      setReloadToken((t) => t + 1)

      const navMark = `nav=`
      const gameWin = () => iframeRef.current?.contentWindow ?? null
      const aborted = () => token !== navTokenRef.current

      // 1. nuovo documento del gioco caricato
      let docOk = false
      for (let i = 0; i < 200; i++) {
        await sleep(200)
        if (aborted()) return
        try {
          const w = gameWin()
          if (
            w?.location?.href?.includes(navMark) &&
            w.document.readyState === 'complete'
          ) {
            docOk = true
            break
          }
        } catch {
          /* navigazione in corso */
        }
      }
      if (!docOk && aborted()) return
      setNavLabel('Attendo il caricamento completo del gioco…')

      // 2. boot reale del gioco. Canvas 2D (GameMaker): verifica passiva dai
      //    pixel (same-origin, nessuna modifica al gioco). Canvas WebGL
      //    (HaxeFlixel/OpenFL, illeggibile): attesa fissa configurata.
      const bootMs = activeGame.bootDelayMs ?? 10000
      let waited = 2500
      await sleep(waited)
      if (aborted()) return
      const minWait = Math.min(bootMs - 1000, 8000)
      await sleep(minWait)
      waited += minWait
      if (aborted()) return
      let alive = false
      const probeDeadline = Date.now() + 9000
      while (Date.now() < probeDeadline && !alive) {
        try {
          const w = gameWin()
          const c = w?.document.querySelector('canvas')
          const ctx2d = c?.getContext('2d') ?? null
          if (c && ctx2d) {
            const probe = w.document.createElement('canvas')
            probe.width = 32
            probe.height = 18
            const p = probe.getContext('2d')
            p.drawImage(c, 0, 0, 32, 18)
            const d = p.getImageData(0, 0, 32, 18).data
            let sum = 0
            for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2]
            if (sum > 0) alive = true
          }
        } catch {
          /* campionamento non possibile */
        }
        if (!alive) {
          await sleep(600)
          waited += 600
          if (aborted()) return
        }
      }
      if (!alive) {
        // canvas WebGL o non leggibile: completa l'attesa configurata
        const rest = Math.max(0, bootMs - waited)
        await sleep(rest)
        waited += rest
        if (aborted()) return
      }
      await sleep(1200)
      waited += 1200
      if (aborted()) return

      // 3. sequenza tasti della schermata (configurazione esplicita)
      const steps = screen.steps ?? []
      for (let i = 0; i < steps.length; i++) {
        const st = steps[i]
        setNavLabel(
          `Passo ${i + 1}/${steps.length}: ${st.k} tra ${Math.round(st.delay / 1000)}s`,
        )
        await sleep(st.delay)
        if (aborted()) return
        setNavLabel(`Passo ${i + 1}/${steps.length}: invio ${st.k}`)
        // focus + assestamento: Flixel scarta gli input se l'iframe non è
        // focalizzato, e l'evento di focus richiede un frame per valere
        try {
          gameWin()?.focus()
        } catch {
          /* ignora */
        }
        await sleep(450)
        if (aborted()) return
        dispatchKeyToGame(st.k)
        await sleep(600)
        if (aborted()) return
      }
      setNavLabel(null)
      window.setTimeout(() => {
        if (navTokenRef.current === token) setNavScreen(null)
      }, 1200)
    },
    [activeGame, screens, dispatchKeyToGame],
  )

  const refreshReskin = useCallback(() => {
    if (!activeGame) return
    fetch('/api/reskin?game=' + activeGame.id)
      .then((r) => r.json())
      .then((d: { state: ReskinState }) => setReskin(d.state ?? {}))
      .catch(() => undefined)
  }, [activeGame])

  const onSelectAsset = useCallback((a: RegistryAsset) => {
    setSelected(a)
    setShowInspector(true)
  }, [])

  const exportFiltered = useCallback(() => {
    if (!normalized || !activeGame) return
    downloadJson(`${activeGame.id}-registro.json`, {
      game: activeGame.id,
      registry,
      screens,
      reskin,
    })
  }, [normalized, activeGame, registry, screens, reskin])

  const loadingVisible = !loaded || navScreen !== null
  const iframeSrc = navUrl ?? activeGame?.src ?? undefined

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-zinc-950 text-zinc-100">
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
            2Night <span className="text-zinc-400">Inspector</span>
          </span>
        </div>

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

        <div className="flex items-center gap-2">
          {registry && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportFiltered}
              className="h-9 gap-1.5 border-zinc-700 bg-zinc-800/60 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
          )}
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
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {normalized && showSidebar && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
              onClick={() => setShowSidebar(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 z-40 w-[300px] lg:static lg:z-auto lg:w-[300px] lg:shrink-0">
              <AssetSidebar
                gameId={activeGame?.id ?? ''}
                gameName={activeGame?.name ?? ''}
                normalized={normalized}
                selected={selected}
                onSelect={onSelectAsset}
                onClose={() => setShowSidebar(false)}
              />
            </div>
          </>
        )}

        <main ref={stageRef} className="relative min-w-0 flex-1 bg-black">
          {activeGame && iframeSrc && (
            <iframe
              key={`${activeId}-${reloadToken}`}
              ref={iframeRef}
              src={iframeSrc}
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
                {navLabel ?? `Caricamento ${activeGame?.name ?? 'gioco'}…`}
              </p>
              {navScreen && (
                <p className="text-xs text-zinc-500">
                  {screens.find((s) => s.id === navScreen)?.name ?? ''}
                </p>
              )}
            </div>
          )}
        </main>

        {selected && registry && showInspector && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60 xl:hidden"
              onClick={() => setShowInspector(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 right-0 z-40 w-[340px] xl:static xl:z-auto xl:w-[340px] xl:shrink-0">
              <AssetInspector
                asset={selected}
                registry={registry}
                screens={screens}
                reskin={reskin}
                navigating={navScreen}
                onGoToScreen={(id) => void goToScreen(id)}
                onReskinChanged={refreshReskin}
                onClose={() => {
                  setShowInspector(false)
                  setSelected(null)
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-1.5 text-xs text-zinc-500">
        <span className="truncate">
          {activeGame?.name} <span className="text-zinc-700">·</span>{' '}
          {activeGame?.controls}
        </span>
        {normalized && (
          <span className="hidden shrink-0 sm:inline">
            {normalized.totalItems} elementi registro · {screens.length}{' '}
            schermate · file originali
          </span>
        )}
      </div>
    </div>
  )
}
