'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  ExternalLink,
  Hammer,
  Loader2,
  MapPin,
  RotateCcw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FNFRegistry,
  GMFrame,
  GMRegistry,
  GameRegistry,
  RegistryAsset,
  ReskinState,
  downloadJson,
  formatBytes,
  isGM,
} from '@/lib/asset-types'

interface Props {
  asset: RegistryAsset
  registry: GameRegistry
  reskin: ReskinState
  onInspectAsset: () => void
  onReloadGame: () => void
  onReskinChanged: () => void
  onClose: () => void
}

type ScaleMode = 'stretch' | 'nearest'

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('immagine non valida'))
      img.src = url
    })
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

function scaleImage(
  img: HTMLImageElement,
  w: number,
  h: number,
  mode: ScaleMode,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = mode !== 'nearest'
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return c
}

export function AssetInspector({
  asset,
  registry,
  reskin,
  onInspectAsset,
  onReloadGame,
  onReskinChanged,
  onClose,
}: Props) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [appliedFlash, setAppliedFlash] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replaceOn, setReplaceOn] = useState(false)
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [scaleMode, setScaleMode] = useState<ScaleMode>('stretch')
  const [allFrames, setAllFrames] = useState(false)
  const [alsoDuplicates, setAlsoDuplicates] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [xmlFrames, setXmlFrames] = useState<GMFrame[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const gm = isGM(registry)
  const cacheTag = (file?: string) => {
    const entry = file ? reskin[file] : undefined
    return entry ? `?r=${encodeURIComponent(entry.appliedAt)}` : ''
  }

  useEffect(() => {
    setReplaceOn(false)
    setReplaceFile(null)
    setPreviewUrl(null)
    setError(null)
    setXmlFrames(null)
    if (asset.kind !== 'data') {
      setTextContent(null)
    } else if (asset.url) {
      let alive = true
      fetch(asset.url)
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) => alive && setTextContent(t.slice(0, 2000)))
        .catch(() => alive && setTextContent(null))
      return () => {
        alive = false
      }
    }
  }, [asset])

  // Sheet FNF (formato Sparrow): i rect dei frame sono nel file .xml
  // originale accanto al png — gli stessi dati usati dal gioco.
  useEffect(() => {
    setXmlFrames(null)
    if (asset.kind !== 'image' || !asset.url) return
    let alive = true
    fetch(`${asset.url}.xml`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => {
        if (!t || !alive) return
        const frames: GMFrame[] = []
        const re =
          /<SubTexture[^>]*name="([^"]+)"[^>]*?x="(\d+)"[^>]*?y="(\d+)"[^>]*?width="(\d+)"[^>]*?height="(\d+)"/g
        for (const m of t.matchAll(re)) {
          frames.push({ page: 0, x: +m[2], y: +m[3], w: +m[4], h: +m[5] })
        }
        if (frames.length) setXmlFrames(frames)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [asset])

  // frame dell'atlante: sprite GameMaker (registro _M) o frame Sparrow FNF
  const atlasFrames: GMFrame[] | null =
    asset.kind === 'sprite'
      ? (asset.frames ?? null)
      : asset.kind === 'image' && xmlFrames
        ? xmlFrames
        : null
  const atlasPagePath =
    asset.kind === 'sprite'
      ? (asset.atlasUrl?.replace(`/games/${registry.game}/`, '') ?? null)
      : asset.kind === 'image'
        ? (asset.path ?? null)
        : null

  const framePreview = useMemo(() => {
    if (!atlasFrames?.length) return null
    const url = asset.atlasUrl ?? asset.url
    if (!url) return null
    return { frame: atlasFrames[0], atlasUrl: url }
  }, [atlasFrames, asset.atlasUrl, asset.url])

  // applicazione reskin: sprite atlante (composizione pagina) o file diretto
  const applyReskin = async () => {
    if (!replaceFile) {
      setError('Scegli prima un file sostitutivo.')
      return
    }
    setError(null)
    setBusy('applico…')
    try {
      if (atlasFrames?.length && atlasPagePath) {
        // composizione della pagina atlante con i rect originali
        const targets = allFrames ? atlasFrames : [atlasFrames[0]].filter(Boolean)
        // copie pixel-identiche della stessa immagine nell'atlante
        // (misura dall'hash dei crop: es. gametitle ↔ chainsawTitle)
        const dupRects: GMFrame[] = []
        const dupNames = new Set<string>()
        if (alsoDuplicates && asset.identicalRects?.length) {
          for (const d of asset.identicalRects) {
            if (!dupRects.some((r) => r.x === d.x && r.y === d.y && r.page === d.page)) {
              dupRects.push(d)
              dupNames.add(d.sprite)
            }
          }
        }
        const pageUrl = `${asset.atlasUrl ?? asset.url}${cacheTag(atlasPagePath)}`
        const pageImg = new Image()
        await new Promise<void>((res, rej) => {
          pageImg.onload = () => res()
          pageImg.onerror = () => rej(new Error('atlante non raggiungibile'))
          pageImg.src = pageUrl
        })
        const canvas = document.createElement('canvas')
        canvas.width = pageImg.naturalWidth
        canvas.height = pageImg.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(pageImg, 0, 0)
        const repl = await fileToImage(replaceFile)
        for (const f of targets) {
          const scaled = scaleImage(repl, f.w, f.h, scaleMode)
          ctx.drawImage(scaled, f.x, f.y)
        }
        for (const f of dupRects) {
          const scaled = scaleImage(repl, f.w, f.h, scaleMode)
          ctx.drawImage(scaled, f.x, f.y)
        }
        const png: Blob = await new Promise((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('export fallito'))), 'image/png'),
        )
        const dataUrl = await new Promise<string>((res) => {
          const fr = new FileReader()
          fr.onload = () => res(fr.result as string)
          fr.readAsDataURL(png)
        })
        const pagePath = atlasPagePath
        const r = await fetch('/api/reskin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            game: registry.game,
            action: 'applyAtlas',
            page: pagePath,
            png: dataUrl,
            targets: [asset.name, ...[...dupNames]],
          }),
        })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'errore server')
      } else if (asset.kind === 'audio' || asset.kind === 'image' || asset.kind === 'texture' || asset.kind === 'font') {
        if (!asset.path) throw new Error('questo asset non ha un file sostituibile')
        // controllo dimensioni reali per le immagini DIRETTE (senza frame xml)
        let dataUrl: string
        if (
          asset.path.endsWith('.png') &&
          asset.width && asset.height &&
          !atlasFrames?.length
        ) {
          const img = await fileToImage(replaceFile)
          if (img.naturalWidth !== asset.width || img.naturalHeight !== asset.height) {
            const scaled = scaleImage(
              img,
              asset.width,
              asset.height,
              scaleMode,
            )
            dataUrl = scaled.toDataURL('image/png')
          } else {
            dataUrl = await new Promise<string>((res) => {
              const fr = new FileReader()
              fr.onload = () => res(fr.result as string)
              fr.readAsDataURL(replaceFile)
            })
          }
        } else {
          dataUrl = await new Promise<string>((res) => {
            const fr = new FileReader()
            fr.onload = () => res(fr.result as string)
            fr.readAsDataURL(replaceFile)
          })
        }
        const r = await fetch('/api/reskin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            game: registry.game,
            action: 'applyFile',
            path: asset.path,
            file: dataUrl,
            targets: [asset.name],
          }),
        })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'errore server')
      } else {
        throw new Error('questo tipo di asset non supporta il reskin')
      }
      setReplaceOn(false)
      setReplaceFile(null)
      setPreviewUrl(null)
      onReskinChanged()
      setAppliedFlash(true)
      window.setTimeout(() => setAppliedFlash(false), 6000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'errore sconosciuto')
    } finally {
      setBusy(null)
    }
  }

  const restoreReskin = async () => {
    const file =
      asset.path ??
      (asset.atlasUrl ? asset.atlasUrl.replace(`/games/${registry.game}/`, '') : null)
    if (!file) return
    setBusy('ripristino…')
    setError(null)
    try {
      const r = await fetch('/api/reskin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: registry.game, action: 'restore', path: file }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'errore server')
      onReskinChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'errore sconosciuto')
    } finally {
      setBusy(null)
    }
  }

  // blueprint della room GameMaker: istanze alle posizioni originali
  const roomInstances = useMemo(() => {
    if (!gm || asset.kind !== 'screen' || !asset.id.startsWith('screen:r_')) return null
    const g = registry as GMRegistry
    const room = g.rooms.find((r) => `screen:${r.name}` === asset.id)
    if (!room) return null
    const objSprite = new Map<number, number>()
    for (const o of g.objects) objSprite.set(o.index, o.spriteIndex ?? -1)
    return room.instances.map((i) => {
      const si = objSprite.get(i.objectIndex) ?? -1
      const spr = si >= 0 ? g.sprites[si] : null
      const f = spr?.frames[0]
      return { ...i, sprite: spr, frame: f }
    })
  }, [gm, registry, asset])

  const spriteUsersPositions = useMemo(() => {
    if (!gm || asset.kind !== 'sprite') return null
    const g = registry as GMRegistry
    const objIdx = new Set(
      g.objects.filter((o) => asset.usedByObjects?.includes(o.name)).map((o) => o.index),
    )
    const out: { obj: string; x: number; y: number }[] = []
    for (const room of g.rooms) {
      for (const i of room.instances) {
        if (objIdx.has(i.objectIndex)) {
          out.push({ obj: i.objectName ?? String(i.objectIndex), x: i.x, y: i.y })
        }
      }
    }
    return out
  }, [gm, registry, asset])

  const reskinEntry =
    reskin[asset.path ?? ''] ??
    (asset.atlasUrl
      ? reskin[asset.atlasUrl.replace(`/games/${registry.game}/`, '')]
      : undefined)

  const reskinSupported =
    asset.kind === 'sprite' ||
    asset.kind === 'audio' ||
    asset.kind === 'image' ||
    asset.kind === 'texture' ||
    (asset.kind === 'font' && !!asset.path)

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <p
          className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-100"
          title={asset.path ?? asset.name}
        >
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
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
              {asset.kind}
            </Badge>
            {asset.width != null && (
              <Badge variant="secondary" className="bg-zinc-800 font-mono text-zinc-300">
                {asset.width}×{asset.height} px
              </Badge>
            )}
            {asset.durationSec != null && (
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                {asset.durationSec}s
              </Badge>
            )}
            {reskinEntry && (
              <Badge className="bg-amber-500/20 text-amber-300">reskin attivo</Badge>
            )}
          </div>

          {/* Anteprima sprite GameMaker: crop reale dall'atlante originale */}
          {framePreview && (
            <div>
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:16px_16px]">
                <div className="flex min-h-[120px] items-center justify-center p-3">
                  <div
                    className="origin-center scale-[2.2]"
                    style={{
                      width: framePreview.frame.w,
                      height: framePreview.frame.h,
                      backgroundImage: `url(${framePreview.atlasUrl}${cacheTag(
                        framePreview.atlasUrl?.replace(`/games/${registry.game}/`, ''),
                      )})`,
                      backgroundPosition: `-${framePreview.frame.x}px -${framePreview.frame.y}px`,
                      imageRendering: 'pixelated',
                    }}
                    role="img"
                    aria-label={`Anteprima sprite ${asset.name}`}
                  />
                </div>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                crop reale dal registro: pagina {framePreview.frame.page}, box (
                {framePreview.frame.x}, {framePreview.frame.y}) {framePreview.frame.w}×
                {framePreview.frame.h}
                {asset.frameCount && asset.frameCount > 1
                  ? ` · frame 1/${asset.frameCount}`
                  : ''}
              </p>
            </div>
          )}

          {/* Anteprima immagini dirette (FNF e atlanti) */}
          {(asset.kind === 'image' || asset.kind === 'texture') && asset.url && (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:16px_16px]">
              <img
                src={`${asset.url}${cacheTag(asset.path)}`}
                alt={asset.name}
                className="mx-auto max-h-56 w-full object-contain"
                loading="lazy"
              />
            </div>
          )}

          {asset.kind === 'audio' && asset.url && (
            <audio
              controls
              preload="none"
              src={`${asset.url}${cacheTag(asset.path)}`}
              className="w-full"
              aria-label={`Anteprima audio ${asset.name}`}
            />
          )}

          {asset.kind === 'data' && textContent !== null && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-zinc-800 bg-black p-2 text-[10px] leading-relaxed text-zinc-400">
              {textContent || '(vuoto)'}
            </pre>
          )}

          {/* Blueprint room GameMaker */}
          {roomInstances && (
            <div className="rounded-lg border border-zinc-800 p-2">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <MapPin className="h-3.5 w-3.5" /> Mappa istanze (posizioni originali)
              </p>
              <svg
                viewBox={`0 0 ${(asset.meta?.larghezza as number) ?? 320} ${(asset.meta?.altezza as number) ?? 180}`}
                className="w-full rounded bg-zinc-950"
                role="img"
                aria-label="Blueprint della room"
              >
                <rect width="100%" height="100%" fill="#09090b" />
                {roomInstances.map((i) => (
                  <g key={i.id}>
                    <rect
                      x={Math.max(0, i.x - (i.frame ? i.frame.w * i.scaleX : 8) / 2)}
                      y={Math.max(0, i.y - (i.frame ? i.frame.h * i.scaleY : 8) / 2)}
                      width={i.frame ? i.frame.w * i.scaleX : 16}
                      height={i.frame ? i.frame.h * i.scaleY : 16}
                      fill="#7f1d1d"
                      stroke="#ef4444"
                      strokeWidth="0.5"
                    />
                  </g>
                ))}
              </svg>
              <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-auto text-[10px] text-zinc-400">
                {roomInstances.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2 font-mono">
                    <span className="truncate">{i.objectName ?? i.objectIndex}</span>
                    <span className="shrink-0 text-zinc-600">
                      x:{i.x} y:{i.y}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Posizioni reali nella room per gli sprite */}
          {spriteUsersPositions && spriteUsersPositions.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-2.5 text-xs">
              <p className="mb-1 font-bold text-zinc-300">Istanze nella room:</p>
              <ul className="space-y-0.5 font-mono text-[10px] text-zinc-400">
                {spriteUsersPositions.slice(0, 8).map((p, i) => (
                  <li key={i}>
                    {p.obj} @ x:{p.x} y:{p.y}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Proprietà reali */}
          <dl className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 text-xs">
            {asset.originX !== undefined && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Origine</dt>
                <dd className="font-mono text-zinc-300">
                  {asset.originX}, {asset.originY}
                </dd>
              </div>
            )}
            {asset.frameCount != null && asset.frameCount > 1 && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Frame</dt>
                <dd className="text-zinc-300">{asset.frameCount}</dd>
              </div>
            )}
            {asset.sizeBytes != null && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">File</dt>
                <dd className="text-zinc-300">{formatBytes(asset.sizeBytes)}</dd>
              </div>
            )}
            {asset.path && (
              <div className="flex justify-between gap-2 pt-1">
                <dt className="text-zinc-500">Percorso</dt>
                <dd
                  className="min-w-0 truncate font-mono text-[10px] text-zinc-400"
                  title={asset.path}
                >
                  {asset.path}
                </dd>
              </div>
            )}
          </dl>

          {/* Avvisi su dati reali */}
          {asset.sharedWith && asset.sharedWith.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Regione atlante condivisa con: {asset.sharedWith.join(', ')}. Sostituendola
              cambia anche a loro.
            </p>
          )}

          {/* File referenziati (stati FNF / schermate) */}
          {asset.files && asset.files.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                File referenziati ({asset.files.length})
              </p>
              <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-800/40 p-2">
                {asset.files.slice(0, 60).map((f) => (
                  <li key={f} className="truncate font-mono text-[10px] text-zinc-400">
                    {f.includes('@') ? f : f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ispezione sulla schermata fissa (stile DevTools) */}
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5">
            <p className="text-xs font-bold text-sky-200">Ispezione sulla schermata</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              Fissa la schermata attuale del gioco e cerca questo elemento con
              confronto pixel esatto: trovi il box con posizione e dimensioni,
              come l'inspector di Chrome.
            </p>
            <Button
              size="sm"
              className="mt-2 h-8 w-full bg-sky-600 text-xs font-bold text-white hover:bg-sky-500"
              onClick={onInspectAsset}
            >
              <Camera className="mr-1 h-3 w-3" /> fissa la schermata e cercalo
            </Button>
          </div>

          {/* reskin applicato: ricarica per vederlo nel gioco */}
          {(appliedFlash || reskinEntry) && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5">
              <p className="text-xs font-bold text-emerald-200">
                Reskin applicato ai file del mirror{reskinEntry ? ` · ${new Date(reskinEntry.appliedAt).toLocaleString('it-IT')}` : ''}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Ricarica il gioco, torna alla schermata dove appare l'elemento e
                premi «Ispeziona»: la schermata fissa mostrerà il nuovo aspetto
                accanto a quella precedente.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-8 w-full border-emerald-500/50 bg-emerald-500/10 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20"
                onClick={onReloadGame}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> ricarica il gioco
              </Button>
            </div>
          )}

          {/* Editor reskin */}
          {reskinSupported && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-red-300">
                <input
                  type="checkbox"
                  checked={replaceOn}
                  onChange={(e) => setReplaceOn(e.target.checked)}
                  className="h-4 w-4 accent-red-500"
                />
                <Hammer className="h-3.5 w-3.5" /> Sostituisci questo asset (reskin)
              </label>

              {replaceOn && (
                <div className="mt-2 space-y-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept={
                      asset.kind === 'audio'
                        ? 'audio/*,.ogg,.mp3'
                        : 'image/png,image/*'
                    }
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setReplaceFile(f)
                      setPreviewUrl(f ? URL.createObjectURL(f) : null)
                    }}
                    className="w-full text-xs text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
                  />
                  {previewUrl && asset.kind !== 'audio' && (
                    <div className="overflow-hidden rounded border border-zinc-700 bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:12px_12px]">
                      <img
                        src={previewUrl}
                        alt="anteprima sostituzione"
                        className="mx-auto max-h-28 object-contain"
                      />
                    </div>
                  )}
                  {asset.kind === 'sprite' && asset.frameCount != null && asset.frameCount > 1 && (
                    <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={allFrames}
                        onChange={(e) => setAllFrames(e.target.checked)}
                        className="h-3.5 w-3.5 accent-red-500"
                      />
                      applica a tutti i {asset.frameCount} frame
                    </label>
                  )}
                  {asset.identicalRects && asset.identicalRects.length > 0 && (
                    <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={alsoDuplicates}
                        onChange={(e) => setAlsoDuplicates(e.target.checked)}
                        className="h-3.5 w-3.5 accent-red-500"
                      />
                      sostituisci anche le {asset.identicalRects.length} copie
                      pixel-identiche (
                      {[...new Set(asset.identicalRects.map((d) => d.sprite))].join(', ')})
                    </label>
                  )}
                  <label className="block text-[11px] text-zinc-400">
                    Adattamento dimensioni:
                    <select
                      value={scaleMode}
                      onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
                      className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                    >
                      <option value="stretch">
                        stretch esatto {asset.width ?? ''}×{asset.height ?? ''} (geometria originale)
                      </option>
                      <option value="nearest">
                        pixel art (nearest neighbor)
                      </option>
                    </select>
                  </label>
                  <p className="text-[10px] leading-relaxed text-zinc-400">
                    Il file sostitutivo viene composto nel PNG originale alla posizione esatta
                    del registro ({asset.frames?.[0]?.w ?? asset.width}×
                    {asset.frames?.[0]?.h ?? asset.height} px). Codice e geometria restano
                    invariati.
                  </p>
                  <Button
                    size="sm"
                    className="h-8 w-full bg-red-600 text-xs font-bold text-white hover:bg-red-500"
                    disabled={busy !== null}
                    onClick={() => void applyReskin()}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> {busy}
                      </>
                    ) : (
                      'applica al mirror'
                    )}
                  </Button>
                </div>
              )}

              {reskinEntry && (
                <div className="mt-2 border-t border-red-500/20 pt-2">
                  <p className="text-[10px] text-zinc-400">
                    reskin applicato: {reskinEntry.targets.join(', ')} ·{' '}
                    {new Date(reskinEntry.appliedAt).toLocaleString('it-IT')}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-7 w-full border-zinc-600 bg-zinc-800 text-[11px] text-zinc-300 hover:bg-zinc-700"
                    disabled={busy !== null}
                    onClick={() => void restoreReskin()}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> ripristina originale
                  </Button>
                </div>
              )}

              {asset.url && (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-red-300 underline underline-offset-2"
                >
                  <ExternalLink className="h-3 w-3" /> apri il file corrente
                </a>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {asset.kind === 'object' && (
            <p className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-2.5 text-xs leading-relaxed text-zinc-400">
              Gli oggetti sono le entità di gioco: collegano sprite e logica. La loro
              posizione nella room è visibile nella sezione Schermate.
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
