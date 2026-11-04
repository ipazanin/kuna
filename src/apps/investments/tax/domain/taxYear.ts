import { dayRate, inEurosAt, isEstimate } from './hnbRate'
import type { DayRate } from './hnbRate'
import { settlementDay } from './settlementDay'
import { joppdDue, yearDueNext } from './taxDeadlines'
import { FIRST_TAX_YEAR, percentOf, rulesOf } from './taxRules'
import type { YearRules } from './taxRules'
import { investmentLots, taxFreeFrom } from '../../holdings/domain/lots'
import type { RealisedLine } from '../../holdings/domain/lots'
import type { RateBook } from '../../prices/domain/rateBook'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { Trade } from '../../workbook/domain/trade'
import { civilDate, daysBetween, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO, subtractDecimal, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** A sale this many days or fewer from a lot's tax-free day, either side, is warned, since settlement can move either end. */
const NEAR_TAX_FREE_DAYS = 5

export type LineStatus = 'taxable' | 'tax-free' | 'loss' | 'old-loss'

/** One lot a sale closed, as the tax sees it. */
export interface TaxLine {
  readonly realised: RealisedLine
  readonly taxFreeFrom: CivilDate
  /** Proceeds less fees less cost, in the quote currency. */
  readonly gainInCurrency: Decimal
  /** In euros at the sale's HNB rate, null while the sale has no rate. */
  readonly gain: Money | null
  /** A gain or a loss, on a lot under two years or past them. */
  readonly status: LineStatus
  readonly nearTaxFreeDay: boolean
}

export interface TaxSale {
  readonly instrument: Instrument
  readonly trade: Trade
  /** Estimated from the trade's day. */
  readonly settles: CivilDate
  /** HNB's rate of the settlement day. */
  readonly rate: DayRate
  readonly lines: readonly TaxLine[]
  readonly gainInCurrency: Decimal
  readonly gain: Money | null
  /** Traded in December and settled in January, which counts in the year it settles. */
  readonly settlesNextYear: boolean
}

/** A year's capital gains, with the figures its JOPPD asks for. Sales without a rate are listed and left out of every figure. */
export interface CapitalGainsYear {
  readonly year: number
  /** The sales settling in the year, by trade day, oldest first. */
  readonly sales: readonly TaxSale[]
  /** Gains on lots under two years, before losses: JOPPD field 11. */
  readonly taxableGains: Money
  /** Losses on lots under two years, as a positive amount. */
  readonly losses: Money
  /** The losses up to the gains, never more: field 13.1. */
  readonly lossesOffset: Money
  /** Gains less the losses offset: fields 13.3 and 13.5. */
  readonly base: Money
  /** The year's rate of the base: field 14.1. For a year with surtax, the city's surtax comes on top. */
  readonly tax: Money
  /** Gains on lots past two years: the code-02 line. */
  readonly taxFreeGains: Money
  /** Losses on lots past two years, as a positive amount, which lower nothing. */
  readonly oldLosses: Money
  /** True when a sale's settlement day has no rate out yet, so a figure may still move. */
  readonly estimated: boolean
  /** Sales with no HNB rate for their settlement day, left out of every figure. */
  readonly leftOut: number
  readonly rules: YearRules
  readonly due: CivilDate
  /** The JOPPD's report mark: the year's two digits and the day of the year of 31 December, 365 or 366. */
  readonly reportMark: string
}

function statusOf(taxFree: boolean, gain: Decimal): LineStatus {
  if (taxFree) {
    return gain < DECIMAL_ZERO ? 'old-loss' : 'tax-free'
  }
  return gain < DECIMAL_ZERO ? 'loss' : 'taxable'
}

/**
 * A sale's lots as the tax sees them. Each lot's gain is worked out in the quote currency and converted once at HNB's
 * rate of the sale's settlement day, never at the rate the record stores.
 */
function taxSaleOf(instrument: Instrument, trade: Trade, lines: readonly RealisedLine[], rates: RateBook): TaxSale {
  const settles = settlementDay(trade.date, instrument.currency)
  const rate = dayRate(rates, instrument.currency, settles)
  const taxLines = lines.map((realised): TaxLine => {
    const gainInCurrency = subtractDecimal(subtractDecimal(realised.proceedsInCurrency, realised.feesInCurrency), realised.costInCurrency)
    const lotTaxFreeFrom = taxFreeFrom(realised.opened)
    return {
      realised,
      taxFreeFrom: lotTaxFreeFrom,
      gainInCurrency,
      gain: inEurosAt(gainInCurrency, rate),
      status: statusOf(realised.taxFree, gainInCurrency),
      nearTaxFreeDay: Math.abs(daysBetween(trade.date, lotTaxFreeFrom)) <= NEAR_TAX_FREE_DAYS,
    }
  })
  const gains = taxLines.map((line) => line.gain)
  return {
    instrument,
    trade,
    settles,
    rate,
    lines: taxLines,
    gainInCurrency: sumDecimal(taxLines.map((line) => line.gainInCurrency)),
    gain: gains.every((gain) => gain !== null) ? sumMoney(gains) : null,
    settlesNextYear: yearOf(settles) > yearOf(trade.date),
  }
}

/** Every sale of the file with the lots it closed, oldest first, a sale on one day in the file's order. */
export function taxSales(book: InvestmentBook, rates: RateBook): TaxSale[] {
  const instruments = new Map(book.instruments.map((instrument) => [instrument.id, instrument]))
  const order = new Map(book.trades.map((trade, index) => [trade.id, index]))
  return [...investmentLots(book)]
    .flatMap(([id, lots]) => {
      const instrument = instruments.get(id)
      return instrument === undefined ? [] : lots.sales.map((sale) => taxSaleOf(instrument, sale.trade, sale.lines, rates))
    })
    .sort((first, second) => first.trade.date.localeCompare(second.trade.date) || order.get(first.trade.id)! - order.get(second.trade.id)!)
}

function sumOf(lines: readonly TaxLine[], status: LineStatus): Money {
  return sumMoney(lines.filter((line) => line.status === status).map((line) => line.gain ?? ZERO))
}

/** The JOPPD's report mark of a year's capital gains, dated 31 December: 26365 for 2026, 24366 for 2024. */
function reportMarkOf(year: number): string {
  const dayOfYear = daysBetween(civilDate(year, 1, 1), civilDate(year, 12, 31)) + 1
  return `${String(year % 100).padStart(2, '0')}${dayOfYear}`
}

/**
 * The capital gains of the sales settling in the year. A sale traded in late December that settles in January counts
 * in January's year, since a receipt counts when it is paid.
 */
export function capitalGainsYear(book: InvestmentBook, rates: RateBook, year: number): CapitalGainsYear {
  const sales = taxSales(book, rates).filter((sale) => yearOf(sale.settles) === year)
  const counted = sales.filter((sale) => sale.rate.kind !== 'missing').flatMap((sale) => sale.lines)
  const taxableGains = sumOf(counted, 'taxable')
  const losses = subtractMoney(ZERO, sumOf(counted, 'loss'))
  const lossesOffset = losses < taxableGains ? losses : taxableGains
  const base = subtractMoney(taxableGains, lossesOffset)
  const rules = rulesOf(year)
  return {
    year,
    sales,
    taxableGains,
    losses,
    lossesOffset,
    base,
    tax: percentOf(base, rules.rules.gainsRate),
    taxFreeGains: sumOf(counted, 'tax-free'),
    oldLosses: subtractMoney(ZERO, sumOf(counted, 'old-loss')),
    estimated: sales.some((sale) => isEstimate(sale.rate)),
    leftOut: sales.filter((sale) => sale.rate.kind === 'missing').length,
    rules,
    due: joppdDue(year),
    reportMark: reportMarkOf(year),
  }
}

/** The years a sale settles in or a payment is made in, newest first. */
function recordYears(book: InvestmentBook): number[] {
  const currencies = new Map(book.instruments.map((instrument) => [instrument.id, instrument.currency]))
  const sales = book.trades.flatMap((trade) => {
    const currency = currencies.get(trade.instrument)
    return trade.side === 'sell' && currency !== undefined ? [yearOf(settlementDay(trade.date, currency))] : []
  })
  const payments = book.income.filter((payment) => payment.kind !== 'coupon').map((payment) => yearOf(payment.date))
  return [...new Set([...sales, ...payments])].sort((first, second) => second - first)
}

/** The years from the first with rules that have a sale or a payment, and the year whose JOPPD is due next, newest first. */
export function taxYearsOf(book: InvestmentBook, today: CivilDate): number[] {
  return [...new Set([...recordYears(book), yearDueNext(today)])].filter((year) => year >= FIRST_TAX_YEAR).sort((first, second) => second - first)
}

/** The years with a sale or a payment before the first year Kuna has rules for, newest first. */
export function yearsWithoutRules(book: InvestmentBook): number[] {
  return recordYears(book).filter((year) => year < FIRST_TAX_YEAR)
}
