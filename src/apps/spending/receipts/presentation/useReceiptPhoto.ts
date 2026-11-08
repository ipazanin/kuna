import { onScopeDispose, ref, shallowRef } from 'vue'

import { fiscalQr } from '../domain/fiscalQr'
import { placeInPhoto } from '../domain/photoPlace'
import type { PhotoPlace } from '../domain/photoPlace'
import type { FiscalQr } from '../domain/fiscalQr'

/** Where reading a photo stands: its QR code read, none found on it, or a photo this browser cannot decode. */
export type PhotoReading = 'none' | 'reading' | 'read' | 'no-code' | 'unreadable'

/** One receipt photo while the dialog holds it: the file, its preview, and what its QR code says and where it was taken. `forget` drops all of it. */
export function useReceiptPhoto() {
  const photo = shallowRef<File | null>(null)
  const preview = ref<string | null>(null)
  const reading = ref<PhotoReading>('none')
  const qr = shallowRef<FiscalQr | null>(null)
  const place = shallowRef<PhotoPlace | null>(null)

  function forget(): void {
    if (preview.value !== null) URL.revokeObjectURL(preview.value)
    photo.value = null
    preview.value = null
    reading.value = 'none'
    qr.value = null
    place.value = null
  }

  async function read(file: File): Promise<void> {
    forget()
    photo.value = file
    preview.value = URL.createObjectURL(file)
    reading.value = 'reading'
    const found = await placeInPhoto(file)
    if (photo.value === file) place.value = found
    try {
      // The decoder loads only once a photo comes.
      const { qrTextOn } = await import('../infrastructure/qrDecode')
      const text = await qrTextOn(file)
      if (photo.value !== file) return
      qr.value = text === null ? null : fiscalQr(text)
      reading.value = qr.value === null ? 'no-code' : 'read'
    } catch {
      if (photo.value === file) reading.value = 'unreadable'
    }
  }

  onScopeDispose(forget)

  return { photo, preview, reading, qr, place, read, forget }
}
