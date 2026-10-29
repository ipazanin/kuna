import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { isCompleteMonth } from '../../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { sumMoney } from '../../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../filters/domain/drillTarget'
import type { Figure } from '../../filters/domain/drillTarget'
import type { Transaction } from '../../workbook/domain/workbook'

export interface AccountBalance {
  readonly account: string
  /** The closing balance of the account's newest day. */
  readonly balance: Figure
  readonly asOf: CivilDate
  readonly firstSeen: CivilDate
  readonly transactionCount: number
  /** Emptied, and silent through the month the ledger's newest row falls in. */
  readonly closed: boolean
}

export interface LatestBalances {
  /** Sorted by account name. */
  readonly accounts: readonly AccountBalance[]
  /** Every account at its latest balance. */
  readonly cashOnHand: Figure
}

export interface BalanceMonth {
  readonly month: MonthKey
  /** False for the month still filling up, whose balance is the latest so far. */
  readonly complete: boolean
  /** Null for an account that had no row yet. */
  readonly byAccount: Readonly<Record<string, Figure | null>>
  readonly total: Figure
}

export interface BalanceSeries {
  readonly accounts: readonly string[]
  readonly months: readonly BalanceMonth[]
}

/**
 * Each account's latest balance. Pass every row of the accounts in view, not rows narrowed by
 * category or period, or the closing row may be missing.
 */
export function latestBalances(accountTransactions: readonly Transaction[]): LatestBalances {
  const newestMonth = accountTransactions.reduce<MonthKey | null>((newest, transaction) => {
    const month = monthOf(transaction.date)
    return newest === null || month > newest ? month : newest
  }, null)
  const accounts = [...rowsByAccount(accountTransactions)].map(([account, rows]): AccountBalance => {
    const closing = rows[rows.length - 1]
    return {
      account,
      balance: { amount: closing.balance, drill: drillToTransactions({ period: { preset: 'all' }, accounts: [account] }) },
      asOf: closing.date,
      firstSeen: rows[0].date,
      transactionCount: rows.length,
      closed: closing.balance === 0 && monthOf(closing.date) !== newestMonth,
    }
  })
  return {
    accounts,
    cashOnHand: {
      amount: sumMoney(accounts.map((account) => account.balance.amount)),
      drill: drillToTransactions({ period: { preset: 'all' }, accounts: accounts.map((account) => account.account) }),
    },
  }
}

/**
 * Month-end balance per account from the ledger's first month to its newest. A month without rows
 * carries the previous balance forward, so a closed account keeps its last balance. Any number of
 * accounts. The same row rule as `latestBalances` applies to what to pass.
 */
export function balanceSeries(accountTransactions: readonly Transaction[], window: LedgerWindow): BalanceSeries {
  const byAccount = rowsByAccount(accountTransactions)
  const accounts = [...byAccount.keys()]
  const months = monthsFrom(window.firstMonth, window.partMonth).map((month): BalanceMonth => {
    const monthEnd = lastDayOf(month)
    const period = monthPeriod(month)
    const balances = accounts.map((account) => {
      const closing = closingRowBy(byAccount.get(account) ?? [], monthEnd)
      return [account, closing === null ? null : { amount: closing.balance, drill: drillToTransactions({ period, accounts: [account] }) }] as const
    })
    return {
      month,
      complete: isCompleteMonth(window, month),
      byAccount: Object.fromEntries(balances),
      total: {
        amount: sumMoney(balances.flatMap(([, balance]) => (balance === null ? [] : [balance.amount]))),
        drill: drillToTransactions({ period, accounts }),
      },
    }
  })
  return { accounts, months }
}

/** Each account's rows in booking order, oldest first. Accounts sorted by name. */
function rowsByAccount(transactions: readonly Transaction[]): Map<string, Transaction[]> {
  const ordered = [...transactions].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
  const byAccount = new Map<string, Transaction[]>()
  for (const account of [...new Set(ordered.map((transaction) => transaction.account))].sort()) {
    byAccount.set(account, [])
  }
  for (const transaction of ordered) {
    byAccount.get(transaction.account)?.push(transaction)
  }
  return byAccount
}

/** The last booking on or before a day, from rows in booking order. */
function closingRowBy(rows: readonly Transaction[], day: CivilDate): Transaction | null {
  let closing: Transaction | null = null
  for (const row of rows) {
    if (row.date > day) {
      break
    }
    closing = row
  }
  return closing
}
