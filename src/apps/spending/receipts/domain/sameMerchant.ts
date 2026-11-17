import { metresBetween } from './photoPlace'
import { payeeKey, samePayee } from '../../payees/domain/payeeKey'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'

/** What tells one merchant from another on a receipt. */
export type MerchantNames = Pick<Receipt, 'merchant' | 'merchantOib'>

/** Whether two receipts are from one merchant: the same OIB when both have one, else the same payee by name. A blank name names no merchant. */
export function sameMerchant(held: MerchantNames, read: MerchantNames): boolean {
  if (held.merchantOib !== '' && read.merchantOib !== '') return held.merchantOib === read.merchantOib
  return payeeKey(held.merchant) !== '' && payeeKey(read.merchant) !== '' && samePayee(held.merchant, read.merchant)
}

/** Receipts on file this close to where a receipt was taken were most likely taken at the same shop. */
const SAME_PLACE_METRES = 100

/**
 * How the bank names a receipt's merchant: the payees, folded, of the rows a bank brought that earlier receipts of the same
 * merchant went on, and the one payee of such rows under receipts taken within 100 m, when they all agree. The description
 * is never read, since banks share one text across card payments. The merchant's own name is left out, as its words count anyway.
 * The book is read once, so a loop over its receipts asks each one's names without going over the rows again.
 */
export function bankNamesIn(book: Pick<SpendingBook, 'receipts' | 'transactions'>): (receipt: MerchantNames & Pick<Receipt, 'latitude' | 'longitude'>) => ReadonlySet<string> {
  const rows = new Map(book.transactions.map((row) => [row.id, row]))
  const placed = book.receipts.flatMap((held) => {
    const row = held.transaction === null ? undefined : rows.get(held.transaction)
    return row === undefined || row.importKey === '' || payeeKey(row.payee) === '' ? [] : [{ held, bankPayee: payeeKey(row.payee) }]
  })
  return (receipt) => {
    const named = placed.filter(({ held }) => sameMerchant(held, receipt)).map(({ bankPayee }) => bankPayee)
    const nearby = new Set(
      placed
        .filter(({ held }) => {
          const metres = metresBetween(held, receipt)
          return metres !== null && metres <= SAME_PLACE_METRES
        })
        .map(({ bankPayee }) => bankPayee),
    )
    const own = payeeKey(receipt.merchant)
    return new Set([...named, ...(nearby.size === 1 ? nearby : [])].filter((payee) => payee !== own))
  }
}
