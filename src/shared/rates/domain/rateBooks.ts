import type { RatesFile } from './ratesFile'
import { rateBookOfDatedRates } from '../../money/rateBook'
import type { RateBook } from '../../money/rateBook'

/** The book every figure reads, of the ECB's rates in the file. */
export function everydayBook(file: RatesFile): RateBook {
  return rateBookOfDatedRates(new Map(Object.entries(file.ecb).map(([currency, series]) => [currency, series.rows])))
}
