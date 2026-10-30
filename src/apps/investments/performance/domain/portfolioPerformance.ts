import { benchmarkReplay } from './benchmarkReplay'
import type { BenchmarkReplay } from './benchmarkReplay'
import { lastsAYear, periodSpan, yearsSince } from './performancePeriod'
import type { PerformancePeriod, PeriodSpan } from './performancePeriod'
import { largestFall, yearlyVolatility } from './riskFigures'
import { moneyWeightedRate, timeWeightedIndex, timeWeightedReturn } from './timeWeightedReturn'
import type { TimeWeightedReturn, ValuedDay } from './timeWeightedReturn'
import { valuationOn } from '../../holdings/domain/holding'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { portfolioFigures } from '../../holdings/domain/portfolioFigures'
import type { PortfolioFigures, YearlyReturn } from '../../holdings/domain/portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater, lastDayOf, monthCountBetween, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, dividedDecimal, inEuros } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, addMoney, negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { DatedFlow } from '../../../../shared/money/rateSolver'

/** A year of monthly returns, which the volatility waits for. */
const VOLATILITY_MONTHS = 12
const GROWTH_START = 100

/** What the money did over a period: its value at the last close and the money-weighted return a year. */
export interface MoneyReturns {
  readonly value: Money
  readonly moneyWeighted: YearlyReturn
}

export interface PeriodReturns extends MoneyReturns {
  readonly timeWeighted: TimeWeightedReturn
}

/** The same money in the benchmark: the portfolio's deposits and withdrawals put into it instead, on the same days. */
export interface ReplayReturns extends MoneyReturns {
  /** Withdrawals larger than the benchmark holding, which sold all of it, with the part left unpaid. */
  readonly unpaid: readonly DatedFlow[]
}

export interface BenchmarkComparison {
  /** The benchmark's own close in euros at the period's end over its close at the start, with no flows. */
  readonly priceReturn: TimeWeightedReturn
  /** The portfolio's time-weighted return less the benchmark's price return, over the whole period. */
  readonly difference: number
  readonly replay: ReplayReturns
  /** The portfolio's value less the replay's at the last close, below zero when the portfolio is behind. */
  readonly valueDifference: Money
}

/** €100 on the period's first day grown at the portfolio's time-weighted return and at the benchmark's price return. */
export interface GrowthPoint {
  readonly date: CivilDate
  readonly portfolio: number
  readonly benchmark: number | null
}

/** What could not be valued on a day of the period: held instruments or the benchmark with no close or no rate, and cash with no rate. */
export interface HeldBack {
  readonly instruments: readonly Instrument[]
  readonly currencies: readonly CurrencyCode[]
}

export interface PeriodPerformance extends PeriodSpan {
  readonly kind: 'figures'
  /**
   * What the period could not be valued without. The figures end on the last day that could be valued, and start on the
   * next valuation day after the last earlier day that could not.
   */
  readonly heldBack: HeldBack
  /** Holdings valued on a day of the period at a close that was late by then, such as a month-end close. */
  readonly lateCloses: readonly Instrument[]
  readonly portfolio: PeriodReturns
  /** Null when no benchmark is chosen. */
  readonly benchmark: BenchmarkComparison | null
  /** On the period's first day, each month end and its last day. Deposit and withdrawal days split the return but are no points. */
  readonly growth: readonly GrowthPoint[]
  /** Of the portfolio's growth points. */
  readonly largestFall: number | null
  /** From the monthly returns that end on the period's last day, once there are 12. */
  readonly volatility: number | null
}

/** `empty` when nothing was deposited by the period's end. `held-back` when no day of it could be valued, so the chart would have no days. */
export type Performance = PeriodPerformance | { readonly kind: 'empty' } | { readonly kind: 'held-back'; readonly heldBack: HeldBack }

export interface YearPerformance {
  readonly year: number
  readonly performance: Performance
}

interface DayFigures {
  readonly date: CivilDate
  readonly figures: PortfolioFigures
  readonly benchmarkPriced: boolean
}

interface IndexPoint {
  readonly date: CivilDate
  readonly reached: number
}

/**
 * The Performance screen's figures for a period. Deposits and withdrawals are the only flows, so a sale and a rebuy
 * change nothing. Each day is valued with the records up to it, at the latest close and rate on or before it.
 */
export function portfolioPerformance(sources: PortfolioSources, benchmark: Instrument | null, period: PerformancePeriod): Performance {
  const flows = externalFlows(sources.book)
  const firstDeposit = firstDepositOf(flows)
  const span = firstDeposit === null ? null : periodSpan(period, firstDeposit, sources.today)
  if (span === null) {
    return { kind: 'empty' }
  }
  const monthly = monthlyDays(span)
  const valued = valuationDays(span, flows, monthly).map((date): DayFigures => {
    const figures = portfolioFigures({ ...sources, book: recordsOn(sources.book, date), today: date })
    return { date, figures, benchmarkPriced: benchmark === null || valuationOn(benchmark, DECIMAL_ZERO, sources, date) !== null }
  })
  const isFullyValued = (day: DayFigures): boolean => day.benchmarkPriced && day.figures.unpriced.length === 0 && day.figures.unratedCash.length === 0
  const lastFullyValued = valued.reduce((found, day, position) => (isFullyValued(day) ? position : found), -1)
  const firstKept = valued.reduce((found, day, position) => (position < lastFullyValued && !isFullyValued(day) ? position + 1 : found), 0)
  const kept = valued.slice(firstKept, lastFullyValued + 1)
  const heldBack = heldBackOn([...valued.slice(0, firstKept), ...valued.slice(lastFullyValued + 1)], benchmark)
  const first = kept[0]
  const last = kept.at(-1)
  if (first === undefined || last === undefined) {
    return { kind: 'held-back', heldBack }
  }

  const flowOn = new Map<CivilDate, Money>()
  flows.forEach((flow) => flowOn.set(flow.date, addMoney(flowOn.get(flow.date) ?? ZERO, flow.amount)))
  const closes = kept.map(({ date, figures }): ValuedDay => ({ date, value: figures.value, flow: flowOn.get(date) ?? ZERO }))
  const portfolioDays = first.date === firstDeposit ? openedBeforeFlows(closes) : closes
  const portfolioIndex = timeWeightedIndex(portfolioDays)
  const indexed = portfolioDays.map((day, position): IndexPoint => ({ date: day.date, reached: portfolioIndex[position]! }))
  const isMonthEnd = (date: CivilDate): boolean => date === lastDayOf(monthOf(date))
  const line = indexed.filter((point, position) => position === 0 || (point.date > first.date && (isMonthEnd(point.date) || position === indexed.length - 1)))
  const portfolio: PeriodReturns = { ...moneyReturnsOf(portfolioDays), timeWeighted: timeWeightedReturn((indexed.at(-1)?.reached ?? 1) - 1, first.date, last.date) }
  const benchmarkLine =
    benchmark === null
      ? null
      : priceLine(
          benchmark,
          line.map((point) => point.date),
          sources,
        )
  const replay = benchmark === null ? null : benchmarkReplay(benchmark, portfolioDays, sources)
  const comparison = benchmarkLine === null || replay === null ? null : benchmarkComparison(portfolio, benchmarkLine, replay, first.date, last.date)
  const monthlyIndex = monthly.flatMap((date) => indexed.find((point) => point.date === date) ?? [])
  return {
    kind: 'figures',
    from: first.date,
    to: last.date,
    heldBack,
    lateCloses: uniqueInstruments(kept.flatMap((day) => day.figures.holdings.filter((holding) => holding.late).map((holding) => holding.instrument))),
    portfolio,
    benchmark: comparison,
    growth: line.map((point, position): GrowthPoint => ({
      date: point.date,
      portfolio: GROWTH_START * point.reached,
      benchmark: benchmarkLine === null ? null : GROWTH_START * benchmarkLine[position]!,
    })),
    largestFall: largestFall(line.map((point) => point.reached)),
    volatility: monthlyIndex.length > VOLATILITY_MONTHS ? yearlyVolatility(monthlyIndex.slice(1).map((point, position) => point.reached / monthlyIndex[position]!.reached - 1)) : null,
  }
}

/** Each calendar year's figures, from the first deposit's year to today's. */
export function performanceByYear(sources: PortfolioSources, benchmark: Instrument | null): YearPerformance[] {
  const firstDeposit = firstDepositOf(externalFlows(sources.book))
  return firstDeposit === null ? [] : yearsSince(firstDeposit, sources.today).map((year) => ({ year, performance: portfolioPerformance(sources, benchmark, { kind: 'year', year }) }))
}

/** Deposits and withdrawals in euros at their own rates, positive when money enters the portfolio, as the time-weighted return counts them. */
function externalFlows(book: InvestmentBook): DatedFlow[] {
  return book.cashMovements
    .filter((movement) => movement.kind === 'deposit' || movement.kind === 'withdrawal')
    .map((movement) => {
      const euros = inEuros(movement.amount, movement.rate)
      return { date: movement.date, amount: movement.kind === 'deposit' ? euros : negateMoney(euros) }
    })
}

function firstDepositOf(flows: readonly DatedFlow[]): CivilDate | null {
  return (
    flows
      .filter((flow) => flow.amount > 0)
      .map((flow) => flow.date)
      .sort()[0] ?? null
  )
}

/** The span's first and last day, every deposit and withdrawal day, every month end and every monthly day between, in order. */
function valuationDays(span: PeriodSpan, flows: readonly DatedFlow[], monthly: readonly CivilDate[]): CivilDate[] {
  const monthEnds = monthsFrom(monthOf(span.from), monthOf(span.to)).map(lastDayOf)
  const days = new Set([span.from, ...flows.map((flow) => flow.date), ...monthEnds, ...monthly, span.to])
  return [...days].filter((date) => date >= span.from && date <= span.to).sort()
}

/** The span's last day and the same day of each month before it, back to its first day, in order. */
function monthlyDays(span: PeriodSpan): CivilDate[] {
  return Array.from({ length: monthCountBetween(monthOf(span.from), monthOf(span.to)) }, (_, back) => dayMonthsLater(span.to, -back))
    .filter((date) => date >= span.from)
    .reverse()
}

/**
 * A period that starts on the first deposit day opens just before that day's records, with nothing held but the
 * day's deposits less withdrawals. All of them count as put in, and the day's fees and trades count inside the period.
 */
function openedBeforeFlows(closes: readonly ValuedDay[]): ValuedDay[] {
  const [first, ...later] = closes
  return first === undefined ? [] : [{ date: first.date, value: first.flow, flow: first.flow }, { ...first, flow: ZERO }, ...later]
}

/** The book as it stood at the day's close. */
function recordsOn(book: InvestmentBook, day: CivilDate): InvestmentBook {
  const upTo = <Dated extends { readonly date: CivilDate }>(records: readonly Dated[]): Dated[] => records.filter((record) => record.date <= day)
  return {
    ...book,
    trades: upTo(book.trades),
    income: upTo(book.income),
    cashMovements: upTo(book.cashMovements),
    exchanges: upTo(book.exchanges),
    transfers: upTo(book.transfers),
    splits: upTo(book.splits),
    spinOffs: upTo(book.spinOffs),
    prices: upTo(book.prices),
  }
}

function moneyReturnsOf(days: readonly ValuedDay[]): MoneyReturns {
  const first = days[0]
  const last = days.at(-1)
  const rate = moneyWeightedRate(days)
  return {
    moneyWeighted: first === undefined || last === undefined || !lastsAYear(first.date, last.date) ? { kind: 'under-a-year' } : rate === null ? { kind: 'none' } : { kind: 'rate', rate },
    value: last?.value ?? ZERO,
  }
}

/** The benchmark's close in euros on each day over its close on the first, in today's units. Null when a day has no close or no rate. */
function priceLine(benchmark: Instrument, days: readonly CivilDate[], sources: PortfolioSources): number[] | null {
  const prices: Decimal[] = []
  for (const day of days) {
    const close = valuationOn(benchmark, DECIMAL_ZERO, sources, day)
    if (close === null) {
      return null
    }
    prices.push(close.rate === null ? close.price : dividedDecimal(close.price, close.rate))
  }
  const start = prices[0]
  return start === undefined ? null : prices.map((price) => Number(price) / Number(start))
}

function benchmarkComparison(portfolio: PeriodReturns, benchmarkLine: readonly number[], replay: BenchmarkReplay, from: CivilDate, to: CivilDate): BenchmarkComparison {
  const priceReturn = timeWeightedReturn((benchmarkLine.at(-1) ?? 1) - 1, from, to)
  const replayReturns: ReplayReturns = { ...moneyReturnsOf(replay.days), unpaid: replay.unpaid }
  return {
    priceReturn,
    difference: portfolio.timeWeighted.total - priceReturn.total,
    replay: replayReturns,
    valueDifference: subtractMoney(portfolio.value, replayReturns.value),
  }
}

function heldBackOn(days: readonly DayFigures[], benchmark: Instrument | null): HeldBack {
  return {
    instruments: uniqueInstruments(days.flatMap((day) => [...day.figures.unpriced, ...(day.benchmarkPriced || benchmark === null ? [] : [benchmark])])),
    currencies: [...new Set(days.flatMap((day) => day.figures.unratedCash.map((balance) => balance.currency)))],
  }
}

function uniqueInstruments(instruments: readonly Instrument[]): Instrument[] {
  return [...new Map(instruments.map((instrument) => [instrument.id, instrument])).values()]
}
