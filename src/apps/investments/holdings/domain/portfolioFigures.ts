import { accountCash } from './accountCash'
import type { CashBalance } from './accountCash'
import { dayChange, holdingFigures, lastDayOf } from './holding'
import type { DayChange, HoldingFigures, LastDayDates, PortfolioSources } from './holding'
import { investmentLots } from './lots'
import type { InstrumentLots } from './lots'
import { eurosAtEcbRate } from '../../prices/domain/rateBook'
import type { Instrument } from '../../workbook/domain/instrument'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO, inEuros, subtractDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, negateMoney, ratioOf, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { daysOver365, solvedRate } from '../../../../shared/money/rateSolver'
import type { DatedFlow } from '../../../../shared/money/rateSolver'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An account's cash in one currency, valued in euros. */
export interface CashFigures extends CashBalance {
  /** At the ECB rate on or before the day. Null for a foreign balance the series has no rate for yet. */
  readonly value: Money | null
  /** The value less what the balance came in at. */
  readonly currencyGain: Money | null
  readonly lastDay: DayChange | null
}

export interface IncomeTotals {
  readonly gross: Money
  readonly withheld: Money
  /** Each payment's gross less its tax withheld, converted as one amount, so it can differ by a cent from gross less withheld. */
  readonly received: Money
}

/** The money-weighted return a year, once the first deposit is a year old. */
export type YearlyReturn = { readonly kind: 'rate'; readonly rate: number } | { readonly kind: 'under-a-year' } | { readonly kind: 'none' }

export interface LastDay extends LastDayDates, DayChange {}

/** The figures of the whole portfolio, in euros. */
export interface PortfolioFigures {
  /** Each holding's value and each cash balance's, without the holdings that have no price and the balances that have no rate. */
  readonly value: Money
  /** Held instruments with no close or no rate, left out of the value. */
  readonly unpriced: readonly Instrument[]
  /** Foreign cash balances with no ECB rate on or before the day, left out of the value. */
  readonly unratedCash: readonly CashFigures[]
  /** Deposits less withdrawals, each in euros at its own rate. */
  readonly putIn: Money
  readonly cost: Money
  readonly unrealised: Money
  readonly realised: Money
  readonly income: IncomeTotals
  /** Account fees less their refunds. */
  readonly accountFees: Money
  readonly currencyOnCash: Money
  /**
   * Value less what was put in. When every holding has a price and every balance a rate, it equals unrealised +
   * realised + income − account fees + currency on cash.
   */
  readonly totalGain: Money
  /** The total gain over what was put in, null when nothing more was put in than taken out. */
  readonly totalGainShare: number | null
  readonly yearlyReturn: YearlyReturn
  readonly lastDay: LastDay | null
  /** Trading and exchange fees, which are already inside costs, proceeds and amounts exchanged. */
  readonly feesPaid: Money
  readonly holdings: readonly HoldingFigures[]
  readonly cash: readonly CashFigures[]
  /** Records with a foreign amount the ECB series has no rate for yet, whose euros are left out. */
  readonly unrated: readonly RecordId[]
}

const NO_LOTS: InstrumentLots = { open: [], sales: [], refused: [], units: new Map() }

/** Every figure of the Overview, the Holdings screen and a holding's page, for `sources.today`. */
export function portfolioFigures(sources: PortfolioSources): PortfolioFigures {
  const { book, rates, today } = sources
  const lots = investmentLots(book)
  const refused = new Set([...lots.values()].flatMap((instrumentLots) => instrumentLots.refused.map((record) => record.id)))
  const cash = accountCash(book, rates, refused)

  const isHeld = (holding: { readonly quantity: Decimal }): boolean => holding.quantity > DECIMAL_ZERO
  const unweighted = book.instruments.map((instrument) => holdingFigures(instrument, lots.get(instrument.id) ?? NO_LOTS, sources))
  const dates = lastDayDates(
    unweighted.filter(isHeld).map((holding) => holding.instrument),
    sources,
  )
  const cashValueOn = (balance: CashBalance, day: CivilDate): Money | null => (balance.balance === DECIMAL_ZERO ? ZERO : eurosAtEcbRate(balance.balance, balance.currency, day, rates))
  const cashFigures = cash.balances.map((balance): CashFigures => {
    const balanceValue = cashValueOn(balance, today)
    const earlier = dates === null ? null : cashValueOn(balance, dates.from)
    const later = dates === null ? null : cashValueOn(balance, dates.to)
    return {
      ...balance,
      value: balanceValue,
      currencyGain: balanceValue === null ? null : subtractMoney(balanceValue, balance.eurosIn),
      lastDay: earlier === null || later === null ? null : dayChange(earlier, later),
    }
  })
  const value = sumMoney([...unweighted.map((holding) => holding.valuation?.value ?? ZERO), ...cashFigures.map((balance) => balance.value ?? ZERO)])
  const holdings = unweighted.map((holding): HoldingFigures => ({
    ...holding,
    weight: holding.valuation === null ? null : ratioOf(holding.valuation.value, value),
    lastDay: dates === null || !isHeld(holding) ? null : lastDayOf(holding.instrument, holding.quantity, sources, dates),
  }))

  const depositsAndWithdrawals = book.cashMovements.filter((movement) => movement.kind === 'deposit' || movement.kind === 'withdrawal')
  const flows = depositsAndWithdrawals.map((movement): DatedFlow => {
    const euros = inEuros(movement.amount, movement.rate)
    return { date: movement.date, amount: movement.kind === 'deposit' ? negateMoney(euros) : euros }
  })
  const firstDeposit =
    depositsAndWithdrawals
      .filter((movement) => movement.kind === 'deposit')
      .map((movement) => movement.date)
      .sort()[0] ?? null
  const putIn = negateMoney(sumMoney(flows.map((flow) => flow.amount)))
  const totalGain = subtractMoney(value, putIn)
  const fees = book.cashMovements.filter((movement) => movement.kind === 'fee' || movement.kind === 'fee-refund')
  const exchangeFees = book.exchanges.flatMap((exchange) => (exchange.fees === null ? [] : [{ exchange, euros: eurosAtEcbRate(exchange.fees.amount, exchange.fees.currency, exchange.date, rates) }]))
  const changes = [...holdings.map((holding) => holding.lastDay), ...cashFigures.map((balance) => balance.lastDay)].filter((change) => change !== null)

  return {
    value,
    unpriced: holdings.filter((holding) => isHeld(holding) && holding.valuation === null).map((holding) => holding.instrument),
    unratedCash: cashFigures.filter((balance) => balance.value === null),
    putIn,
    cost: sumMoney(holdings.map((holding) => holding.cost)),
    unrealised: sumMoney(holdings.map((holding) => holding.unrealised ?? ZERO)),
    realised: sumMoney(holdings.map((holding) => holding.realised)),
    income: {
      gross: sumMoney(book.income.map((payment) => inEuros(payment.gross, payment.rate))),
      withheld: sumMoney(book.income.map((payment) => inEuros(payment.withheld, payment.rate))),
      received: sumMoney(book.income.map((payment) => inEuros(subtractDecimal(payment.gross, payment.withheld), payment.rate))),
    },
    accountFees: sumMoney(fees.map((movement) => (movement.kind === 'fee' ? inEuros(movement.amount, movement.rate) : negateMoney(inEuros(movement.amount, movement.rate))))),
    currencyOnCash: sumMoney(cashFigures.map((balance) => balance.currencyGain ?? ZERO)),
    totalGain,
    totalGainShare: putIn > 0 ? ratioOf(totalGain, putIn) : null,
    yearlyReturn: yearlyReturn(firstDeposit, flows, value, today),
    lastDay: dates === null ? null : { ...dates, ...dayChange(sumMoney(changes.map((change) => change.earlier)), sumMoney(changes.map((change) => change.later))) },
    feesPaid: sumMoney([...holdings.map((holding) => holding.feesPaid), ...exchangeFees.map((fee) => fee.euros ?? ZERO)]),
    holdings,
    cash: cashFigures,
    unrated: [...cash.unrated, ...exchangeFees.filter((fee) => fee.euros === null && !cash.unrated.includes(fee.exchange.id)).map((fee) => fee.exchange.id)],
  }
}

/** The newest close among held instruments, and the latest earlier day on which any of them closed. */
function lastDayDates(held: readonly Instrument[], sources: PortfolioSources): LastDayDates | null {
  const newestOn = (day: CivilDate): CivilDate | null =>
    held
      .map((instrument) => sources.prices.closeOnOrBefore(instrument, day)?.date ?? null)
      .filter((date) => date !== null)
      .reduce<CivilDate | null>((newest, date) => (newest === null || date > newest ? date : newest), null)
  const to = newestOn(sources.today)
  const from = to === null ? null : newestOn(addDays(to, -1))
  return to === null || from === null ? null : { from, to }
}

/** XIRR with deposits negative and withdrawals and today's value positive, the investor's view. */
function yearlyReturn(firstDeposit: CivilDate | null, flows: readonly DatedFlow[], value: Money, today: CivilDate): YearlyReturn {
  if (firstDeposit === null) {
    return { kind: 'none' }
  }
  if (firstDeposit > dayMonthsLater(today, -12)) {
    return { kind: 'under-a-year' }
  }
  const rate = solvedRate([...flows, { date: today, amount: value }], daysOver365)
  return rate === null ? { kind: 'none' } : { kind: 'rate', rate }
}
