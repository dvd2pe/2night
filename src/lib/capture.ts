// Cattura lo snapshot del canvas del gioco dall'iframe (same-origin).
// Nessuna modifica ai file del gioco: è una lettura del DOM esistente,
// la stessa cosa che fa Chrome DevTools quando ispeziona la pagina.
//
// Strategie in ordine:
//  1. toDataURL diretto (canvas 2D o WebGL con preserveDrawingBuffer)
//  2. toDataURL sincrono al frame di draw (doppio rAF: il callback del
//     padre gira prima di quello dell'iframe, quindi la cattura parte
//     nello stesso frame del draw del gioco) — funziona per GameMaker
//  3. captureStream + <video>: il browser cattura il canvas alla
//     composizione, indipendente da preserveDrawingBuffer — funziona
//     per OpenFL/HaxeFlixel. Il mirror resta attivo per le catture
//     successive finché il canvas è lo stesso.

interface LiveMirror {
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
}

let liveMirror: LiveMirror | null = null

function isBlankImage(url: string): Promise<boolean> {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 64
      c.height = 36
      const ctx = c.getContext('2d')
      if (!ctx) return res(true)
      ctx.drawImage(img, 0, 0, 64, 36)
      const d = ctx.getImageData(0, 0, 64, 36).data
      let sum = 0
      let squareSum = 0
      for (let i = 0; i < d.length; i += 4) {
        sum += d[i] + d[i + 1] + d[i + 2]
        squareSum += d[i] * d[i] + d[i + 1] * d[i + 1] + d[i + 2] * d[i + 2]
      }
      const n = d.length / 4
      const mean = sum / (n * 3)
      // varianza ~0 → immagine uniforme (vuota)
      res(squareSum / (n * 3) - mean * mean < 4)
    }
    img.onerror = () => res(true)
    img.src = url
  })
}

async function viaCaptureStream(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  try {
    const anyCanvas = canvas as HTMLCanvasElement & {
      captureStream?: (fps?: number) => MediaStream
    }
    if (typeof anyCanvas.captureStream !== 'function') return null
    if (!liveMirror || liveMirror.canvas !== canvas) {
      const stream = anyCanvas.captureStream(30)
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      video.width = canvas.width
      video.height = canvas.height
      video.style.display = 'none'
      document.body.appendChild(video)
      await video.play().catch(() => undefined)
      liveMirror = { canvas, video }
      // attendi il primo frame del mirror
      await new Promise((r) => setTimeout(r, 350))
    }
    const video = liveMirror.video
    if (!video.videoWidth || !video.videoHeight) return null
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}

export async function captureGameCanvas(
  frame: HTMLIFrameElement | null,
): Promise<string | null> {
  try {
    const w = frame?.contentWindow
    const doc = w?.document
    if (!w || !doc) return null
    const canvas = doc.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas || !canvas.width || !canvas.height) return null

    const shoot = (): string | null => {
      try {
        return canvas.toDataURL('image/png')
      } catch {
        return null
      }
    }

    // 1) tentativo diretto
    const direct = shoot()
    if (direct && !(await isBlankImage(direct))) return direct

    // 2) cattura sincrona al frame di draw del gioco
    const synced = await new Promise<string | null>((res) => {
      requestAnimationFrame(() => {
        try {
          w.requestAnimationFrame(() => res(shoot()))
        } catch {
          res(null)
        }
      })
    })
    if (synced && !(await isBlankImage(synced))) return synced

    // 3) captureStream + video (OpenFL/HaxeFlixel)
    const mirrored = await viaCaptureStream(canvas)
    if (mirrored && !(await isBlankImage(mirrored))) return mirrored

    return synced ?? direct
  } catch {
    return null
  }
}

export function dropLiveMirror(): void {
  if (liveMirror) {
    try {
      (liveMirror.video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop())
      liveMirror.video.remove()
    } catch {
      /* ignora */
    }
    liveMirror = null
  }
}
