import { accountFeesInEuros, exchangeFeesInEuros, tradeFeesInEuros } from '../../holdings/domain/fees'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { yearsSince } from '../../performance/domain/performancePeriod'
import { firstDepositIn } from '../../performance/domain/portfolioPerformance'
import type { DayValuer } from '../../performance/domain/portfolioPerformance'
import type { Instrument } from '../../workbook/domain/instrument'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthKey, monthsFrom } from '../../../../shared/calendar/monthKey'
import { decimalOfMoney, inEuros, scaledDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, divideMoney, ratioOf, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** A fund's estimated cost over a year, already taken inside its price. */
export interface FundCost {
  readonly instrument: Instrument
  /** In percent a year, as typed on the instrument. */
  readonly ter: Decimal
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
  readonly share: number | null
}

/**
 * The costs of each year from the first deposit's to the day's, newest first. A fund's cost is its TER of the average
 * of the year's 12 month-end values, a month end it had no value at and one still to come counting zero, so the day's
 * year shows the cost so far.
 */
export function yearlyCosts(sources: PortfolioSources, valuedOn: DayValuer): YearCosts[] {
  const { book, rates, today } = sources
  const firstDeposit = firstDepositIn(book)
  if (firstDeposit === null || firstDeposit > today) {
    return []
  }
  return yearsSince(firstDeposit, today)
    .reverse()
    .map((year): YearCosts => {
      const inYear = (date: CivilDate): boolean => date <= today && yearOf(date) === year
      const trading = sumMoney(book.trades.filter((trade) => inYear(trade.date)).map(tradeFeesInEuros))
      const exchangeFees = exchangeFeesInEuros(
        book.exchanges.filter((record) => inYear(record.date)),
        rates,
      )
      const exchange = sumMoney(exchangeFees.map((fee) => fee.euros ?? ZERO))
      const account = accountFeesInEuros(book.cashMovements.filter((movement) => inYear(movement.date)))
      const monthEnds = monthsFrom(monthKey(year, 1), monthKey(year, 12))
        .map(lastDayOf)
        .filter((date) => date <= today)
        .map(valuedOn)
      const funds = book.instruments.flatMap((instrument): FundCost[] => {
        const held = sumMoney(monthEnds.map((figures) => figures.holdings.find((holding) => holding.instrument.id === instrument.id)?.valuation?.value ?? ZERO))
        return instrument.ter === null || held === ZERO ? [] : [{ instrument, ter: instrument.ter, cost: fundCost(instrument.ter, held) }]
      })
      const unpricedFunds = book.instruments.filter((instrument) => instrument.ter !== null && monthEnds.some((figures) => figures.unpriced.some((unpriced) => unpriced.id === instrument.id)))
      const fundCosts = sumMoney(funds.map((fund) => fund.cost))
      const total = sumMoney([trading, exchange, account, fundCosts])
      const averageValue = monthEnds.length === 0 ? ZERO : divideMoney(sumMoney(monthEnds.map((figures) => figures.value)), monthEnds.length)
      return {
        year,
        trading,
        exchange,
        account,
        funds,
        unratedExchanges: exchangeFees.filter((fee) => fee.euros === null).length,
        unpricedFunds,
        fundCosts,
        total,
        averageValue,
        share: ratioOf(total, averageValue),
      }
    })
}

/** The TER in percent of a twelfth of the month-end values added up, to the cent. */
function fundCost(ter: Decimal, monthEndValues: Money): Money {
  return inEuros(scaledDecimal(timesDecimal(ter, decimalOfMoney(monthEndValues)), 1n, 1200n), null)
}
