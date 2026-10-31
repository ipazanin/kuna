import type { Benchmark } from './benchmark'
import { benchmarkReplay } from './benchmarkReplay'
import type { BenchmarkReplay } from './benchmarkReplay'
import { lastsAYear, opensBeforeRecords, periodSpan, yearsSince } from './performancePeriod'
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
import { addDays } from '../../../../shared/calendar/civilDate'
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
/** The euros each growth line starts from. */
export const GROWTH_START = 100

/** What the money did over a period: its value at the last close and the money-weighted return a year. */
export interface MoneyReturns {
  readonly value: Money
  readonly moneyWeighted: YearlyReturn
}

export interface PeriodReturns extends MoneyReturns {
  /** Null when the portfolio was worth less than nothing on a day of the period. */
  readonly timeWeighted: TimeWeightedReturn | null
}

/** The same money in the benchmark: the portfolio's deposits and withdrawals put into it instead, on the same days. */
export interface ReplayReturns extends MoneyReturns {
  /** Withdrawals larger than the benchmark holding, which sold all of it, with the part left unpaid. */
  readonly unpaid: readonly DatedFlow[]
}

export interface BenchmarkComparison {
  /** The benchmark's own close in euros at the period's end over its close at the start, with no flows. */
  readonly priceReturn: TimeWeightedReturn
  /**
   * The portfolio's time-weighted return less the benchmark's price return, over the whole period. Null when the
   * portfolio was worth nothing all period, or its time-weighted return is left out.
   */
  readonly difference: number | null
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

/** What could not be valued on a day of the period: held instruments with no close or no rate, and cash with no rate. */
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
  /**
   * The first day the portfolio was worth less than nothing, as when cash went below zero for a missing record. The
   * time-weighted figures are left out then: the return, the growth line, the largest fall, the volatility and the difference.
   */
  readonly belowZeroOn: CivilDate | null
  /** Whether the portfolio was worth nothing on every day of the period, so it has no difference to the benchmark. */
  readonly nothingHeld: boolean
  readonly portfolio: PeriodReturns
  /** Null when no benchmark is chosen, or when it has no close or no rate on a day of the period, such as its first. */
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

/** A day's portfolio figures with the records up to it, at the latest close and rate on or before it. */
export type DayValuer = (date: CivilDate) => PortfolioFigures

interface DayFigures {
  readonly date: CivilDate
  readonly figures: PortfolioFigures
}

interface IndexPoint {
  readonly date: CivilDate
  readonly reached: number
}

/** Values each day once however many periods ask for it, so All and the years the screen opens with share their days. */
export function dayValuer(sources: PortfolioSources): DayValuer {
  const valued = new Map<CivilDate, PortfolioFigures>()
  return (date) => {
    let figures = valued.get(date)
    if (figures === undefined) {
      figures = portfolioFigures({ ...sources, book: recordsOn(sources.book, date), today: date })
      valued.set(date, figures)
    }
    return figures
  }
}

/**
 * The Performance screen's figures for a period. Deposits and withdrawals are the only flows, so a sale and a rebuy
 * change nothing. The portfolio's own figures never wait for the benchmark, which only the comparison needs.
 */
export function portfolioPerformance(sources: PortfolioSources, benchmark: Benchmark | null, period: PerformancePeriod, valuedOn: DayValuer = dayValuer(sources)): Performance {
  const flows = externalFlows(sources.book)
  const firstDeposit = firstDepositOf(flows)
  const span = firstDeposit === null ? null : periodSpan(period, firstDeposit, sources.today)
  if (firstDeposit === null || span === null) {
    return { kind: 'empty' }
  }
  const monthly = monthlyDays(span)
  const valued = valuationDays(span, flows, monthly).map((date): DayFigures => ({ date, figures: valuedOn(date) }))
  const isFullyValued = (day: DayFigures): boolean => day.figures.unpriced.length === 0 && day.figures.unratedCash.length === 0
  const lastFullyValued = valued.reduce((found, day, position) => (isFullyValued(day) ? position : found), -1)
  const firstKept = valued.reduce((found, day, position) => (position < lastFullyValued && !isFullyValued(day) ? position + 1 : found), 0)
  const kept = valued.slice(firstKept, lastFullyValued + 1)
  const heldBack = heldBackOn([...valued.slice(0, firstKept), ...valued.slice(lastFullyValued + 1)])
  const first = kept[0]
  const last = kept.at(-1)
  if (first === undefined || last === undefined) {
    return { kind: 'held-back', heldBack }
  }

  const flowOn = new Map<CivilDate, Money>()
  flows.forEach((flow) => flowOn.set(flow.date, addMoney(flowOn.get(flow.date) ?? ZERO, flow.amount)))
  const closes = kept.map(({ date, figures }): ValuedDay => ({ date, value: figures.value, flow: flowOn.get(date) ?? ZERO }))
  const opensEmpty = first.date === span.from && opensBeforeRecords(period, firstDeposit, sources.today)
  const portfolioDays: ValuedDay[] = [...(opensEmpty ? [{ date: first.date, value: ZERO, flow: ZERO }] : []), ...closes]
  const belowZeroOn = closes.find((day) => day.value < 0)?.date ?? null
  const nothingHeld = closes.every((day) => day.value === ZERO)
  const portfolioIndex = timeWeightedIndex(portfolioDays)
  const indexed = portfolioDays.map((day, position): IndexPoint => ({ date: day.date, reached: portfolioIndex[position]! }))
  const isMonthEnd = (date: CivilDate): boolean => date === lastDayOf(monthOf(date))
  const line = indexed.filter((point, position) => position === 0 || (point.date > first.date && (isMonthEnd(point.date) || position === indexed.length - 1)))
  const portfolio: PeriodReturns = {
    ...moneyReturnsOf(portfolioDays),
    timeWeighted: belowZeroOn === null ? timeWeightedReturn((indexed.at(-1)?.reached ?? 1) - 1, first.date, last.date) : null,
  }
  const benchmarkSources = (compared: Benchmark): PortfolioSources => ({ ...sources, book: { ...sources.book, splits: compared.splits } })
  const benchmarkLine =
    benchmark === null
      ? null
      : priceLine(
          benchmark.instrument,
          line.map((point) => point.date),
          benchmarkSources(benchmark),
        )
  const replay = benchmark === null ? null : benchmarkReplay(benchmark.instrument, portfolioDays, benchmarkSources(benchmark))
  const comparison = benchmarkLine === null || replay === null ? null : benchmarkComparison(portfolio, benchmarkLine, replay, { from: first.date, to: last.date }, nothingHeld)
  const monthlyIndex = monthly.flatMap((date) => indexed.find((point) => point.date === date) ?? [])
  const timeWeightedShown = belowZeroOn === null
  return {
    kind: 'figures',
    from: first.date,
    to: last.date,
    heldBack,
    lateCloses: uniqueInstruments(kept.flatMap((day) => day.figures.holdings.filter((holding) => holding.late).map((holding) => holding.instrument))),
    belowZeroOn,
    nothingHeld,
    portfolio,
    benchmark: comparison,
    growth: timeWeightedShown
      ? line.map((point, position): GrowthPoint => ({
          date: point.date,
          portfolio: GROWTH_START * point.reached,
          benchmark: benchmarkLine === null ? null : GROWTH_START * benchmarkLine[position]!,
        }))
      : [],
    largestFall: timeWeightedShown ? largestFall(line.map((point) => point.reached)) : null,
    volatility:
      timeWeightedShown && monthlyIndex.length > VOLATILITY_MONTHS ? yearlyVolatility(monthlyIndex.slice(1).map((point, position) => point.reached / monthlyIndex[position]!.reached - 1)) : null,
  }
}

/** Each calendar year's figures, from the first deposit's year to today's. */
export function performanceByYear(sources: PortfolioSources, benchmark: Benchmark | null, valuedOn: DayValuer = dayValuer(sources)): YearPerformance[] {
  const firstDeposit = firstDepositIn(sources.book)
  return firstDeposit === null ? [] : yearsSince(firstDeposit, sources.today).map((year) => ({ year, performance: portfolioPerformance(sources, benchmark, { kind: 'year', year }, valuedOn) }))
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

/** The day of the first deposit, where every period starts at the latest. */
export function firstDepositIn(book: InvestmentBook): CivilDate | null {
  return firstDepositOf(externalFlows(book))
}

function firstDepositOf(flows: readonly DatedFlow[]): CivilDate | null {
  return (
    flows
      .filter((flow) => flow.amount > 0)
      .map((flow) => flow.date)
      .sort()[0] ?? null
  )
}

/**
 * The span's first and last day, every deposit and withdrawal day, the day before each deposit, which the deposit's
 * piece of the return starts from, every month end and every monthly day between, in order.
 */
function valuationDays(span: PeriodSpan, flows: readonly DatedFlow[], monthly: readonly CivilDate[]): CivilDate[] {
  const monthEnds = monthsFrom(monthOf(span.from), monthOf(span.to)).map(lastDayOf)
  const beforeDeposits = flows.filter((flow) => flow.amount > 0).map((flow) => addDays(flow.date, -1))
  const days = new Set([span.from, ...flows.map((flow) => flow.date), ...beforeDeposits, ...monthEnds, ...monthly, span.to])
  return [...days].filter((date) => date >= span.from && date <= span.to).sort()
}

/** The span's last day and the same day of each month before it, back to its first day, in order. */
function monthlyDays(span: PeriodSpan): CivilDate[] {
  return Array.from({ length: monthCountBetween(monthOf(span.from), monthOf(span.to)) }, (_, back) => dayMonthsLater(span.to, -back))
    .filter((date) => date >= span.from)
    .reverse()
}

/** The book as it stood at the day's close. */
export function recordsOn(book: InvestmentBook, day: CivilDate): InvestmentBook {
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

function benchmarkComparison(portfolio: PeriodReturns, benchmarkLine: readonly number[], replay: BenchmarkReplay, span: PeriodSpan, nothingHeld: boolean): BenchmarkComparison {
  const priceReturn = timeWeightedReturn((benchmarkLine.at(-1) ?? 1) - 1, span.from, span.to)
  const replayReturns: ReplayReturns = { ...moneyReturnsOf(replay.days), unpaid: replay.unpaid }
  return {
    priceReturn,
    difference: portfolio.timeWeighted === null || nothingHeld ? null : portfolio.timeWeighted.total - priceReturn.total,
    replay: replayReturns,
    valueDifference: subtractMoney(portfolio.value, replayReturns.value),
  }
}

function heldBackOn(days: readonly DayFigures[]): HeldBack {
  return {
    instruments: uniqueInstruments(days.flatMap((day) => day.figures.unpriced)),
    currencies: [...new Set(days.flatMap((day) => day.figures.unratedCash.map((balance) => balance.currency)))],
  }
}

function uniqueInstruments(instruments: readonly Instrument[]): Instrument[] {
  return [...new Map(instruments.map((instrument) => [instrument.id, instrument])).values()]
}
