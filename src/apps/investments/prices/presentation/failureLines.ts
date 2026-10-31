import type { RouteLocationRaw } from 'vue-router'

import type { PriceVendor } from '../application/priceVendor'
import { ECB_SOURCE } from '../domain/pricesFile'
import type { FailureReason, PriceFailure } from '../domain/pricesFile'
import { holdingLink } from '../../holdings/presentation/holdingLinks'
import { INVESTMENTS_PRICES_ROUTE } from '../../overview/presentation/investmentLinks'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'

/** One failure of the last fetch: what got nothing, by the instruments that name its series, why, and what to do about it. */
export interface FailureLine {
  readonly series: string
  readonly what: string
  readonly why: string
  readonly advice: string
  /** Where the person fixes it, the Prices settings or the holding, or null when Kuna asks again by itself. */
  readonly link: { readonly label: string; readonly to: RouteLocationRaw } | null
}

/** Failures that wait for the person: a key to add, a symbol to check, or another source to pick. */
const ASKS_THE_PERSON: readonly FailureReason[] = ['no-key', 'unknown-symbol', 'not-on-free-key']

export function needsThePerson(failure: PriceFailure): boolean {
  return ASKS_THE_PERSON.includes(failure.reason)
}

function linkOf(reason: FailureReason, named: readonly Instrument[]): FailureLine['link'] {
  if (reason === 'no-key') {
    return { label: words.advice.toSettings, to: INVESTMENTS_PRICES_ROUTE }
  }
  const first = named[0]
  return (reason === 'unknown-symbol' || reason === 'not-on-free-key') && first !== undefined ? { label: words.advice.toHolding, to: holdingLink(first) } : null
}

export function failureLines(failures: readonly PriceFailure[], book: InvestmentBook | null, vendors: readonly PriceVendor[]): FailureLine[] {
  return failures.map((failure) => {
    const split = failure.series.indexOf(':')
    const [source, symbol] = [failure.series.slice(0, split), failure.series.slice(split + 1)]
    const vendor = vendors.find((candidate) => candidate.id === source)?.name ?? source
    const named = (book?.instruments ?? []).filter((instrument) => instrument.prices === source && instrument.sourceSymbol === symbol)
    const what = source === ECB_SOURCE ? words.failures.rates(symbol) : named.length > 0 ? named.map((instrument) => `${instrument.name} (${symbol})`).join(', ') : symbol
    return { series: failure.series, what, why: words.failures.reason[failure.reason](vendor), advice: words.advice[failure.reason](vendor), link: linkOf(failure.reason, named) }
  })
}
