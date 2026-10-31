import { seriesKey } from './pricesFile'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { PriceSource } from '../../workbook/domain/instrument'
import { EURO } from '../../../../shared/money/currencyCode'

/** A price source a vendor fetches closes for. */
type ListedSource = Exclude<PriceSource, 'manual'>

/** One listing Kuna keeps closes of, for every instrument that names it. */
export interface ListingDemand {
  readonly key: string
  readonly source: ListedSource
  readonly symbol: string
  readonly currency: string
  /** The earliest first transaction of its instruments, or the first deposit for one with none and for the benchmark, which Performance compares from it. */
  readonly start: string
}

/** What the prices file needs for the Investments records. */
export interface PriceDemand {
  readonly listings: readonly ListingDemand[]
  /** Every currency other than the euro the ECB keeps rates of for the file. */
  readonly currencies: readonly string[]
  /** The day the rates run from: the start of 2015, or the first record if that is earlier. */
  readonly ratesStart: string
}

/** ECB rates wanted beyond what the records name, such as those the rows of a workbook about to be imported need. */
export interface RatesWanted {
  readonly currencies: readonly string[]
  /** The earliest day a rate is wanted for. */
  readonly from: string
}

/** Rates the import may need whatever the records hold, so a first import finds them. */
const ALWAYS_RATED = ['USD', 'GBP', 'CHF']
const RATES_FROM = '2015-01-01'

function earliest(days: readonly string[]): string | null {
  return days.reduce<string | null>((found, day) => (found === null || day < found ? day : found), null)
}

/** Each listed instrument's source and symbol with its first transaction, the currencies the records name and those wanted, and the first deposit. */
export function priceDemand(book: InvestmentBook, today: string, wanted: RatesWanted | null = null): PriceDemand {
  const firstDeposit = earliest(book.cashMovements.filter((movement) => movement.kind === 'deposit').map((movement) => movement.date)) ?? today

  const listings = new Map<string, ListingDemand>()
  for (const instrument of book.instruments) {
    if (instrument.prices === 'manual' || instrument.sourceSymbol === '') {
      continue
    }
    const firstTransaction = earliest([
      ...book.trades.filter((trade) => trade.instrument === instrument.id).map((trade) => trade.date),
      ...book.spinOffs.filter((spinOff) => spinOff.received === instrument.id).map((spinOff) => spinOff.date),
    ])
    const key = seriesKey(instrument.prices, instrument.sourceSymbol)
    const start = firstTransaction === null || (instrument.benchmark && firstDeposit < firstTransaction) ? firstDeposit : firstTransaction
    const known = listings.get(key)
    listings.set(
      key,
      known === undefined ? { key, source: instrument.prices, symbol: instrument.sourceSymbol, currency: instrument.currency, start } : { ...known, start: start < known.start ? start : known.start },
    )
  }

  const named = [
    ...book.instruments.map((instrument) => instrument.currency),
    ...book.cashMovements.map((movement) => movement.currency),
    ...book.income.map((income) => income.currency),
    ...book.transfers.flatMap((transfer) => (transfer.moved.kind === 'cash' ? [transfer.moved.currency] : [])),
    ...book.exchanges.flatMap((exchange) => [exchange.soldCurrency, exchange.boughtCurrency, ...(exchange.fees === null ? [] : [exchange.fees.currency])]),
  ]
  const currencies = [...new Set([...ALWAYS_RATED, ...named, ...(wanted?.currencies ?? [])].filter((currency) => currency !== EURO))]
  const firstRecord = earliest([
    ...[book.trades, book.spinOffs, book.cashMovements, book.income, book.exchanges, book.transfers].flatMap((records: readonly { readonly date: string }[]) => records.map((record) => record.date)),
    ...(wanted === null ? [] : [wanted.from]),
  ])
  return { listings: [...listings.values()], currencies, ratesStart: firstRecord !== null && firstRecord < RATES_FROM ? firstRecord : RATES_FROM }
}
