import type { ReceiptPhotos } from '../../application/receiptPhotos'

/** The fake build's twin, which sends nothing to another origin. */
export function fakeReceiptPhotos(): ReceiptPhotos {
  return { keep: async (_photo, issuedOn) => `fake-receipt-photo-${issuedOn}` }
}
