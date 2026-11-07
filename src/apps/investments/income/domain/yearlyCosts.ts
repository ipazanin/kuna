import { accountFeesInEuros, exchangeFeesInEuros, tradeFeesInEuros } from '../../holdings/domain/fees'
import { fundTerOf } from '../../holdings/domain/fundTer'
import type { FundTer } from '../../holdings/domain/fundTer'
import type { PortfolioSources } from '../../holdings/domain/holding'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { yearsSince } from '../../performance/domain/performancePeriod'
import { firstDepositIn } from '../../performance/domain/portfolioPerformance'
import type { DayValuer } from '../../performance/domain/portfolioPerformance'
import type { FactsBook } from '../../prices/domain/factsBook'
import type { Instrument } from '../../workbook/domain/instrument'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater, lastDayOf, monthKey, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { decimalOfMoney, inEuros, scaledDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, divideMoney, ratioOf, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Share } from '../../../../shared/money/percent'

/** A fund's estimated cost over a year, already taken inside its price. */
export interface FundCost {
  readonly instrument: Instrument
  readonly ter: FundTer
  readonly cost: Money
}

/** What a calendar year cost, in euros. */
export interface YearCosts {
  readonly year: number
  /** Already inside the cost of each buy and the proceeds of each sale. */
  readonly trading: Money
  /** Already inside the amounts exchanged. */
  readonly exchange: Money
  /** Account fees less their refunds. */
  readonly account: Money
  /** Each instrument with a TER that had a value at one of the year's month ends, in the file's order. */
  readonly funds: readonly FundCost[]
  /** How many of the year's exchanges have fees the ECB series has no rate for yet, so the exchange fees leave them out. */
  readonly unratedExchanges: number
  /** Each instrument with a TER held at a passed month end it had no close for, so its cost leaves that month out. */
  readonly unpricedFunds: readonly Instrument[]
  readonly fundCosts: Money
  readonly total: Money
  /** The portfolio's value averaged over the year's month ends up to the day. */
  readonly averageValue: Money
  /** The total over the average value, null when the average is zero. */
  readonly share: Share | null
}

/** What the twelve months up to the day cost, against the portfolio's average value at their month ends. */
export interface RecentCosts {
  readonly total: Money
  /** Of all twelve month ends, as `yearlyCosts` averages a year's, a month end before the first deposit counting zero. */
  readonly averageValue: Money
}

/**
 * The costs of each year from the first deposit's to the day's, newest first. A fund's cost is its TER of the average
 * of the year's 12 month-end values, a month end it had no value at and one still to come counting zero, so the day's
 * year shows the cost so far.
 */
export function yearlyCosts(sources: PortfolioSources, valuedOn: DayValuer, facts: FactsBook): YearCosts[] {
  const { today } = sources
  const firstDeposit = firstDepositIn(sources.book)
  if (firstDeposit === null || firstDeposit > today) {
    return []
  }
  return yearsSince(firstDeposit, today)
    .reverse()
    .map((year): YearCosts => {
      const monthEnds = monthsFrom(monthKey(year, 1), monthKey(year, 12))
        .map(lastDayOf)
        .filter((date) => date <= today)
        .map(valuedOn)
      const costs = costsOver(sources, facts, (date) => date <= today && yearOf(date) === year, monthEnds)
      const averageValue = averageValueOf(monthEnds)
      return { year, ...costs, averageValue, share: ratioOf(costs.total, averageValue) }
    })
}

/** The costs of the twelve months up to the day over the average value at their month ends, as `yearlyCosts` works out a year's. */
export function recentCosts(sources: PortfolioSources, valuedOn: DayValuer, facts: FactsBook): RecentCosts {
  const { today } = sources
  const from = dayMonthsLater(today, -12)
  const inWindow = (date: CivilDate): boolean => date > from && date <= today
  const monthEnds = monthsFrom(monthOf(from), monthOf(today)).map(lastDayOf).filter(inWindow).map(valuedOn)
  return { total: costsOver(sources, facts, inWindow, monthEnds).total, averageValue: averageValueOf(monthEnds) }
}

type PeriodCosts = Omit<YearCosts, 'year' | 'averageValue' | 'share'>

/** The fees of the records on the days `inPeriod` takes, and each fund's TER, typed or fetched, of the month-end values given over 12. */
function costsOver(sources: PortfolioSources, facts: FactsBook, inPeriod: (date: CivilDate) => boolean, monthEnds: readonly PortfolioFigures[]): PeriodCosts {
  const { book, rates } = sources
  const trading = sumMoney(book.trades.filter((trade) => inPeriod(trade.date)).map(tradeFeesInEuros))
  const exchangeFees = exchangeFeesInEuros(
    book.exchanges.filter((record) => inPeriod(record.date)),
    rates,
  )
  const exchange = sumMoney(exchangeFees.map((fee) => fee.euros ?? ZERO))
  const account = accountFeesInEuros(book.cashMovements.filter((movement) => inPeriod(movement.date)))
  const charged = book.instruments.flatMap((instrument) => {
    const ter = fundTerOf(instrument, facts)
    return ter === null ? [] : [{ instrument, ter }]
  })
  const funds = charged.flatMap(({ instrument, ter }): FundCost[] => {
    const held = sumMoney(monthEnds.map((figures) => figures.holdings.find((holding) => holding.instrument.id === instrument.id)?.valuation?.value ?? ZERO))
    return held === ZERO ? [] : [{ instrument, ter, cost: fundCost(ter.percent, held) }]
  })
  const unpricedFunds = charged.filter(({ instrument }) => monthEnds.some((figures) => figures.unpriced.some((unpriced) => unpriced.id === instrument.id))).map(({ instrument }) => instrument)
  const fundCosts = sumMoney(funds.map((fund) => fund.cost))
  return {
    trading,
    exchange,
    account,
    funds,
    unratedExchanges: exchangeFees.filter((fee) => fee.euros === null).length,
    unpricedFunds,
    fundCosts,
    total: sumMoney([trading, exchange, account, fundCosts]),
  }
}

/** The value averaged over every month end given. One before the first deposit counts, with its value of zero. */
function averageValueOf(monthEnds: readonly PortfolioFigures[]): Money {
  return monthEnds.length === 0 ? ZERO : divideMoney(sumMoney(monthEnds.map((figures) => figures.value)), monthEnds.length)
}

/** The TER in percent of a twelfth of the month-end values added up, to the cent. */
function fundCost(ter: Decimal, monthEndValues: Money): Money {
  return inEuros(scaledDecimal(timesDecimal(ter, decimalOfMoney(monthEndValues)), 1n, 1200n), null)
}
