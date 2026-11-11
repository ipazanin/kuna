import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

const LAST_ACCOUNT_KEY = 'kuna.spending-last-account'

/** The account this browser last saved an entry on, by its id, or null when it keeps none. */
export function lastAccountId(): RecordId | null {
  try {
    const stored = localStorage.getItem(LAST_ACCOUNT_KEY)
    return stored === null ? null : recordIdOf(ACCOUNT_RECORDS, stored)
  } catch {
    // Storage denied, as in some private windows, so none is kept.
    return null
  }
}

/** Of these accounts, the one this browser last saved an entry on while it is open, else the first open one. */
export function lastUsedAccount(accounts: readonly Account[]): Account | null {
  const open = accounts.filter((account) => !account.closed)
  const last = lastAccountId()
  return open.find((account) => account.id === last) ?? open[0] ?? null
}

/** The account a new entry starts on: the last used of those kept by hand. */
export function startingAccount(accounts: readonly Account[]): Account | null {
  return lastUsedAccount(accounts.filter(takesRowsByHand))
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
