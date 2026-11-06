import type { ReceiptPhotos } from '../application/receiptPhotos'
import { googleReceiptPhotos } from '../infrastructure/googleReceiptPhotos'
import { tokenFor } from '../../../../shared/google/googleAuth'

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
