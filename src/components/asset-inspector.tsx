'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Hammer, Loader2, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Asset, AssetManifest, formatBytes } from '@/lib/asset-types'

interface Props {
  asset: Asset
  manifest: AssetManifest
  navigating: string | null
  onGoToScreen: (screenId: string) => void
  onClose: () => void
}

export function AssetInspector({
  asset,
  manifest,
  navigating,
  onGoToScreen,
  onClose,
}: Props) {
  const [textContent, setTextContent] = useState<string | null>(null)

  // anteprima contenuto per i file di testo
  useEffect(() => {
    if (asset.type !== 'text') {
      setTextContent(null)
      return
    }
    let alive = true
    fetch(asset.url)
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => alive && setTextContent(t.slice(0, 2000)))
      .catch(() => alive && setTextContent(null))
    return () => {
      alive = false
    }
  }, [asset])

  const screenFor = (id: string) => manifest.screens.find((s) => s.id === id)

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-100" title={asset.path}>
          {asset.name}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Chiudi inspector"
          className="h-8 w-8 shrink-0 text-zinc-400"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {/* Badge info */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
              {asset.type}
            </Badge>
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
              {asset.role}
            </Badge>
            <Badge variant="secondary" className="bg-zinc-800 font-mono text-zinc-400">
              .{asset.format}
            </Badge>
            {asset.engine && (
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-300">
                engine
              </Badge>
            )}
          </div>

          {/* Anteprima */}
          {asset.type === 'image' && (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:16px_16px]">
              <img
                src={asset.url}
                alt={asset.name}
                className="mx-auto max-h-56 w-full object-contain"
                loading="lazy"
              />
            </div>
          )}
          {asset.type === 'audio' && (
            <audio controls preload="none" src={asset.url} className="w-full" aria-label={`Anteprima audio ${asset.name}`} />
          )}
          {asset.type === 'text' && textContent !== null && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-zinc-800 bg-black p-2 text-[10px] leading-relaxed text-zinc-400">
              {textContent || '(vuoto)'}
            </pre>
          )}

          {/* Proprietà */}
          <dl className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Dimensione file</dt>
              <dd className="text-zinc-300">{formatBytes(asset.bytes)}</dd>
            </div>
            {asset.width !== undefined && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Risoluzione</dt>
                <dd className="font-mono text-zinc-300">
                  {asset.width} × {asset.height} px
                </dd>
              </div>
            )}
            {asset.durationSec !== undefined && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Durata</dt>
                <dd className="text-zinc-300">{asset.durationSec} s</dd>
              </div>
            )}
            {asset.sampleRate && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Audio</dt>
                <dd className="text-zinc-300">
                  {asset.sampleRate} Hz · {asset.channels} ch
                  {asset.bitrateKbps ? ` · ${asset.bitrateKbps} kbps` : ''}
                </dd>
              </div>
            )}
            {asset.frames && (
              <>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Frame atlas</dt>
                  <dd className="text-zinc-300">{asset.frames.count}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Frame max</dt>
                  <dd className="font-mono text-zinc-300">
                    {asset.frames.maxFrameWidth} × {asset.frames.maxFrameHeight} px
                  </dd>
                </div>
                <div className="pt-1">
                  <dt className="mb-1 text-zinc-500">Animazioni</dt>
                  <dd className="flex flex-wrap gap-1">
                    {asset.frames.animations.map((an) => (
                      <span
                        key={an}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                      >
                        {an}
                      </span>
                    ))}
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-2 pt-1">
              <dt className="text-zinc-500">Percorso</dt>
              <dd className="min-w-0 truncate font-mono text-[10px] text-zinc-400" title={asset.path}>
                {asset.path}
              </dd>
            </div>
          </dl>

          {/* Nota */}
          {asset.note && (
            <p className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-2.5 text-xs leading-relaxed text-zinc-400">
              {asset.note}
            </p>
          )}

          {/* Schermate */}
          {asset.screens.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
                <MapPin className="h-3.5 w-3.5" /> Appare in
              </p>
              <div className="space-y-1.5">
                {asset.screens.map((id) => {
                  const sc = screenFor(id)
                  if (!sc) return null
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-800/40 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-200">
                          {sc.name}
                        </p>
                        {sc.manualOnly && (
                          <p className="text-[10px] text-zinc-500">
                            raggiungibile manualmente
                          </p>
                        )}
                      </div>
                      {sc.manualOnly ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 border-zinc-700 bg-zinc-800 px-2 text-[10px] text-zinc-400"
                          title={sc.description}
                          onClick={() => alert(sc.description)}
                        >
                          come si arriva
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 shrink-0 bg-red-600 px-2 text-[10px] font-bold text-white hover:bg-red-500"
                          disabled={navigating !== null}
                          onClick={() => onGoToScreen(id)}
                        >
                          {navigating === id ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> in
                              corso…
                            </>
                          ) : (
                            'vai alla schermata'
                          )}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reskin */}
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
            <p className="mb-1 flex items-center gap-1 text-xs font-bold text-red-300">
              <Hammer className="h-3.5 w-3.5" /> Guida reskin
            </p>
            <p className="text-xs leading-relaxed text-red-200/80">
              {asset.reskin}
            </p>
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-red-300 underline underline-offset-2"
            >
              <ExternalLink className="h-3 w-3" /> apri il file originale
            </a>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
