import type { LeftOut } from './leftOut'
import { sourceHandover } from '../../accounts/domain/sourceHandover'
import type { SourceHandover } from '../../accounts/domain/sourceHandover'
import type { Account, SpendingPeriod } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'

/** Days of an account given to the statement file with an import: the account, its periods after, and what the old source's rows there do. */
export interface GivenDays {
  readonly account: Account
  readonly sources: readonly SpendingPeriod[]
  readonly handover: SourceHandover | null
}

/** The days the left-out rows of a statement file sit on, given to that file, or null when the rows came from another origin. */
export function givenDays(book: SpendingBook, leftOut: Extract<LeftOut, { readonly kind: 'not-taken' }>): GivenDays | null {
  const account = book.accounts.find((one) => one.id === leftOut.account)
  if (account === undefined || leftOut.offer === null) return null
  return { account, sources: leftOut.offer, handover: sourceHandover(book, account, leftOut.offer) }
}

/**
 * The book as the import reads it once the days are given: the accounts with their new periods, and without the rows, held
 * rows and receipts on rows the handover carries out. Those receipts wait for the file's rows from the next import on.
 */
export function bookWithGivenDays(book: SpendingBook, given: readonly GivenDays[]): SpendingBook {
  if (given.length === 0) return book
  const sources = new Map(given.map((one) => [one.account.id, one.sources]))
  const gone = new Set(given.flatMap((one) => one.handover?.rows ?? []))
  const goneIds = new Set([...gone].map((row) => row.id))
  const legs = new Set(given.flatMap((one) => one.handover?.loneLegs ?? []))
  const held = new Set(given.flatMap((one) => one.handover?.held ?? []))
  return {
    ...book,
    accounts: book.accounts.map((account) => {
      const after = sources.get(account.id)
      return after === undefined ? account : { ...account, sources: after }
    }),
    transactions: book.transactions.filter((row) => !gone.has(row)).map((row) => (legs.has(row) ? { ...row, pair: null } : row)),
    items: book.items.filter((item) => item.transaction === null || !goneIds.has(item.transaction)),
    receipts: book.receipts.filter((receipt) => receipt.transaction === null || !goneIds.has(receipt.transaction)),
    held: book.held.filter((one) => !held.has(one)),
    sourcesWorkedOut: book.sourcesWorkedOut.filter((account) => !sources.has(account.id)),
  }
}
