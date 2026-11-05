import type { AccountOnDay } from '../../rates/domain/euroRows'
import type { RatesState } from '../../rates/domain/ratesState'
import { words as rateWords } from '../../rates/presentation/words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'

/** What a foreign account's balance is in euros, and the rate line under it, or the wait while the rates load. Euros stay blank when the rates do not reach the day. */
export interface EuroLine {
  readonly euros: string
  readonly caption: string
}

/** Null for a euro account. The rate is the newest the ECB published on or before the day. */
export function euroLine(shown: AccountOnDay, rates: RatesState, day: CivilDate): EuroLine | null {
  const { currency } = shown.account
  if (currency === EURO) return null
  if (rates === 'loading') return { euros: '', caption: rateWords.loading }
  if (shown.euros === null) return { euros: '', caption: '' }
  const newest = rates.book.newestDay(currency)
  return { euros: formatMoney(shown.euros), caption: rateWords.atRate(newest !== null && newest < day ? newest : day) }
}
