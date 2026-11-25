import type { PortfolioSources } from '../../holdings/domain/holding'
import { portfolioFigures } from '../../holdings/domain/portfolioFigures'
import { firstDepositIn, recordsOn } from '../../performance/domain/portfolioPerformance'
import type { HeldBack } from '../../performance/domain/portfolioPerformance'
import type { Instrument } from '../../workbook/domain/instrument'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { overlapOf } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
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
  /** Each month end in the window and its last day, from the first one every holding has a price for. */
  readonly points: readonly ValuePoint[]
  /** What the points leave unvalued: the instruments and currencies the chart starts after or has a gap for. */
  readonly heldBack: HeldBack
}

/**
 * The value at each month end of the window and on its last day, against what was put in less what was taken out by
 * then, so the gap between them is the total gain. The window, null for everything, runs from the first deposit at the
 * earliest to today at the latest. The months before every holding has a price are left out.
 */
export function valueOverTime(sources: PortfolioSources, window: DateRange | null): ValueOverTime {
  const firstDeposit = firstDepositIn(sources.book)
  const held = firstDeposit === null ? null : { from: firstDeposit, to: sources.today }
  const span = held === null ? null : window === null ? held : overlapOf(held, window)
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

/**
 * The value over the window asked for, or over everything, a null window, when no day of that window has every holding
 * priced, so the chart never hides the way back.
 */
export function shownValueOverTime(sources: PortfolioSources, window: DateRange | null): { readonly window: DateRange | null; readonly over: ValueOverTime } {
  const over = valueOverTime(sources, window)
  if (over.points.length > 0 || window === null) {
    return { window, over }
  }
  return { window: null, over: valueOverTime(sources, null) }
}
