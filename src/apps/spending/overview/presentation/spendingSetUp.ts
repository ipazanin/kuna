import type { SetUpLine } from '../../../../shared/app/appContribution'
import { SPENDING_TRANSACTIONS_ROUTE } from './spendingLinks'
import { words } from './words'

/** A Spending file asks for one account, then its first entries. More accounts, rules and limits can wait for what a person wants from them. */
export function spendingSetUp(book: { readonly accounts: readonly unknown[]; readonly transactions: readonly unknown[] }): SetUpLine[] {
  if (book.accounts.length === 0) return [{ key: 'first-account', text: words.setUp.firstAccount }]
  if (book.transactions.length === 0) {
    return [{ key: 'first-entries', text: words.setUp.firstEntries, link: { label: words.setUp.importLink, to: { path: SPENDING_TRANSACTIONS_ROUTE, query: { tab: 'import' } } } }]
  }
  return []
}
