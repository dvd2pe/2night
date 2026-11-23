// Tipi dei registri asset REALI estratti dai file originali dei giochi.
// Nessun valore inventato: ogni campo proviene dai dati compilati originali
// (variabile _M in benedance.js per GameMaker) o dai file del mirror (FNF).

export interface GMFrame {
  page: number
  x: number
  y: number
  w: number
  h: number
  spriteW?: number
  spriteH?: number
  trimX?: number
  trimY?: number
}

export interface GMSprite {
  index: number
  name: string
  width: number | null
  height: number | null
  originX: number
  originY: number
  speedFps: number | null
  frameCount: number
  frames: GMFrame[]
}

export interface GMAudio {
  index: number
  name: string
  file: string
  volume: number | null
  preload: boolean
  durationSec: number | null
  sizeBytes: number
  present: boolean
}

export interface GMObject {
  index: number
  name: string
  spriteIndex: number | null
  parent: number | null
}

export interface GMInstance {
  id: number
  objectIndex: number
  objectName: string | null
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  imageIndex: number
}

export interface GMFont {
  name: string
  family: string | null
  size: number
  bold: boolean
  glyphCount: number
}

export interface GMSequence {
  name: string
  length: number | null
  fps: number | null
}

export interface GMRegistry {
  game: string
  engine: string
  source: string
  textures: {
    index: number
    file: string
    name: string
    width: number
    height: number
    sizeBytes: number
  }[]
  sprites: GMSprite[]
  audio: GMAudio[]
  objects: GMObject[]
  rooms: { name: string; width: number; height: number; instances: GMInstance[] }[]
  fonts: GMFont[]
  sequences: GMSequence[]
  sharedRegions: { region: GMFrame; users: { sprite: string; spriteIndex: number }[] }[]
  verification: Record<string, unknown>
}

export interface FNFFile {
  path: string
  type: string
  sizeBytes: number
  width?: number
  height?: number
  durationSec?: number
  subTextures?: number
  subTextureNames?: string[]
  jsonElements?: number
  jsonKeys?: string[]
  textLines?: number
}

export interface FNFState {
  state: string
  referencedFiles: string[]
}

export interface FNFRegistry {
  game: string
  engine: string
  totals: { files: number; byType: Record<string, number> }
  files: FNFFile[]
  states: FNFState[]
}

export type GameRegistry = GMRegistry | FNFRegistry

export const isGM = (r: GameRegistry): r is GMRegistry =>
  r.engine.startsWith('gamemaker')

// ---- schermate e configurazione ----

export interface GameStep {
  k: string
  delay: number
}

export interface GameScreen {
  id: string
  name: string
  description: string
  auto?: boolean
  manualOnly?: boolean
  steps: GameStep[]
}

export interface GameMeta {
  id: string
  name: string
  tag: string
  src: string
  description: string
  registry: string
  screens: string
  controls: string
  bootDelayMs: number
}

export interface GamesIndex {
  generatedAt: string
  games: GameMeta[]
}

// ---- modello normalizzato per la UI ----

export type AssetKind =
  | 'screen'
  | 'sprite'
  | 'audio'
  | 'font'
  | 'sequence'
  | 'object'
  | 'texture'
  | 'image'
  | 'data'

export interface RegistryAsset {
  id: string
  kind: AssetKind
  name: string
  sub?: string
  url?: string
  path?: string
  width?: number | null
  height?: number | null
  durationSec?: number | null
  sizeBytes?: number | null
  frames?: GMFrame[]
  frameCount?: number
  originX?: number
  originY?: number
  atlasUrl?: string
  sharedWith?: string[]
  usedByObjects?: string[]
  files?: string[]
  meta?: Record<string, string | number>
}

export interface RegistrySection {
  kind: AssetKind
  label: string
  items: RegistryAsset[]
}

export const KIND_LABELS: Record<AssetKind, string> = {
  screen: 'Schermate',
  sprite: 'Sprite',
  audio: 'Audio',
  font: 'Font',
  sequence: 'Sequenze',
  object: 'Oggetti',
  texture: 'Texture atlanti',
  image: 'Immagini',
  data: 'Dati',
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

// ---- stato reskin ----

export interface ReskinEntry {
  file: string
  appliedAt: string
  kind: 'atlas-page' | 'file'
  sizeBytes: number
  targets: string[]
  note?: string
}

export type ReskinState = Record<string, ReskinEntry>
