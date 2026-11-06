import type { ReceiptPhotos } from '../application/receiptPhotos'
import { googleReceiptPhotos } from '../infrastructure/googleReceiptPhotos'
import { currentToken, signsInByRedirect, tokenFor } from '../../../../shared/google/googleAuth'

/**
 * Drive with the page's token, or with a new one, which opens Google's popup, so a click handler calls this first. The fake
 * build's twin sends nothing to another origin.
 */
export async function receiptPhotos(booksFileId: string): Promise<ReceiptPhotos> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeReceiptPhotos } = await import('../infrastructure/fake/fakeReceiptPhotos')
    return fakeReceiptPhotos()
  }
  return googleReceiptPhotos(await tokenFor('drive.file', null), booksFileId)
}

/** Whether a tap can get Drive here: a phone would leave the page to ask Google, which drops the photo and any read, so it needs a live token first. */
export function canKeepPhotoNow(): boolean {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') return true
  return !signsInByRedirect() || currentToken('drive.file') !== null
}
