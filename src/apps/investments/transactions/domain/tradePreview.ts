import { accountCash } from '../../holdings/domain/accountCash'
import { investmentLots, taxSplitOf, tradeTotal } from '../../holdings/domain/lots'
import type { InstrumentLots, SaleTaxSplit } from '../../holdings/domain/lots'
import { priceOfWorth } from '../../holdings/domain/quoting'
import type { RateBook } from '../../prices/domain/rateBook'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { Trade } from '../../workbook/domain/trade'
import { isEstimate } from '../../tax/domain/hnbRate'
import { settlementDay } from '../../tax/domain/settlementDay'
import { FIRST_TAX_YEAR } from '../../tax/domain/taxRules'
import { capitalGainsYear } from '../../tax/domain/taxYear'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO, inEuros, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What a sale does to its year's capital gains tax. */
export interface SaleTax {
  /** The year the sale settles in, whose JOPPD it goes on. */
  readonly year: number
  /** The year's tax with the sale less the year's tax without it, so the year's losses count. */
  readonly onSale: Money
  readonly forYear: Money
  /** True while the settlement day's HNB rate is not out, as for a sale typed today. */
  readonly estimated: boolean
  /** True for a year whose city surtax comes on top of the tax. */
  readonly beforeSurtax: boolean
  /** The tax-free day of a lot it closes within five days of that day, or null. */
  readonly nearTaxFreeDay: CivilDate | null
}

/** What a buy or a sale typed into the dialog would do, against every other record of the file. */
export interface TradePreview {
  /** What it pays for a buy or receives for a sale, in the instrument's currency, fees included. */
  readonly total: Decimal
  readonly euros: Money
  /** True when the sale would sell more than its account holds on its day, which the write refuses. */
  readonly beyondHeld: boolean
  /** The account's units of the instrument once every record is in, this one too. */
  readonly unitsAfter: Decimal
  /** The account's cash in the instrument's currency once every record is in. */
  readonly cashAfter: Decimal
  /** The average cost of the open lots in the quote currency as the file stands, and with this trade, null when none are open. */
  readonly averageCostBefore: Decimal | null
  readonly averageCostAfter: Decimal | null
  /** For a sale, how many of its units come from lots past two years. */
  readonly taxSplit: SaleTaxSplit | null
  /** For a sale with an HNB rate, the tax it adds. */
  readonly tax: SaleTax | null
}

/** The tax a sale adds to its year, against the file without it. Null for a buy, a sale with no rate to convert it, and a year Kuna has no rules for. */
function saleTax(book: InvestmentBook, after: InvestmentBook, rates: RateBook, instrument: Instrument, trade: Trade): SaleTax | null {
  const year = yearOf(settlementDay(trade.date, instrument.currency))
  if (trade.side !== 'sell' || year < FIRST_TAX_YEAR) {
    return null
  }
  const withSale = capitalGainsYear(after, rates, year)
  const sale = withSale.sales.find((candidate) => candidate.trade.id === trade.id)
  if (sale === undefined || sale.rate.kind === 'missing') {
    return null
  }
  const without = capitalGainsYear({ ...book, trades: book.trades.filter((other) => other.id !== trade.id) }, rates, year)
  return {
    year,
    onSale: subtractMoney(withSale.tax, without.tax),
    forYear: withSale.tax,
    estimated: isEstimate(sale.rate),
    beforeSurtax: withSale.rules.rules.surtax,
    nearTaxFreeDay: sale.lines.find((line) => line.nearTaxFreeDay)?.taxFreeFrom ?? null,
  }
}

/** The trade in place of the record it changes, or added when it changes none. */
function bookWithTrade(book: InvestmentBook, trade: Trade): InvestmentBook {
  const known = book.trades.some((other) => other.id === trade.id)
  return { ...book, trades: known ? book.trades.map((other) => (other.id === trade.id ? trade : other)) : [...book.trades, trade] }
}

function averageCost(instrument: Instrument, lots: InstrumentLots | undefined): Decimal | null {
  const open = lots?.open ?? []
  const quantity = sumDecimal(open.map((lot) => lot.quantity))
  return quantity > DECIMAL_ZERO ? priceOfWorth(instrument.quoted, sumDecimal(open.map((lot) => lot.costInCurrency)), quantity) : null
}

export function tradePreview(book: InvestmentBook, rates: RateBook, instrument: Instrument, trade: Trade): TradePreview {
  const after = bookWithTrade(book, trade)
  const lotsAfter = investmentLots(after)
  const queue = lotsAfter.get(instrument.id)
  const refused = new Set([...lotsAfter.values()].flatMap((lots) => lots.refused.map((record) => record.id)))
  const balance = accountCash(after, rates, refused).balances.find((cash) => cash.account === trade.account && cash.currency === instrument.currency)
  const total = tradeTotal(trade, instrument.quoted)
  const sale = queue?.sales.find((closed) => closed.trade.id === trade.id) ?? null
  return {
    total,
    euros: inEuros(total, trade.rate),
    beyondHeld: refused.has(trade.id),
    unitsAfter: queue?.units.get(trade.account) ?? DECIMAL_ZERO,
    cashAfter: balance?.balance ?? DECIMAL_ZERO,
    averageCostBefore: averageCost(instrument, investmentLots(book).get(instrument.id)),
    averageCostAfter: averageCost(instrument, queue),
    taxSplit: sale === null ? null : taxSplitOf(sale),
    tax: sale === null ? null : saleTax(book, after, rates, instrument, trade),
  }
}
