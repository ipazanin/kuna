import { realBooksFile } from '../../../storage/infrastructure/real/realBooks'
import type { RatesCache } from '../../application/ratesPorts'
import { RATES_FILE_NAME, decodeRatesFile } from '../../domain/ratesFile'

/** Fills this browser's copy of the rates from the real books folder, so the page shows the owner's rates before it asks the ECB for newer ones. Only the page's rates import this, behind inline `import.meta.env.DEV` and VITE_REAL_BOOKS comparisons. */
export async function seedRealRates(cache: RatesCache): Promise<void> {
  const text = await realBooksFile(RATES_FILE_NAME)
  if (text === null) return
  const read = decodeRatesFile(text)
  if (read.kind === 'read') await cache.replace(read.file)
}
