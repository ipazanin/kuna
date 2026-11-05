import type { Account } from '../../workbook/domain/account'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { NO_RATES, rateBookOfEcbRates } from '../../../../shared/money/rateBook'
import type { EcbRate, RateBook } from '../../../../shared/money/rateBook'

/** The ECB rates while they load, or once in hand, with whether any currency's request failed. */
export type RatesState = 'loading' | { readonly book: RateBook; readonly failed: boolean }

/** The rates that are in hand, which convert nothing while they load. */
export function ratesIn(state: RatesState): RateBook {
  return state === 'loading' ? NO_RATES : state.book
}

/** The rates of each currency the file needs as the ECB answered them, null for a currency whose request failed. */
export function ratesStateOf(answers: ReadonlyMap<CurrencyCode, readonly EcbRate[] | null>): RatesState {
  const series = new Map([...answers].flatMap(([currency, rates]) => (rates === null ? [] : [[currency, rates] as const])))
  return { book: rateBookOfEcbRates(series), failed: series.size < answers.size }
}

/** Whether a figure over these accounts waits for the rates: they are loading and one of the accounts is in another currency. */
export function waitsForRates(accounts: readonly Account[], rates: RatesState): boolean {
  return rates === 'loading' && accounts.some((account) => account.currency !== EURO)
}
