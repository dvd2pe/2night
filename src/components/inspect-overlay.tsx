'use client'

// Overlay di ispezione stile Chrome DevTools: schermata fissa (snapshot del
// canvas) con box sugli elementi trovati per confronto pixel esatto.
// - hover: box evidenziato + tooltip con nome e dimensioni reali
// - click: seleziona l'elemento e apre l'inspector per il reskin
// - l'elemento selezionato resta evidenziato sulla schermata fissa

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Camera, Loader2, MousePointerClick, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface InspectMatch {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  score: number
  meta?: { scale?: number; occluded?: boolean }
}

export interface InspectStats {
  snapshot?: { w: number; h: number }
  templates?: number
  matches?: number
  elapsedMs?: number
  coarse?: boolean
}

interface Props {
  gameId: string
  snapshot: string | null
  matches: InspectMatch[]
  stats: InspectStats | null
  busy: boolean
  busyLabel: string
  error: string | null
  selectedId: string | null
  onRefresh: () => void
  onSelectMatch: (m: InspectMatch) => void
  onClose: () => void
}

const HOVER_FILL = 'rgba(111, 168, 220, 0.35)' // stile Chrome DevTools
const HOVER_EDGE = 'rgba(102, 170, 220, 0.9)'
const SEL_FILL = 'rgba(250, 62, 62, 0.28)'
const SEL_EDGE = 'rgba(250, 100, 100, 0.95)'

export function InspectOverlay({
  snapshot,
  matches,
  stats,
  busy,
  busyLabel,
  error,
  selectedId,
  onRefresh,
  onSelectMatch,
  onClose,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ w: number; h: number; ox: number; oy: number } | null>(
    null,
  )
  const [hovered, setHovered] = useState<string | null>(null)
  const natural = stats?.snapshot ?? null

  // adatta lo snapshot al contenitore (object-contain calcolato)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el || !natural) return
    const compute = () => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      const scale = Math.min(cw / natural.w, ch / natural.h)
      const w = Math.round(natural.w * scale)
      const h = Math.round(natural.h * scale)
      setFit({ w, h, ox: Math.round((cw - w) / 2), oy: Math.round((ch - h) / 2) })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [natural])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const activeId = hovered ?? selectedId
  const active = matches.find(
    (m) => (hovered !== null ? m.name === hovered : m.id === selectedId),
  )

  const scale = fit && natural ? fit.w / natural.w : 1

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-zinc-950/95" data-testid="inspect-overlay">
      {/* barra strumenti, come la strip di DevTools */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <MousePointerClick className="h-4 w-4 text-sky-400" aria-hidden="true" />
        <span className="text-xs font-bold text-zinc-200">Ispezione · schermata fissa</span>
        {stats && (
          <span className="font-mono text-[11px] text-zinc-500">
            {stats.snapshot?.w}×{stats.snapshot?.h} · {matches.length} elementi misurati ·{' '}
            {stats.templates} modelli · {stats.elapsedMs} ms
          </span>
        )}
        <span className="hidden text-[11px] text-zinc-400 md:inline">
          passa il mouse sugli elementi · clicca per selezionare · ESC per uscire
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={busy}
            className="h-8 gap-1.5 border-zinc-700 bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700"
            title="Ricattura la schermata corrente del gioco"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            Aggiorna schermata
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Chiudi ispezione"
            className="h-8 w-8 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* schermata fissa con box */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        {snapshot && fit && (
          <div
            className="absolute"
            style={{ left: fit.ox, top: fit.oy, width: fit.w, height: fit.h }}
          >
            <img
              src={snapshot}
              alt="Schermata fissa del gioco"
              width={fit.w}
              height={fit.h}
              className="block"
              draggable={false}
            />
            {matches.map((m, i) => {
              const isActive = active
                ? active.name === m.name && active.x === m.x && active.y === m.y
                : false
              const isSel = selectedId !== null && m.id === selectedId
              const fill = isActive ? HOVER_FILL : isSel ? SEL_FILL : undefined
              const edge = isActive ? HOVER_EDGE : isSel ? SEL_EDGE : 'rgba(255,255,255,0.35)'
              return (
                <div
                  key={`${m.name}-${m.x}-${m.y}-${i}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Seleziona elemento ${m.name}`}
                  onMouseEnter={() => setHovered(m.name)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectMatch(m)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectMatch(m)
                  }}
                  className="absolute cursor-crosshair"
                  style={{
                    left: Math.round(m.x * scale),
                    top: Math.round(m.y * scale),
                    width: Math.max(2, Math.round(m.w * scale)),
                    height: Math.max(2, Math.round(m.h * scale)),
                    background: fill,
                    outline: `1px ${isActive || isSel ? 'solid' : 'dashed'} ${edge}`,
                    outlineOffset: -1,
                    zIndex: isActive ? 5 : isSel ? 4 : 1,
                  }}
                />
              )
            })}

            {/* tooltip stile DevTools */}
            {active && fit && (
              <div
                className="pointer-events-none absolute z-10 max-w-[260px] rounded border border-zinc-600 bg-zinc-900/95 px-2 py-1.5 shadow-xl"
                style={{
                  left: Math.min(
                    Math.max(0, Math.round(active.x * scale)),
                    Math.max(0, fit.w - 200),
                  ),
                  top: Math.max(0, Math.round(active.y * scale) - 46),
                }}
              >
                <p className="truncate font-mono text-[11px] font-bold text-sky-300">
                  {active.name}
                  {active.meta?.occluded ? ' · parte visibile' : ''}
                </p>
                <p className="font-mono text-[10px] text-zinc-400">
                  {active.w}×{active.h} px · @{active.x},{active.y}
                  {active.meta?.scale != null && active.meta.scale !== 1
                    ? ` · scala ×${active.meta.scale}`
                    : ''}{' '}
                  · {(active.score * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/70">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p className="text-sm text-zinc-300">{busyLabel}</p>
          </div>
        )}

        {!busy && !snapshot && (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="max-w-md text-sm text-zinc-400">
              {error ??
                'Premi «Aggiorna schermata» per fissare lo stato attuale del gioco e misurare gli elementi visibili.'}
            </p>
          </div>
        )}

        {error && snapshot && (
          <p className="absolute bottom-2 left-2 right-2 rounded border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {/* elenco elementi trovati */}
        {matches.length > 0 && !busy && (
          <div className="absolute bottom-0 left-0 right-0 max-h-[30%] overflow-auto border-t border-zinc-800 bg-zinc-900/90 backdrop-blur">
            <ul className="divide-y divide-zinc-800/60">
              {matches.map((m, i) => (
                <li key={`${m.id}-${m.x}-${m.y}-${i}`}>
                  <button
                    onMouseEnter={() => setHovered(m.name)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelectMatch(m)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors ${
                      active?.name === m.name ? 'bg-sky-500/15' : 'hover:bg-zinc-800/70'
                    }`}
                  >
                    <span
                      className={`truncate font-mono text-[11px] ${
                        m.id === selectedId ? 'text-red-300' : 'text-zinc-300'
                      }`}
                    >
                      {m.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                      {m.w}×{m.h}
                      {m.meta?.scale != null && m.meta.scale !== 1
                        ? ` ×${m.meta.scale}`
                        : ''}{' '}
                      · {(m.score * 100).toFixed(1)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
