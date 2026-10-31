import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * The records about one instrument, as a book of their own: its trades, its income, its splits, the transfers that
 * moved its units and the spin-offs it gave or came from. Accounts, instruments and prices stay whole.
 */
export function holdingRecords(book: InvestmentBook, instrument: RecordId): InvestmentBook {
  return {
    ...book,
    trades: book.trades.filter((trade) => trade.instrument === instrument),
    income: book.income.filter((payment) => payment.instrument === instrument),
    cashMovements: [],
    exchanges: [],
    transfers: book.transfers.filter((transfer) => transfer.moved.kind === 'units' && transfer.moved.instrument === instrument),
    splits: book.splits.filter((split) => split.instrument === instrument),
    spinOffs: book.spinOffs.filter((spinOff) => spinOff.instrument === instrument || spinOff.received === instrument),
  }
}
