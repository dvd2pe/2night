export type AssetType = 'image' | 'audio' | 'font' | 'text'

export interface AssetFrames {
  count: number
  animations: string[]
  maxFrameWidth: number
  maxFrameHeight: number
  examples: string[]
}

export interface Asset {
  path: string
  url: string
  name: string
  type: AssetType
  format: string
  bytes: number
  width?: number
  height?: number
  durationSec?: number
  sampleRate?: number
  bitrateKbps?: number
  channels?: number
  fontFamily?: string
  fontStyle?: string
  screens: string[]
  role: string
  note: string
  engine: boolean
  atlasXml?: string
  frames?: AssetFrames
  reskin: string
}

export interface GameStep {
  k: string // tasto da inviare (Enter, ArrowRight, Escape…)
  delay: number // ms da attendere PRIMA del tasto
  expect?: string // (OpenFL/HaxeFlixel) stato Flixel atteso dopo il tasto;
  // se l'hook di stato non esiste la verifica viene saltata
}

export interface GameScreen {
  id: string
  name: string
  description: string
  auto?: boolean
  manualOnly?: boolean
  steps: GameStep[]
}

export interface AssetManifest {
  game: string
  name: string
  engine: string
  generatedAt: string
  description: string
  controls: string
  bootDelayMs?: number
  notes: Record<string, string>
  totals: Record<string, number>
  screens: GameScreen[]
  assets: Asset[]
}

export interface GameMeta {
  id: string
  name: string
  tag: string
  src: string
  description: string
  assetCount: number
  manifest: string
}

export interface GamesIndex {
  generatedAt: string
  games: GameMeta[]
}

export const TYPE_LABELS: Record<AssetType, string> = {
  image: 'Immagini',
  audio: 'Audio',
  font: 'Font',
  text: 'Testi',
}

export const TYPE_ICONS: Record<AssetType, string> = {
  image: '🖼️',
  audio: '🎵',
  font: '🔤',
  text: '📄',
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
