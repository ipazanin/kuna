import { ref } from 'vue'

import type { ReceiptPhotos } from '../application/receiptPhotos'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** The photo a save keeps on Drive, and the day it is named by. */
export interface PhotoToKeep {
  readonly file: File
  readonly issuedOn: CivilDate
}

export type ReceiptSaveOutcome = { readonly kind: 'saved' | 'refused' | 'busy' } | { readonly kind: 'photo-failed'; readonly reason: string }

/**
 * One dialog's saves: the upload and the write count as one save, so a second tap during either does nothing, and a photo
 * uploaded before a refused write is not uploaded again on the retry. `photos` is asked first in the tap, since Firefox opens
 * Google's popup only while the click is recent. The photo's id has to be in the one write, so the upload comes first.
 */
export function useReceiptSave(photos: () => Promise<ReceiptPhotos>) {
  const saving = ref(false)
  let kept: { readonly file: File; readonly id: string } | null = null

  async function keptId({ file, issuedOn }: PhotoToKeep): Promise<string> {
    if (kept?.file !== file) kept = { file, id: await (await photos()).keep(file, issuedOn) }
    return kept.id
  }

  async function save(photo: PhotoToKeep | null, write: (photoId: string) => Promise<boolean>): Promise<ReceiptSaveOutcome> {
    if (saving.value) return { kind: 'busy' }
    saving.value = true
    try {
      let photoId = ''
      try {
        photoId = photo === null ? '' : await keptId(photo)
      } catch (reason) {
        return { kind: 'photo-failed', reason: reason instanceof Error ? reason.message : String(reason) }
      }
      return { kind: (await write(photoId)) ? 'saved' : 'refused' }
    } finally {
      saving.value = false
    }
  }

  return { saving, save }
}
