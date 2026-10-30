import type { ClosedSale, InstrumentLots, Lot } from './lots'
import { closePerUnit, heldWorth, priceOfWorth } from './quoting'
import { closeIsLate } from '../../prices/domain/priceBook'
import type { Close, PriceBook } from '../../prices/domain/priceBook'
import type { RateBook } from '../../prices/domain/rateBook'
import type { Income } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { EURO } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, inEuros, scaledDecimal, subtractDecimal, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, ratioOf, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the figures are worked out from. */
export interface PortfolioSources {
  readonly book: InvestmentBook
  readonly prices: PriceBook
  readonly rates: RateBook
  /** The day the figures are for. */
  readonly today: CivilDate
}

/** Units valued at the latest close on or before a day, at the ECB rate of the close's own day. */
export interface Valuation {
  readonly close: Close
  /** The close as a price per unit held today: after every split since its day, and per gram for gold. */
  readonly price: Decimal
  /** Units of the quote currency per euro, null for an instrument quoted in euros. */
  readonly rate: Decimal | null
  /** In the quote currency, with a bond's interest accrued to the day valued rather than to the close's day. */
  readonly foreignValue: Decimal
  readonly value: Money
}

/** A value at two dates. */
export interface DayChange {
  readonly earlier: Money
  readonly later: Money
  readonly change: Money
  /** The change over the earlier value, null when that is zero. */
  readonly share: number | null
}

/** The two dates "Last day" compares: the newest close among held instruments and the latest earlier day any of them closed. */
export interface LastDayDates {
  readonly from: CivilDate
  readonly to: CivilDate
}

/** What one instrument is worth, cost and earned. The money figures are in euros. */
export interface HoldingFigures {
  readonly instrument: Instrument
  readonly quantity: Decimal
  readonly units: ReadonlyMap<RecordId, Decimal>
  readonly lots: readonly Lot[]
  readonly sales: readonly ClosedSale[]
  readonly refused: readonly (Trade | Transfer)[]
  /** Null when nothing is held, or for a holding with no close or no rate, which the value leaves out. */
  readonly valuation: Valuation | null
  readonly late: boolean
  readonly cost: Money
  readonly costInCurrency: Decimal
  /** The cost of the open lots in the quote currency as a price, per unit, per gram or in percent of a bond's nominal. */
  readonly averageCost: Decimal | null
  readonly unrealised: Money | null
  /** The part of the unrealised gain from the price, at today's rate. */
  readonly pricePart: Money | null
  /** The rest of the unrealised gain, from the rate. */
  readonly currencyPart: Money | null
  readonly realised: Money
  /** Received after the tax withheld, without the part of a coupon that paid back accrued interest. */
  readonly income: Money
  /** Its value over the portfolio's. */
  readonly weight: number | null
  readonly lastDay: DayChange | null
  /** The income of the last twelve months over the value. */
  readonly dividendYield: number | null
  /** The fees of its trades, already inside its cost and proceeds. */
  readonly feesPaid: Money
  /** A trade without its fees entered, so the gain may be too high. */
  readonly feesMissing: boolean
  /** The first buy, or the spin-off its first units came from. */
  readonly firstBought: CivilDate | null
}

export function dayChange(earlier: Money, later: Money): DayChange {
  const change = subtractMoney(later, earlier)
  return { earlier, later, change, share: ratioOf(change, earlier) }
}

/** The quantity valued at the latest close on or before the day. Null when there is no close yet, or no rate for its day. */
export function valuationOn(instrument: Instrument, quantity: Decimal, sources: PortfolioSources, day: CivilDate): Valuation | null {
  const close = sources.prices.closeOnOrBefore(instrument, day)
  if (close === null) {
    return null
  }
  const rate = instrument.currency === EURO ? null : sources.rates.unitsPerEuroOnOrBefore(instrument.currency, close.date)
  if (instrument.currency !== EURO && rate === null) {
    return null
  }
  const later = sources.book.splits.filter((split) => split.instrument === instrument.id && split.date > close.date)
  const price = closePerUnit(
    instrument.quoted,
    scaledDecimal(
      close.price,
      later.reduce((product, split) => product * BigInt(split.oldUnits), 1n),
      later.reduce((product, split) => product * BigInt(split.newUnits), 1n),
    ),
  )
  const foreignValue = heldWorth(instrument.quoted, quantity, price, day)
  return { close, price, rate, foreignValue, value: inEuros(foreignValue, rate) }
}

/** One instrument's figures, apart from its weight and its last day, which depend on the rest of the portfolio. */
export function holdingFigures(instrument: Instrument, lots: InstrumentLots, sources: PortfolioSources): Omit<HoldingFigures, 'weight' | 'lastDay'> {
  const { book, today } = sources
  const quantity = sumDecimal(lots.open.map((lot) => lot.quantity))
  const cost = sumMoney(lots.open.map((lot) => lot.cost))
  const costInCurrency = sumDecimal(lots.open.map((lot) => lot.costInCurrency))
  const held = quantity > DECIMAL_ZERO
  const valuation = held ? valuationOn(instrument, quantity, sources, today) : null
  const unrealised = valuation === null ? null : subtractMoney(valuation.value, cost)
  const pricePart = valuation === null ? null : valuation.rate === null ? unrealised : inEuros(subtractDecimal(valuation.foreignValue, costInCurrency), valuation.rate)

  const trades = book.trades.filter((trade) => trade.instrument === instrument.id)
  const income = book.income.filter((payment) => payment.instrument === instrument.id)
  const yearBefore = dayMonthsLater(today, -12)
  const received = (payments: readonly Income[]): Money =>
    sumMoney(payments.map((payment) => subtractMoney(inEuros(subtractDecimal(payment.gross, payment.withheld), payment.rate), lots.paidBack.get(payment.id) ?? ZERO)))
  const lastYearsIncome = received(income.filter((payment) => payment.date > yearBefore && payment.date <= today))
  const acquired = [
    ...trades.filter((trade) => trade.side === 'buy').map((trade) => trade.date),
    ...book.spinOffs.filter((spinOff) => spinOff.received === instrument.id).map((spinOff) => spinOff.date),
  ].sort()

  return {
    instrument,
    quantity,
    units: lots.units,
    lots: lots.open,
    sales: lots.sales,
    refused: lots.refused,
    valuation,
    late: valuation !== null && closeIsLate(valuation.close, today),
    cost,
    costInCurrency,
    averageCost: held ? priceOfWorth(instrument.quoted, costInCurrency, quantity) : null,
    unrealised,
    pricePart,
    currencyPart: unrealised === null || pricePart === null ? null : subtractMoney(unrealised, pricePart),
    realised: sumMoney(lots.sales.flatMap((sale) => sale.lines.map((line) => line.gain))),
    income: received(income),
    dividendYield: valuation === null || valuation.value <= 0 ? null : ratioOf(lastYearsIncome, valuation.value),
    feesPaid: sumMoney(trades.map((trade) => inEuros(trade.fees ?? DECIMAL_ZERO, trade.rate))),
    feesMissing: trades.some((trade) => trade.fees === null),
    firstBought: acquired[0] ?? null,
  }
}

/** The quantity's change in value between the last day's dates. Null when either date has no close or no rate. */
export function lastDayOf(instrument: Instrument, quantity: Decimal, sources: PortfolioSources, dates: LastDayDates): DayChange | null {
  const earlier = valuationOn(instrument, quantity, sources, dates.from)
  const later = valuationOn(instrument, quantity, sources, dates.to)
  return earlier === null || later === null ? null : dayChange(earlier.value, later.value)
}
