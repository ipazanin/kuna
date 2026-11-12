import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { deviceChoice } from '../../../../shared/device/deviceChoice'

const kept = deviceChoice<RecordId | null>('kuna.spending-last-account', null, {
  read: (stored) => recordIdOf(ACCOUNT_RECORDS, stored),
  write: (id) => (id === null ? null : keyOfRecordId(ACCOUNT_RECORDS, id)),
})

/** The account this browser last saved an entry on, by its id, or null when it keeps none. */
export function lastAccountId(): RecordId | null {
  return kept.read()
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

/** Where storage is denied the next entry starts on the first open account. */
export function rememberLastAccount(account: Account): void {
  kept.remember(account.id)
}

export function forgetLastAccount(): void {
  kept.remember(null)
}
