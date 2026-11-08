import { base64OfBytes } from '../../text/base64'
import type { AiImagePart } from '../domain/aiTask'

/** Enough pixels to read a till's small print, about 2,300 of Anthropic's image tokens. An area, since a long edge alone leaves a tall receipt too narrow to read. */
const MOST_PIXELS = 1_800_000
/** The longest edge Anthropic reads at full detail. OpenAI's and OpenRouter's models take at least this much. */
const MOST_EDGE = 2_576
/** Each provider takes far more. This keeps a photo's request quick to send. */
const MOST_BYTES = 600_000
const QUALITIES: readonly number[] = [0.85, 0.7, 0.55]

/** The size a photo is sent at. A photo smaller than both limits keeps its size. */
export function sentSize(width: number, height: number): { readonly width: number; readonly height: number } {
  const scale = Math.min(1, Math.sqrt(MOST_PIXELS / (width * height)), MOST_EDGE / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function jpegOf(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error('This browser could not make a JPEG of the photo.')) : resolve(blob)), 'image/jpeg', quality)
  })
}

/**
 * A photo as a task sends it: a JPEG every provider reads, downscaled here, which also drops the camera's EXIF block with any
 * GPS. Throws for a photo this browser cannot decode, such as a HEIC on Firefox.
 */
export async function imagePartOf(photo: Blob): Promise<AiImagePart> {
  const bitmap = await createImageBitmap(photo)
  try {
    const { width, height } = sentSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('This browser gave no canvas to draw the photo on.')
    context.drawImage(bitmap, 0, 0, width, height)
    let jpeg = await jpegOf(canvas, QUALITIES[0]!)
    for (const quality of QUALITIES.slice(1)) {
      if (jpeg.size <= MOST_BYTES) break
      jpeg = await jpegOf(canvas, quality)
    }
    return { kind: 'image', mediaType: 'image/jpeg', base64: base64OfBytes(new Uint8Array(await jpeg.arrayBuffer())), width, height }
  } finally {
    bitmap.close()
  }
}
