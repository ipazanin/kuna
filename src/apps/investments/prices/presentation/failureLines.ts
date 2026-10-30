import type { PriceVendor } from '../application/priceVendor'
import { ECB_SOURCE } from '../domain/pricesFile'
import type { PriceFailure } from '../domain/pricesFile'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'

/** One failure of the last fetch: what got nothing, by the instruments that name its series, and why, in a sentence. */
export interface FailureLine {
  readonly series: string
  readonly what: string
  readonly why: string
}

export function failureLines(failures: readonly PriceFailure[], book: InvestmentBook | null, vendors: readonly PriceVendor[]): FailureLine[] {
  return failures.map((failure) => {
    const split = failure.series.indexOf(':')
    const [source, symbol] = [failure.series.slice(0, split), failure.series.slice(split + 1)]
    const vendor = vendors.find((candidate) => candidate.id === source)?.name ?? source
    const named = (book?.instruments ?? []).filter((instrument) => instrument.prices === source && instrument.sourceSymbol === symbol).map((instrument) => `${instrument.name} (${symbol})`)
    const what = source === ECB_SOURCE ? words.failures.rates(symbol) : named.length > 0 ? named.join(', ') : symbol
    return { series: failure.series, what, why: words.failures.reason[failure.reason](vendor) }
  })
}
