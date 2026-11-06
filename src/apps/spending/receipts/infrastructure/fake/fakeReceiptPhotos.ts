import type { ReceiptPhotos } from '../../application/receiptPhotos'

/** How long the made-up upload takes, so a check can tap again during it. */
const UPLOAD_MS = 400

/** The fake build's twin, which sends nothing to another origin. */
export function fakeReceiptPhotos(): ReceiptPhotos {
  return {
    keep: async (_photo, issuedOn) => {
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_MS))
      return `fake-receipt-photo-${issuedOn}`
    },
  }
}
