import { paidUpTo, paymentAmounts, sumAmounts } from './incomeHistory'
import type { IncomeAmounts } from './incomeHistory'
import { investmentLots, paidBackOf } from '../../holdings/domain/lots'
import type { Income } from '../../workbook/domain/income'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ratioOf } from '../../../../shared/money/money'

export interface CountryWithheld extends IncomeAmounts {
  /** The first two letters of the payer's ISIN, null for income with no ISIN, such as interest on cash. */
  readonly country: string | null
  /** Withheld over gross, null when the gross is zero. */
  readonly share: number | null
}

export interface YearWithheld {
  readonly year: number
  /** Largest gross first, the income with no ISIN last. */
  readonly countries: readonly CountryWithheld[]
}

/** The tax withheld at source on income up to the day, by calendar year, newest first, and by the country the payer's ISIN starts with. No tax is worked out. */
export function withheldByCountry(book: InvestmentBook, today: CivilDate): YearWithheld[] {
  const paidBack = paidBackOf(investmentLots(book))
  const isinOf = new Map(book.instruments.map((instrument) => [instrument.id, instrument.isin]))
  const countryOf = (payment: Income): string | null => {
    const isin = payment.instrument === null ? null : (isinOf.get(payment.instrument) ?? null)
    return isin === null || isin.length < 2 ? null : isin.slice(0, 2).toUpperCase()
  }
  const byYear = new Map<number, Map<string | null, IncomeAmounts[]>>()
  for (const payment of paidUpTo(book, today)) {
    const countries = byYear.get(yearOf(payment.date)) ?? new Map<string | null, IncomeAmounts[]>()
    const country = countryOf(payment)
    countries.set(country, [...(countries.get(country) ?? []), paymentAmounts(payment, paidBack)])
    byYear.set(yearOf(payment.date), countries)
  }
  return [...byYear]
    .sort(([earlier], [later]) => later - earlier)
    .map(([year, countries]) => ({
      year,
      countries: [...countries]
        .map(([country, amounts]): CountryWithheld => {
          const total = sumAmounts(amounts)
          return { country, ...total, share: ratioOf(total.withheld, total.gross) }
        })
        .sort((first, second) => Number(first.country === null) - Number(second.country === null) || second.gross - first.gross || (first.country ?? '').localeCompare(second.country ?? '')),
    }))
}
