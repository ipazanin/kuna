import type { LinkedItemCounts, PublishedRowLink } from '../../shared/app/rowLinks'
import type { RateBook } from '../../shared/money/rateBook'
import { keyOfRecordId } from '../../shared/storage/domain/recordId'
import { countedRowOf } from './analytics/domain/countedRow'
import { rowSide } from './categories/domain/rowSide'
import type { RowPart } from './categories/domain/rowSide'
import { euroRows } from './rates/domain/euroRows'
import type { SpendingBook } from './workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS, ITEM_RECORDS, TRANSACTION_RECORDS } from './workbook/domain/spendingKinds'

/** How an item counts in Spending's figures as another app reads it: on its side, or as bought when it is under Bought assets. */
function countsOf(part: RowPart | undefined): LinkedItemCounts {
  if (part === undefined) return 'nowhere'
  return part.category?.kind === 'asset' ? 'bought' : part.side
}

/**
 * Every linked item of the book, by its row oldest first, with its euros at the rate of its row's day and how Spending counts it,
 * as Spending hands them to the shell and check:figures reads them.
 */
export function rowLinksOf(book: Pick<SpendingBook, 'accounts' | 'transactions' | 'items' | 'categories'>, rates: RateBook): readonly PublishedRowLink[] {
  const categories = new Map(book.categories.map((category) => [category.id, category]))
  return euroRows(book, rates).flatMap((row) => {
    const { transaction, account, items } = row
    const counted = countedRowOf(row)
    const parts = rowSide(counted, categories)
    return items.flatMap((item, place) => {
      if (item.link === null) return []
      const { app, kind, key, due } = item.link
      return [
        {
          row: keyOfRecordId(TRANSACTION_RECORDS, transaction.id),
          item: keyOfRecordId(ITEM_RECORDS, item.id),
          account: keyOfRecordId(ACCOUNT_RECORDS, transaction.account),
          day: transaction.date,
          amount: item.amount,
          currency: account.currency,
          euros: counted.parts[place]?.euros ?? null,
          counts: countsOf(parts[place]),
          target: { app, kind, key, due },
        },
      ]
    })
  })
}
