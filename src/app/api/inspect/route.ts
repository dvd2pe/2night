import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Interprete Python con OpenCV: preferisci il venv del sandbox, poi PATH.
function pythonBin(): string {
  const candidates = [
    process.env.PYTHON_BIN,
    '/home/z/.venv/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3',
  ]
  for (const c of candidates) {
    if (c && existsSync(c)) return c
  }
  return 'python3'
}

// Ispezione stile Chrome DevTools: confronto pixel ESATTO tra lo snapshot
// del canvas del gioco e gli sprite REALI (registro compilato GameMaker /
// file+xml FNF). Nessuna inferenza: le posizioni sono misurate sui pixel,
// gli elementi non presenti non vengono restituiti.

const MAX_BYTES = 12 * 1024 * 1024

interface Match {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  score: number
  meta: Record<string, unknown>
}

export async function POST(req: Request) {
  let body: { game?: string; image?: string; only?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body non valido' }, { status: 400 })
  }
  const game = String(body.game ?? '')
  const image = String(body.image ?? '')
  if (!/^[a-z0-9-]+$/.test(game) || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'parametri mancanti' }, { status: 400 })
  }
  if (image.length > MAX_BYTES) {
    return NextResponse.json({ error: 'snapshot troppo grande' }, { status: 413 })
  }

  const script = path.join(process.cwd(), 'scripts', 'inspect_match.py')
  const payload = JSON.stringify({
    gameDir: path.join(process.cwd(), 'public', 'games', game),
    image,
    only: Array.isArray(body.only) ? body.only.map(String).slice(0, 64) : undefined,
  })

  try {
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(pythonBin(), [script], { timeout: 120000 })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => (stdout += d))
      child.stderr.on('data', (d) => (stderr += d))
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) resolve(stdout)
        else reject(new Error(stderr.trim().slice(-400) || `exit ${code}`))
      })
      child.stdin.write(payload)
      child.stdin.end()
    })
    const parsed = JSON.parse(out) as {
      matches: Match[]
      stats: Record<string, unknown>
    }
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'matching fallito' },
      { status: 500 },
    )
  }
}
