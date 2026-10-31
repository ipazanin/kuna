import type { PortfolioSources } from '../../holdings/domain/holding'
import { portfolioFigures } from '../../holdings/domain/portfolioFigures'
import { periodSpan } from '../../performance/domain/performancePeriod'
import type { PerformancePeriod } from '../../performance/domain/performancePeriod'
import { recordsOn } from '../../performance/domain/portfolioPerformance'
import type { HeldBack } from '../../performance/domain/portfolioPerformance'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater, lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'

/** The portfolio at the close of a day, with the records up to it. */
export interface ValuePoint {
  readonly date: CivilDate
  /** Null when a held instrument had no close or no rate that day, or cash no rate. */
  readonly value: Money | null
  /** Deposits less withdrawals up to the day, each in euros at its own rate. */
  readonly putIn: Money
  /** The value less what was put in, null with the value. */
  readonly gain: Money | null
}

export interface ValueOverTime {
  /** Each month end in the period and the figures' day, from the first one every holding has a price for. */
  readonly points: readonly ValuePoint[]
  /** What the points leave unvalued: the instruments and currencies the chart starts after or has a gap for. */
  readonly heldBack: HeldBack
}

/**
 * The value at each month end of the period and on its last day, against what was put in less what was taken out by
 * then, so the gap between them is the total gain. The months before every holding has a price are left out.
 */
export function valueOverTime(sources: PortfolioSources, period: PerformancePeriod): ValueOverTime {
  const firstDeposit = firstDepositOf(sources.book)
  const span = firstDeposit === null ? null : periodSpan(period, firstDeposit, sources.today)
  if (span === null) {
    return { points: [], heldBack: { instruments: [], currencies: [] } }
  }
  const monthEnds = monthsFrom(monthOf(span.from), monthOf(span.to))
    .map(lastDayOf)
    .filter((date) => date >= span.from && date < span.to)
  const instruments = new Map<string, Instrument>()
  const currencies = new Set<CurrencyCode>()
  const valued = [...monthEnds, span.to].map((date): ValuePoint => {
    const figures = portfolioFigures({ ...sources, book: recordsOn(sources.book, date), today: date })
    figures.unpriced.forEach((instrument) => instruments.set(instrument.id, instrument))
    figures.unratedCash.forEach((balance) => currencies.add(balance.currency))
    const whole = figures.unpriced.length === 0 && figures.unratedCash.length === 0
    return { date, value: whole ? figures.value : null, putIn: figures.putIn, gain: whole ? figures.totalGain : null }
  })
  const firstWhole = valued.findIndex((point) => point.value !== null)
  return { points: firstWhole === -1 ? [] : valued.slice(firstWhole), heldBack: { instruments: [...instruments.values()], currencies: [...currencies] } }
}

/** The value over the period asked for, or over everything when no day of that period has every holding priced, so the chart never hides the way back. */
export function shownValueOverTime(sources: PortfolioSources, period: PerformancePeriod): { readonly period: PerformancePeriod; readonly over: ValueOverTime } {
  const over = valueOverTime(sources, period)
  if (over.points.length > 0 || period.kind === 'all') {
    return { period, over }
  }
  const everything: PerformancePeriod = { kind: 'all' }
  return { period: everything, over: valueOverTime(sources, everything) }
}

/** The last one, three and five years that start after the first deposit, then everything, so no two periods show the same months. */
export function valuePeriods(book: InvestmentBook, today: CivilDate): PerformancePeriod[] {
  const firstDeposit = firstDepositOf(book)
  const longer = ([1, 3, 5] as const).filter((years) => firstDeposit !== null && dayMonthsLater(today, -12 * years) > firstDeposit)
  return [...longer.map((years): PerformancePeriod => ({ kind: 'years', years })), { kind: 'all' }]
}

function firstDepositOf(book: InvestmentBook): CivilDate | null {
  return book.cashMovements
    .filter((movement) => movement.kind === 'deposit')
    .map((movement) => movement.date)
    .reduce<CivilDate | null>((first, date) => (first === null || date < first ? date : first), null)
}
