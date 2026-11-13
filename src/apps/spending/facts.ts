import type { PublishedRowLink } from '../../shared/app/rowLinks'
import { keyOfRecordId } from '../../shared/storage/domain/recordId'
import type { SpendingBook } from './workbook/domain/readSpendingBook'
import { rowItemsOf } from './workbook/domain/rowItems'
import { ACCOUNT_RECORDS, ITEM_RECORDS, TRANSACTION_RECORDS } from './workbook/domain/spendingKinds'

/** Every linked item of the book, by its row oldest first, as Spending hands them to the shell and check:figures reads them. */
export function rowLinksOf(book: Pick<SpendingBook, 'accounts' | 'transactions' | 'items'>): readonly PublishedRowLink[] {
  const currencies = new Map(book.accounts.map((account) => [account.id, account.currency]))
  const itemsOf = rowItemsOf(book)
  return book.transactions.flatMap((row) => {
    const currency = currencies.get(row.account)
    if (currency === undefined) return []
    return itemsOf(row).flatMap((item) => {
      if (item.link === null) return []
      const { app, kind, key, due } = item.link
      return [
        {
          row: keyOfRecordId(TRANSACTION_RECORDS, row.id),
          item: keyOfRecordId(ITEM_RECORDS, item.id),
          account: keyOfRecordId(ACCOUNT_RECORDS, row.account),
          day: row.date,
          amount: item.amount,
          currency,
          target: { app, kind, key, due },
        },
      ]
    })
  })
}
