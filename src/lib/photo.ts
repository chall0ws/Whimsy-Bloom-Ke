import { LIVE } from '../config'
import { api } from '../state/api'

/** Shrinks a photo in the browser (keeping its orientation) and returns it as a JPEG data URL. */
export async function resizePhoto(file: File, maxSide: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t prepare photos.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Prepares a photo of a finished order. Live: stored on the server and returned as a link.
 * Demo: kept small and inline, since there's no server.
 */
export async function uploadOrderPhoto(orderId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Please choose a photo.' }
  try {
    if (!LIVE) return { ok: true, url: await resizePhoto(file, 800, 0.7) }
    const image = await resizePhoto(file, 1600, 0.82)
    return await api<{ ok: true; url: string } | { ok: false; error: string }>('order-photo', { orderId, image })
  } catch {
    return { ok: false, error: 'The photo couldn’t be added. Please try another one.' }
  }
}
