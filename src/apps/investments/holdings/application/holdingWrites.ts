import { accountIntakeRefusals } from './intakeRefusals'
import { words } from './words'
import { INVESTMENT_KINDS, bookOf, bookWith, dependentRefusals } from '../../workbook/application/investmentWriteGuards'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { HandPrice } from '../../workbook/domain/handPrice'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS, PRICE_RECORDS } from '../../workbook/domain/investmentKinds'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { FreshRecords, WriteRules } from '../../../../shared/storage/domain/writeRules'

/**
 * An account keeps the records that name it: trades, income, cash movements, exchanges, transfers and targets of the
 * account mix. A start day that gives the mail more days may not reach into a filed tax year or over records by hand.
 */
export const INVESTMENT_ACCOUNT_WRITES: WriteRules<InvestmentAccount> = {
  kind: INVESTMENT_ACCOUNT_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(INVESTMENT_ACCOUNT_RECORDS, read, records).readings.accounts,
  refusals: (change, fresh, after) => [...accountIntakeRefusals(change, fresh, after), ...dependentRefusals(['trades', 'income', 'cashMovements', 'exchanges', 'transfers', 'targets'], fresh, after)],
}

/** The instruments that records name. Every one of those records is read in its instrument's quote currency. */
function pricedInstruments(book: InvestmentBook): ReadonlySet<RecordId> {
  return new Set([
    ...book.trades.map((trade) => trade.instrument),
    ...book.income.flatMap((income) => (income.instrument === null ? [] : [income.instrument])),
    ...book.transfers.flatMap((transfer) => (transfer.moved.kind === 'units' ? [transfer.moved.instrument] : [])),
    ...book.splits.map((split) => split.instrument),
    ...book.spinOffs.flatMap((spinOff) => [spinOff.instrument, spinOff.received]),
    ...book.prices.map((price) => price.instrument),
  ])
}

/** Why the write would change the quote currency of an instrument that records name, which would read them all again in another currency. */
function quoteCurrencyRefusals(fresh: FreshRecords, after: FreshRecords): string[] {
  const { book } = bookOf(fresh)
  const named = pricedInstruments(book)
  const later = new Map(bookOf(after).book.instruments.map((instrument) => [instrument.id, instrument.currency]))
  return book.instruments
    .filter((instrument) => named.has(instrument.id) && later.has(instrument.id) && later.get(instrument.id) !== instrument.currency)
    .map((instrument) => words.quoteCurrencyKept(instrument.name, instrument.currency))
}

/** An instrument keeps the records that name it, its own mix among them, and the quote currency they are read in. */
export const INSTRUMENT_WRITES: WriteRules<Instrument> = {
  kind: INSTRUMENT_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(INSTRUMENT_RECORDS, read, records).readings.instruments,
  refusals: (_change, fresh, after) => [...quoteCurrencyRefusals(fresh, after), ...dependentRefusals(['trades', 'income', 'transfers', 'splits', 'spinOffs', 'prices', 'fundMixes'], fresh, after)],
}

export const HAND_PRICE_WRITES: WriteRules<HandPrice> = {
  kind: PRICE_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(PRICE_RECORDS, read, records).readings.prices,
  refusals: () => [],
}
