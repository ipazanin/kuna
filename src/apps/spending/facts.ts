import type { PublishedRowLink } from '../../shared/app/rowLinks'
import { keyOfRecordId } from '../../shared/storage/domain/recordId'
import type { SpendingBook } from './workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS, TRANSACTION_RECORDS } from './workbook/domain/spendingKinds'

/** Every linked row of the book, oldest first, as Spending hands them to the shell and check:figures reads them. */
export function rowLinksOf(book: Pick<SpendingBook, 'accounts' | 'transactions'>): readonly PublishedRowLink[] {
  const currencies = new Map(book.accounts.map((account) => [account.id, account.currency]))
  return book.transactions.flatMap((row) => {
    const currency = currencies.get(row.account)
    if (row.link === null || currency === undefined) return []
    const { app, kind, key, due } = row.link
    return [
      {
        row: keyOfRecordId(TRANSACTION_RECORDS, row.id),
        account: keyOfRecordId(ACCOUNT_RECORDS, row.account),
        day: row.date,
        amount: row.amount,
        currency,
        target: { app, kind, key, due },
      },
    ]
  })
}
