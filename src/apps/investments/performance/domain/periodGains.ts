import { recordsOn } from './portfolioPerformance'
import type { DayValuer, PeriodPerformance } from './portfolioPerformance'
import { exchangeFeesInEuros, tradeFeesInEuros } from '../../holdings/domain/fees'
import type { HoldingFigures, PortfolioSources } from '../../holdings/domain/holding'
import { portfolioFigures } from '../../holdings/domain/portfolioFigures'
import type { IncomeTotals, PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { CASH_MOVEMENT_RECORDS, TRADE_RECORDS, TRANSFER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, inEuros, magnitude } from '../../../../shared/money/decimal'
import { ZERO, addMoney, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

/** What one holding gained over the period, in euros. */
export interface HoldingGains {
  readonly instrument: Instrument
  /** The change of what is held at the end in its quote currency, at the end's rate. */
  readonly price: Money
  /** The rest of the change in euros of what is held at the end. */
  readonly currency: Money
  readonly realised: Money
  /** Received after the tax withheld. */
  readonly income: Money
  readonly total: Money
}

/**
 * How the value went from the period's start to its end: Start + put in − taken out + price + currency + realised +
 * income − withheld + fees = End, to the cent. Every amount is signed as it moves the value, apart from taken out.
 */
export interface PeriodGains {
  readonly from: CivilDate
  readonly to: CivilDate
  readonly start: Money
  readonly putIn: Money
  readonly takenOut: Money
  readonly end: Money
  /** The holdings' price parts. */
  readonly price: Money
  /** The holdings' currency parts and the currency on cash. */
  readonly currency: Money
  readonly realised: Money
  readonly income: IncomeTotals
  /** Account fees less refunds, and exchange fees, below zero. */
  readonly fees: Money
  /** Every instrument with a part in the period, in the file's order. */
  readonly holdings: readonly HoldingGains[]
  /** What cash gained or lost on the rates, without the exchange fees, which are in `fees`. */
  readonly currencyOnCash: Money
  /** Interest and other income that names no instrument, after the tax withheld. */
  readonly incomeOnCash: Money
  /** The fees of the period's trades, already inside price and realised. */
  readonly tradingFees: Money
}

/**
 * The period's gain split by where it came from. Units held at the start count from their value at the start's close
 * and rate, as if bought then, and units bought inside the period from their cost. The records are rebased to do that:
 * each holding at the start becomes a buy of its value on the first day out of a deposit of the same, each cash
 * balance a deposit of its value, and the period's own records follow. The figures of that book on the last day then
 * hold only what happened in the period. Over a period that starts with nothing in, the book is the records as they are.
 */
export function periodGains(sources: PortfolioSources, span: Pick<PeriodPerformance, 'from' | 'to' | 'opensEmpty'>, valuedOn: DayValuer): PeriodGains {
  const { from, to } = span
  const period = periodBook(sources, span, valuedOn)
  const figures = portfolioFigures({ ...sources, book: period.book, today: to })
  const exchangeFees = sumMoney(exchangeFeesInEuros(period.records.exchanges, sources.rates).map((fee) => fee.euros ?? ZERO))
  const flows = period.records.cashMovements.map((movement) => ({ kind: movement.kind, euros: inEuros(movement.amount, movement.rate) }))
  const holdings = figures.holdings.map(holdingGains).filter((holding) => [holding.price, holding.currency, holding.realised, holding.income].some((part) => part !== ZERO))
  const currencyOnCash = addMoney(figures.currencyOnCash, exchangeFees)
  return {
    from,
    to,
    start: period.start,
    putIn: sumMoney(flows.filter((flow) => flow.kind === 'deposit').map((flow) => flow.euros)),
    takenOut: sumMoney(flows.filter((flow) => flow.kind === 'withdrawal').map((flow) => flow.euros)),
    end: figures.value,
    price: sumMoney(holdings.map((holding) => holding.price)),
    currency: addMoney(sumMoney(holdings.map((holding) => holding.currency)), currencyOnCash),
    realised: figures.realised,
    income: figures.income,
    fees: negateMoney(addMoney(figures.accountFees, exchangeFees)),
    holdings,
    currencyOnCash,
    incomeOnCash: subtractMoney(figures.income.received, sumMoney(holdings.map((holding) => holding.income))),
    tradingFees: sumMoney(period.records.trades.map(tradeFeesInEuros)),
  }
}

/** The bridge's steps between Start and End, in the order it draws them. */
export const GAIN_STEPS = ['put-in', 'taken-out', 'price', 'currency', 'realised', 'income', 'withheld', 'fees'] as const

export type GainStep = (typeof GAIN_STEPS)[number]

export interface GainStepAmount {
  readonly step: GainStep
  /** Signed as it moves the value, so what was taken out, the tax withheld and the fees are below zero. */
  readonly amount: Money
}

/** Start plus every step is End. */
export function gainSteps(gains: PeriodGains): GainStepAmount[] {
  const amounts: Readonly<Record<GainStep, Money>> = {
    'put-in': gains.putIn,
    'taken-out': negateMoney(gains.takenOut),
    price: gains.price,
    currency: gains.currency,
    realised: gains.realised,
    income: gains.income.gross,
    withheld: negateMoney(gains.income.withheld),
    fees: gains.fees,
  }
  return GAIN_STEPS.map((step) => ({ step, amount: amounts[step] }))
}

interface PeriodBook {
  /** The value the rebased records start from. */
  readonly start: Money
  /** The period's own records, without the rebased start. */
  readonly records: InvestmentBook
  readonly book: InvestmentBook
}

function periodBook(sources: PortfolioSources, span: Pick<PeriodPerformance, 'from' | 'to' | 'opensEmpty'>, valuedOn: DayValuer): PeriodBook {
  const { from, to, opensEmpty } = span
  const upToEnd = recordsOn(sources.book, to)
  if (opensEmpty) {
    return { start: ZERO, records: upToEnd, book: upToEnd }
  }
  const after = <Dated extends { readonly date: CivilDate }>(records: readonly Dated[]): Dated[] => records.filter((record) => record.date > from)
  const records: InvestmentBook = {
    ...upToEnd,
    trades: after(upToEnd.trades),
    income: after(upToEnd.income),
    cashMovements: after(upToEnd.cashMovements),
    exchanges: after(upToEnd.exchanges),
    transfers: after(upToEnd.transfers),
    spinOffs: after(upToEnd.spinOffs),
    splits: after(upToEnd.splits),
  }
  const opening = startRecords(valuedOn(from), from, sources)
  return {
    start: sumMoney(opening.cashMovements.map((movement) => (movement.kind === 'deposit' ? inEuros(movement.amount, movement.rate) : negateMoney(inEuros(movement.amount, movement.rate))))),
    records,
    book: {
      ...records,
      trades: [...opening.trades, ...records.trades],
      cashMovements: [...opening.cashMovements, ...records.cashMovements],
      transfers: [...opening.transfers, ...records.transfers],
      // A close from before the start is priced in today's units through the splits since its day.
      splits: [...upToEnd.splits.filter((split) => split.date < from), ...records.splits],
    },
  }
}

interface StartRecords {
  readonly trades: readonly Trade[]
  readonly cashMovements: readonly CashMovement[]
  readonly transfers: readonly Transfer[]
}

/**
 * The start's holdings and cash as records of its day. A holding is one buy of every unit in its first account at a
 * price of nothing with its value as the fees, so its cost is the value to the cent in both currencies, paid out of a
 * deposit of the same amount at the same rate. Its units in other accounts move there by transfer.
 */
function startRecords(start: PortfolioFigures, day: CivilDate, sources: PortfolioSources): StartRecords {
  const trades: Trade[] = []
  const cashMovements: CashMovement[] = []
  const transfers: Transfer[] = []
  for (const holding of start.holdings) {
    const held = [...holding.units].filter(([, units]) => units > DECIMAL_ZERO)
    const first = held[0]
    if (holding.valuation === null || first === undefined) {
      continue
    }
    const { id, currency } = holding.instrument
    const [account] = first
    const { foreignValue, rate } = holding.valuation
    trades.push({
      id: recordIdOf(TRADE_RECORDS, `start-${id}`),
      account,
      instrument: id,
      side: 'buy',
      date: day,
      quantity: holding.quantity,
      price: DECIMAL_ZERO,
      fees: foreignValue,
      rate,
      accrued: null,
      importKey: null,
      note: '',
    })
    cashMovements.push({ id: recordIdOf(CASH_MOVEMENT_RECORDS, `start-${id}`), account, kind: 'deposit', date: day, currency, amount: foreignValue, rate, importKey: null, note: '' })
    held.slice(1).forEach(([to, quantity]) => {
      transfers.push({ id: recordIdOf(TRANSFER_RECORDS, `start-${id}-${to}`), from: account, to, date: day, moved: { kind: 'units', instrument: id, quantity }, importKey: null, note: '' })
    })
  }
  for (const balance of start.cash) {
    if (balance.balance === DECIMAL_ZERO) {
      continue
    }
    cashMovements.push({
      id: recordIdOf(CASH_MOVEMENT_RECORDS, `start-${balance.account}-${balance.currency}`),
      account: balance.account,
      kind: balance.balance > DECIMAL_ZERO ? 'deposit' : 'withdrawal',
      date: day,
      currency: balance.currency,
      amount: magnitude(balance.balance),
      rate: balance.currency === EURO ? null : sources.rates.unitsPerEuroOnOrBefore(balance.currency, day),
      importKey: null,
      note: '',
    })
  }
  return { trades, cashMovements, transfers }
}

function holdingGains(holding: HoldingFigures): HoldingGains {
  const price = holding.pricePart ?? ZERO
  const currency = holding.currencyPart ?? ZERO
  return { instrument: holding.instrument, price, currency, realised: holding.realised, income: holding.income, total: sumMoney([price, currency, holding.realised, holding.income]) }
}
