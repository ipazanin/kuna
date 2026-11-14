import { keepSetUpAnswer } from '../../../../../shared/app/setUpAnswer'
import { realBooksFile, seedRealBook } from '../../../../../shared/storage/infrastructure/real/realBooks'
import { PRICES_FILE_NAME, decodePricesFile } from '../../../prices/domain/pricesFile'
import { openPricesCache } from '../../../prices/infrastructure/pricesCache'
import { HISTORY_COMPLETE } from '../../../tax/domain/historyAnswer'
import { INVESTMENTS_APP } from '../investmentsDocument'

/**
 * Keeps the real Investments file in this browser with its prices, as this browser keeps them for a file with no prices file
 * on Drive, and with its history said to be complete, as the owner said on their own device. Only the Investments app's
 * install imports this, behind inline `import.meta.env.DEV` and VITE_REAL_BOOKS comparisons.
 */
export async function seedRealInvestments(): Promise<void> {
  const copy = await seedRealBook(INVESTMENTS_APP)
  if (copy === null) return
  keepSetUpAnswer(copy.meta.id, HISTORY_COMPLETE)
  const text = await realBooksFile(PRICES_FILE_NAME)
  const read = text === null ? null : decodePricesFile(text)
  if (read?.kind !== 'read') return
  const prices = openPricesCache(copy.meta.id)
  try {
    await prices.replace({ fileId: null, revision: 'real-books', readAt: copy.meta.syncedAt, file: read.file })
  } finally {
    prices.close()
  }
}
