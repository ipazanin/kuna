import jsQR from 'jsqr'

/** Keeps the decoder, which runs on the page's own thread, from stalling on a full-size phone photo. */
const LONG_EDGE = 1_600

/** The text of the QR code on the photo, or null when it finds none. Throws for a photo this browser cannot decode, such as a HEIC on Firefox. */
export async function qrTextOn(photo: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(photo)
  try {
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (context === null) throw new Error('This browser gave no canvas to read the photo on.')
    context.drawImage(bitmap, 0, 0, width, height)
    return jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'dontInvert' })?.data ?? null
  } finally {
    bitmap.close()
  }
}
