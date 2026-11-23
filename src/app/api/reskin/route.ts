import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// API reskin: applica sostituzioni ai file media del mirror, mai al codice.
// Ogni applicazione: 1) backup lazy dell'originale in _original/, 2) validazione
// dimensioni reali dal PNG, 3) scrittura, 4) registro in reskin.json.

const GAMES_ROOT = path.join(process.cwd(), 'public', 'games')
const ALLOWED_EXT = new Set(['.png', '.ogg', '.mp3', '.wav', '.woff'])
const MAX_BYTES = 16 * 1024 * 1024

interface ReskinEntry {
  file: string
  appliedAt: string
  kind: 'atlas-page' | 'file'
  sizeBytes: number
  targets: string[]
  note?: string
}

type ReskinMap = Record<string, ReskinEntry>

function gameDir(game: string): string {
  if (!/^[a-z0-9-]+$/.test(game)) throw new Error('game non valido')
  return path.join(GAMES_ROOT, game)
}

function safePath(game: string, rel: string): string {
  const dir = gameDir(game)
  const abs = path.resolve(dir, rel)
  if (!abs.startsWith(dir + path.sep)) throw new Error('percorso fuori dal gioco')
  if (abs.includes('_original')) throw new Error('i backup originali non si toccano')
  const ext = path.extname(abs).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) throw new Error(`estensione non ammessa: ${ext}`)
  return abs
}

function pngSize(buf: Buffer): { w: number; h: number } | null {
  // PNG: IHDR width/height ai byte 16-23 (big endian)
  if (
    buf.length < 24 ||
    !buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return null
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function decodeDataUrl(dataUrl: string): Buffer {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('dataUrl non valido')
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length <= 0 || buf.length > MAX_BYTES)
    throw new Error('file troppo grande o vuoto')
  return buf
}

function checkMagic(buf: Buffer, ext: string): void {
  const head = buf.subarray(0, 4)
  if (ext === '.png' && !head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    throw new Error('il file non è un PNG valido')
  }
  if (ext === '.ogg' && !head.equals(Buffer.from('OggS'))) {
    throw new Error('il file non è un OGG valido')
  }
  if (ext === '.mp3') {
    const ok =
      head.equals(Buffer.from('ID3')) || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    if (!ok) throw new Error('il file non è un MP3 valido')
  }
  if (ext === '.wav' && !buf.subarray(0, 4).equals(Buffer.from('RIFF'))) {
    throw new Error('il file non è un WAV valido')
  }
}

async function readReskin(game: string): Promise<ReskinMap> {
  try {
    return JSON.parse(
      await fs.readFile(path.join(gameDir(game), 'reskin.json'), 'utf8'),
    )
  } catch {
    return {}
  }
}

async function writeReskin(game: string, map: ReskinMap): Promise<void> {
  await fs.writeFile(
    path.join(gameDir(game), 'reskin.json'),
    JSON.stringify(map, null, 1),
  )
}

async function ensureBackup(
  game: string,
  rel: string,
  reskin: ReskinMap,
): Promise<void> {
  const dir = gameDir(game)
  const abs = path.resolve(dir, rel)
  const bak = path.join(dir, '_original', rel)
  await fs.mkdir(path.dirname(bak), { recursive: true })
  try {
    await fs.access(bak)
    return // backup già presente: è il vero originale
  } catch {
    /* assente: crea solo se il file corrente non è già un reskin */
  }
  if (reskin[rel])
    throw new Error('file già reskinato senza backup: impossibile procedere')
  await fs.copyFile(abs, bak)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const game = url.searchParams.get('game') ?? ''
  try {
    const state = await readReskin(game)
    return NextResponse.json({ state })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'errore' },
      { status: 400 },
    )
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body non valido' }, { status: 400 })
  }
  const game = String(body.game ?? '')
  const action = String(body.action ?? '')
  try {
    const reskin = await readReskin(game)
    const dir = gameDir(game)

    if (action === 'applyAtlas' || action === 'applyFile') {
      const rel = String(action === 'applyAtlas' ? body.page : body.path)
      if (!rel) throw new Error('percorso mancante')
      const dataField = action === 'applyAtlas' ? body.png : body.file
      if (typeof dataField !== 'string') throw new Error('dato mancante')
      const abs = safePath(game, rel)
      const ext = path.extname(abs).toLowerCase()
      const buf = decodeDataUrl(dataField)
      checkMagic(buf, ext)

      // garanzia geometria: le dimensioni non devono cambiare
      if (ext === '.png') {
        const newSize = pngSize(buf)
        if (!newSize) throw new Error('PNG non leggibile')
        const refPath = path.join(dir, '_original', rel)
        let refBuf: Buffer
        try {
          refBuf = await fs.readFile(refPath)
        } catch {
          refBuf = await fs.readFile(abs)
        }
        const refSize = pngSize(refBuf)
        if (!refSize) throw new Error('PNG di riferimento illeggibile')
        if (newSize.w !== refSize.w || newSize.h !== refSize.h) {
          throw new Error(
            `dimensioni PNG sbagliate: ${newSize.w}×${newSize.h}, richieste ${refSize.w}×${refSize.h}`,
          )
        }
      }

      await ensureBackup(game, rel, reskin)
      await fs.writeFile(abs, buf)
      reskin[rel] = {
        file: rel,
        appliedAt: new Date().toISOString(),
        kind: action === 'applyAtlas' ? 'atlas-page' : 'file',
        sizeBytes: buf.length,
        targets: Array.isArray(body.targets) ? body.targets.map(String) : [],
      }
      await writeReskin(game, reskin)
      return NextResponse.json({ ok: true, state: reskin })
    }

    if (action === 'restore') {
      const rel = String(body.path ?? '')
      if (!rel) throw new Error('percorso mancante')
      safePath(game, rel)
      const bak = path.join(dir, '_original', rel)
      const abs = path.resolve(dir, rel)
      await fs.copyFile(bak, abs)
      delete reskin[rel]
      await writeReskin(game, reskin)
      return NextResponse.json({ ok: true, state: reskin })
    }

    return NextResponse.json(
      { error: `azione sconosciuta: ${action}` },
      { status: 400 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'errore' },
      { status: 400 },
    )
  }
}
