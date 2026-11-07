import { accountNamed } from '../../overview/presentation/spendingLinks'
import type { Account } from '../../workbook/domain/account'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'

const LAST_ACCOUNT_KEY = 'kuna.spending-last-account'

/** The account a new entry starts on: the one this browser last saved an entry on while it is open, else the first open account. */
export function startingAccount(accounts: readonly Account[]): Account | null {
  const open = accounts.filter((account) => !account.closed)
  let stored: string | null = null
  try {
    stored = localStorage.getItem(LAST_ACCOUNT_KEY)
  } catch {
    // Storage denied, as in some private windows, so the first open account is picked.
  }
  const last = accountNamed(open, stored)
  return last ?? open[0] ?? null
}

export function rememberLastAccount(account: Account): void {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, keyOfRecordId(ACCOUNT_RECORDS, account.id))
  } catch {
    // Storage denied. The next entry starts on the first open account.
  }
}

export function forgetLastAccount(): void {
  try {
    localStorage.removeItem(LAST_ACCOUNT_KEY)
  } catch {
    // Storage denied, so nothing was kept.
  }
}
