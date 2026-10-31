import { latestRecords } from '../../holdings/domain/latestRecords'
import type { LatestRecord } from '../../holdings/domain/latestRecords'
import type { RateBook } from '../../prices/domain/rateBook'
import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Exchange } from '../../workbook/domain/exchange'
import type { HandPrice } from '../../workbook/domain/handPrice'
import type { Income } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Split } from '../../workbook/domain/split'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A record the transaction dialog adds, changes or deletes, by its kind. */
export type TransactionRecord =
  | { readonly kind: 'trade'; readonly record: Trade }
  | { readonly kind: 'income'; readonly record: Income }
  | { readonly kind: 'cash-movement'; readonly record: CashMovement }
  | { readonly kind: 'exchange'; readonly record: Exchange }
  | { readonly kind: 'transfer'; readonly record: Transfer }
  | { readonly kind: 'split'; readonly record: Split }
  | { readonly kind: 'spin-off'; readonly record: SpinOff }
  | { readonly kind: 'price'; readonly record: HandPrice }

export type TransactionKind = TransactionRecord['kind']

/** The kinds in the order the Transactions screen offers them as a filter. */
export const TRANSACTION_KINDS = ['trade', 'income', 'cash-movement', 'exchange', 'transfer', 'split', 'spin-off', 'price'] as const satisfies readonly TransactionKind[]

/** A record as the Transactions screen lists it: every kind the latest records have, and a price entered by hand with its instrument. */
export type ListedTransaction = LatestRecord | { readonly kind: 'price'; readonly record: HandPrice; readonly instrument: Instrument }

/** Every record of what happened and every hand price, newest first. Records of one day keep the order the latest records give them, with prices last. */
export function listedTransactions(book: InvestmentBook, rates: RateBook): ListedTransaction[] {
  const instrumentOf = new Map(book.instruments.map((instrument) => [instrument.id, instrument]))
  const prices = book.prices.flatMap((price): ListedTransaction[] => {
    const instrument = instrumentOf.get(price.instrument)
    return instrument === undefined ? [] : [{ kind: 'price', record: price, instrument }]
  })
  const records: ListedTransaction[] = latestRecords(book, rates)
  return [...records, ...prices.reverse()]
    .map((entry, place) => ({ entry, place }))
    .sort(newestFirst)
    .map(({ entry }) => entry)
}

function newestFirst(first: { readonly entry: ListedTransaction; readonly place: number }, second: { readonly entry: ListedTransaction; readonly place: number }): number {
  return second.entry.record.date.localeCompare(first.entry.record.date) || first.place - second.place
}

/** How many records the Transactions screen lists. */
export function transactionCount(book: InvestmentBook): number {
  return [book.trades, book.income, book.cashMovements, book.exchanges, book.transfers, book.splits, book.spinOffs, book.prices].reduce((count, records) => count + records.length, 0)
}

/** The accounts a record moves something in or out of. */
function accountsOf(entry: ListedTransaction): RecordId[] {
  switch (entry.kind) {
    case 'trade':
    case 'income':
    case 'cash-movement':
    case 'exchange':
      return [entry.record.account]
    case 'transfer':
      return [entry.record.from, entry.record.to]
    case 'split':
    case 'spin-off':
    case 'price':
      return []
  }
}

/** The instruments a record is about. A spin-off is about its parent and what it gave. */
function instrumentsOf(entry: ListedTransaction): RecordId[] {
  switch (entry.kind) {
    case 'trade':
    case 'split':
    case 'price':
      return [entry.record.instrument]
    case 'income':
      return entry.record.instrument === null ? [] : [entry.record.instrument]
    case 'transfer':
      return entry.record.moved.kind === 'units' ? [entry.record.moved.instrument] : []
    case 'spin-off':
      return [entry.record.instrument, entry.record.received]
    case 'cash-movement':
    case 'exchange':
      return []
  }
}

/** Which records to list: of one kind or all, naming one account or any, about one instrument or any. */
export interface TransactionFilter {
  readonly kind: TransactionKind | null
  readonly account: RecordId | null
  readonly instrument: RecordId | null
}

export function passesFilter(entry: ListedTransaction, filter: TransactionFilter): boolean {
  return (
    (filter.kind === null || entry.kind === filter.kind) &&
    (filter.account === null || accountsOf(entry).includes(filter.account)) &&
    (filter.instrument === null || instrumentsOf(entry).includes(filter.instrument))
  )
}
