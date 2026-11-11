import { accountBalance } from '../../accounts/domain/accountBalance'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { EntryPart } from '../../workbook/domain/entryPart'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'
import { eurosOfAccountMoney } from '../../../../shared/money/rateBook'
import type { RateBook } from '../../../../shared/money/rateBook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An entry with its account and what it is in euros at the ECB rate of its own day, null while the rates do not reach that day. */
export interface EuroRow {
  readonly transaction: Transaction
  readonly account: Account
  readonly euros: Money | null
  /** The parts a receipt or you split the entry into, none for an entry that is whole. */
  readonly lines: readonly EntryPart[]
}

/** Every entry of the book in euros, each at the rate of its day. An entry on a euro account passes through. */
export function euroRows(book: Pick<SpendingBook, 'accounts' | 'transactions' | 'lines'>, rates: RateBook): EuroRow[] {
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const linesOf = new Map<RecordId, EntryPart[]>()
  for (const line of book.lines) {
    if (line.transaction !== null) linesOf.set(line.transaction, [...(linesOf.get(line.transaction) ?? []), line])
  }
  return book.transactions.flatMap((transaction) => {
    const account = accounts.get(transaction.account)
    return account === undefined ? [] : [{ transaction, account, euros: eurosOfAccountMoney(transaction.amount, account.currency, transaction.date, rates), lines: linesOf.get(transaction.id) ?? [] }]
  })
}

/** An account's balance on the day, in its currency and in euros at that day's rate, null while the rates do not reach it. */
export interface AccountOnDay {
  readonly account: Account
  readonly balance: AccountMoney
  readonly euros: Money | null
}

export function accountOnDay(account: Account, rows: readonly Transaction[], day: CivilDate, rates: RateBook): AccountOnDay {
  const balance = accountBalance(account, rows, day)
  return { account, balance, euros: eurosOfAccountMoney(balance, account.currency, day, rates) }
}

/** The accounts Bank and cash adds up on the day: the open ones, and a closed one that still holds money, so closing an account never drops money from the sum. */
export function countedAccounts(book: Pick<SpendingBook, 'accounts' | 'transactions'>, day: CivilDate, rates: RateBook): AccountOnDay[] {
  return book.accounts.map((account) => accountOnDay(account, book.transactions, day, rates)).filter((shown) => !shown.account.closed || shown.balance !== 0)
}

/** How many of the accounts are in another currency with no euro figure on the day, which a sum counts as nothing. */
export function unconvertedCount(accounts: readonly AccountOnDay[]): number {
  return accounts.filter((shown) => shown.account.currency !== EURO && shown.euros === null).length
}
