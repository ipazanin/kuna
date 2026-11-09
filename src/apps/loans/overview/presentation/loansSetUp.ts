import type { SetUpLine } from '../../../../shared/app/appContribution'
import { words } from './words'

/** A Loans file has one thing to set up: its first loan. Whether the plan matches the bank's figure is said on the loan's page, since no state of the file can tell. */
export function loansSetUp(book: { readonly bankLoans: readonly unknown[]; readonly informalLoans: readonly unknown[] }): SetUpLine[] {
  return book.bankLoans.length + book.informalLoans.length > 0 ? [] : [{ key: 'first-loan', text: words.setUp.firstLoan, whileEmpty: true }]
}
