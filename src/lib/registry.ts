// Normalizza i registri reali (GameMaker / HaxeFlixel) nella vista unica per la UI.
import {
  AssetKind,
  FNFRegistry,
  GMFrame,
  GMRegistry,
  GameRegistry,
  RegistryAsset,
  RegistrySection,
  isGM,
} from '@/lib/asset-types'

export interface NormalizedGame {
  sections: RegistrySection[]
  totalItems: number
  kindOrder: AssetKind[]
}

const KIND_ORDER: AssetKind[] = [
  'screen',
  'sprite',
  'image',
  'audio',
  'font',
  'sequence',
  'object',
  'texture',
  'data',
]

function normalizeGM(reg: GMRegistry): NormalizedGame {
  const base = `/games/${reg.game}`

  // oggetti che usano ogni sprite (dati reali: object._32 -> sprite index)
  const usersBySprite = new Map<number, string[]>()
  for (const o of reg.objects) {
    if (o.spriteIndex === null) continue
    const arr = usersBySprite.get(o.spriteIndex) ?? []
    arr.push(o.name)
    usersBySprite.set(o.spriteIndex, arr)
  }

  // regioni condivise per chiave geometrica (pagina,x,y,w,h)
  const sharedKey = (f: GMFrame) => `${f.page}:${f.x}:${f.y}:${f.w}:${f.h}`
  const sharedMap = new Map<string, string[]>()
  for (const sr of reg.sharedRegions) {
    const names = sr.users.map((u) => u.sprite)
    sharedMap.set(sharedKey(sr.region), names)
  }

  const textureUrl = (page: number) => {
    const t = reg.textures[page]
    return t ? `${base}/${t.file}` : undefined
  }

  const spriteItems: RegistryAsset[] = reg.sprites.map((s) => {
    const frames = s.frames.map((f) => ({
      page: f.page,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
    }))
    const shared = new Set<string>()
    for (const f of s.frames) {
      for (const n of sharedMap.get(sharedKey(f)) ?? []) {
        if (n !== s.name) shared.add(n)
      }
    }
    const users = usersBySprite.get(s.index) ?? []
    const first = frames[0]
    return {
      id: `sprite:${s.name}`,
      kind: 'sprite' as const,
      name: s.name,
      sub:
        `${s.width ?? '?'}×${s.height ?? '?'} px` +
        (s.frameCount > 1 ? ` · ${s.frameCount} frame` : ''),
      width: s.width,
      height: s.height,
      frameCount: s.frameCount,
      frames,
      originX: s.originX,
      originY: s.originY,
      atlasUrl: first ? textureUrl(first.page) : undefined,
      sharedWith: [...shared],
      identicalRects: reg.identicalRects?.[s.name],
      usedByObjects: users,
    }
  })

  const audioItems: RegistryAsset[] = reg.audio.map((a) => ({
    id: `audio:${a.name}`,
    kind: 'audio' as const,
    name: a.name,
    sub:
      (a.durationSec ? `${a.durationSec}s` : 'durata n/d') +
      ` · vol ${a.volume ?? 1}`,
    url: `${base}/${a.file}`,
    path: a.file,
    durationSec: a.durationSec,
    sizeBytes: a.sizeBytes,
  }))

  const fontItems: RegistryAsset[] = reg.fonts.map((f) => ({
    id: `font:${f.name}`,
    kind: 'font' as const,
    name: f.name,
    sub: `${f.family ?? '?'} ${f.size}px${f.bold ? ' · bold' : ''} · ${f.glyphCount} glifi`,
  }))

  const seqItems: RegistryAsset[] = reg.sequences.map((q) => ({
    id: `sequence:${q.name}`,
    kind: 'sequence' as const,
    name: q.name,
    sub: q.length != null ? `${q.length} keyframe · ${q.fps ?? '?'} fps` : undefined,
  }))

  const objItems: RegistryAsset[] = reg.objects.map((o) => ({
    id: `object:${o.name}`,
    kind: 'object' as const,
    name: o.name,
    sub:
      o.spriteIndex !== null && reg.sprites[o.spriteIndex]
        ? `sprite: ${reg.sprites[o.spriteIndex].name}`
        : 'nessuno sprite',
  }))

  const texItems: RegistryAsset[] = reg.textures.map((t) => ({
    id: `texture:${t.name}`,
    kind: 'texture' as const,
    name: t.name,
    sub: `${t.width}×${t.height} · ${t.sizeBytes}`,
    url: `${base}/${t.file}`,
    path: t.file,
    width: t.width,
    height: t.height,
    sizeBytes: t.sizeBytes,
  }))

  // Room reali: blueprint con istanze (posizioni originali)
  const roomItems: RegistryAsset[] = []
  for (const room of reg.rooms) {
    roomItems.push({
      id: `screen:${room.name}`,
      kind: 'screen',
      name: room.name,
      sub: `${room.width}×${room.height} · ${room.instances.length} istanze`,
      files: room.instances.map(
        (i) => `${i.objectName ?? i.objectIndex}@${i.x},${i.y}`,
      ),
      meta: {
        larghezza: room.width,
        altezza: room.height,
        istanze: room.instances.length,
      },
      // le istanze complete viaggiano via meta? no: via dedicated field sotto
    })
  }

  const sections: RegistrySection[] = [
    { kind: 'screen', label: 'Schermate (room reali)', items: roomItems },
    { kind: 'sprite', label: 'Sprite', items: spriteItems },
    { kind: 'audio', label: 'Audio', items: audioItems },
    { kind: 'font', label: 'Font', items: fontItems },
    { kind: 'sequence', label: 'Sequenze animate', items: seqItems },
    { kind: 'object', label: 'Oggetti', items: objItems },
    { kind: 'texture', label: 'Texture atlanti', items: texItems },
  ]

  return {
    sections,
    totalItems: sections.reduce((n, s) => n + s.items.length, 0),
    kindOrder: KIND_ORDER.filter((k) => sections.some((s) => s.items.length && s.kind === k)),
  }
}

function folderOf(path: string): string {
  const parts = path.split('/')
  if (parts.length <= 1) return 'radice'
  return parts.slice(0, parts.length - 1).join('/')
}

function normalizeFNF(reg: FNFRegistry): NormalizedGame {
  const base = `/games/${reg.game}`
  const CODE_EXT = new Set(['js', 'html'])

  const files = reg.files.filter((f) => !CODE_EXT.has(f.type))

  // stati del codice con asset referenziati reali
  const stateItems: RegistryAsset[] = reg.states
    .filter((s) => !s.state.startsWith('flixel_') && !s.state.startsWith('openfl_'))
    .map((s) => ({
      id: `state:${s.state}`,
      kind: 'screen' as const,
      name: s.state,
      sub: `${s.referencedFiles.length} file referenziati nel codice originale`,
      files: s.referencedFiles,
    }))

  const byFolder = new Map<string, RegistryAsset[]>()
  for (const f of files) {
    const folder = folderOf(f.path)
    const kind: AssetKind = f.type === 'png' ? 'image' : f.type === 'mp3' || f.type === 'ogg' ? 'audio' : f.type === 'woff' ? 'font' : 'data'
    const item: RegistryAsset = {
      id: `file:${f.path}`,
      kind,
      name: f.path.split('/').pop() ?? f.path,
      sub:
        [
          f.width ? `${f.width}×${f.height}` : null,
          f.durationSec ? `${f.durationSec}s` : null,
          f.subTextures ? `${f.subTextures} frame` : null,
          f.jsonElements != null ? `${f.jsonElements} elementi` : null,
        ]
          .filter(Boolean)
          .join(' · ') || `${f.type}`,
      url: `${base}/${f.path}`,
      path: f.path,
      width: f.width,
      height: f.height,
      durationSec: f.durationSec,
      sizeBytes: f.sizeBytes,
      meta: f.subTextureNames ? { frames: f.subTextureNames.slice(0, 6).join(', ') } : undefined,
    }
    const arr = byFolder.get(folder) ?? []
    arr.push(item)
    byFolder.set(folder, arr)
  }

  const folderSections: RegistrySection[] = [...byFolder.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([folder, items]) => ({
      kind: items[0]?.kind ?? 'data',
      label: `${folder} (${items.length})`,
      items,
    }))

  const sections: RegistrySection[] = [
    {
      kind: 'screen',
      label: 'Schermate e stati',
      items: stateItems,
    },
    ...folderSections,
  ]

  return {
    sections,
    totalItems: sections.reduce((n, s) => n + s.items.length, 0),
    kindOrder: KIND_ORDER.filter((k) => sections.some((s) => s.items.length && s.kind === k)),
  }
}

export function normalizeRegistry(reg: GameRegistry): NormalizedGame {
  return isGM(reg) ? normalizeGM(reg) : normalizeFNF(reg)
}
