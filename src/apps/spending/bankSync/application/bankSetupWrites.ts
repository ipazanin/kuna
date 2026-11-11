import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { ACCOUNT_WRITES } from '../../accounts/application/accountWrites'
import { bankAccountKey, startedAccount } from '../domain/bankAccountSetup'
import type { AccountProposal, BankAccountStart } from '../domain/bankAccountSetup'
import type { LinkedAccount } from '../domain/bankAnswer'
import { BANK_SYNC_LABEL } from '../domain/bankSyncRows'
import { writeDryRun } from '../../statements/application/statementWrites'
import { statementDryRun } from '../../statements/domain/statementDryRun'
import type { StatementRow } from '../../statements/domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { BANK_ACCOUNTS_KEEP_MINE_KEY, BANK_ACCOUNTS_NOT_IN_KUNA_KEY, bankAccountsText } from '../../workbook/domain/spendingSettings'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** The held rows on the accounts as they will stand, worked out against the file with those accounts in it, so an exchange pairs with its other leg on the file. */
function writeHeldRows(unit: UnitOfWork, book: SpendingBook, held: readonly { readonly account: Account; readonly rows: readonly StatementRow[] }[], day: CivilDate): void {
  const ids = new Set(held.map(({ account }) => account.id))
  const accounts = [...book.accounts.filter((account) => !ids.has(account.id)), ...held.map(({ account }) => account)]
  const rows = held.flatMap(({ account, rows: onDraft }) => onDraft.map((row) => ({ ...row, account: account.id })))
  if (rows.length === 0) return
  writeDryRun(unit, statementDryRun({ ...book, accounts }, { label: BANK_SYNC_LABEL, rows, notes: [] }, day))
}

/** The drafted accounts, each starting on its day, and their held rows from that day on in one write, so one Undo takes it all back. */
export function addBankAccounts(unit: UnitOfWork, book: SpendingBook, starts: readonly BankAccountStart[], day: CivilDate): void {
  const accounts = unit.of(ACCOUNT_WRITES)
  const started = starts.map((start) => ({ account: startedAccount(start).account, rows: start.proposal.rows.rows }))
  started.forEach(({ account }) => accounts.add(account))
  writeHeldRows(unit, book, started, day)
}

/**
 * The account as it stands takes the bank's details, its bank, IBAN, currency and kind, and from then on the bank brings its
 * rows. The rows held for it come in the same write. Its name, its opening and any change made to it since the fetch stay.
 */
export function takeBankDetails(
  unit: UnitOfWork,
  book: SpendingBook,
  account: Account,
  bankDetails: Pick<Account, 'bank' | 'iban' | 'currency' | 'kind' | 'rowsFrom'>,
  proposal: AccountProposal | null,
  day: CivilDate,
): void {
  const { bank, iban, currency, kind, rowsFrom } = bankDetails
  const update = { ...account, bank, iban, currency, kind, rowsFrom }
  unit.of(ACCOUNT_WRITES).change(account, update)
  writeHeldRows(unit, book, [{ account: update, rows: proposal?.rows.rows ?? [] }], day)
}

/** Puts the linked account on one of the bank sync's lists of accounts, or takes it off. One the bank names anew on every link cannot be listed. */
function markBankAccount(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, settingKey: string, marked: readonly string[], linked: LinkedAccount, on: boolean): void {
  const key = bankAccountKey(linked)
  if (key === null) return
  const others = marked.filter((held) => held !== key)
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, settingKey, bankAccountsText(on ? [...others, key] : others))
}

/** Marks the linked account as one Kuna does not keep, so the sync stops offering and reading it, or takes the mark off. */
export function keepOutOfKuna(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'settings'>, linked: LinkedAccount, out: boolean): void {
  markBankAccount(unit, book, BANK_ACCOUNTS_NOT_IN_KUNA_KEY, book.settings.bankAccountsNotInKuna, linked, out)
}

/** Keeps the Spending account's own bank and kind, and its rows by hand, for the linked account, so the sync stops offering the bank's. */
export function keepMine(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'settings'>, linked: LinkedAccount): void {
  markBankAccount(unit, book, BANK_ACCOUNTS_KEEP_MINE_KEY, book.settings.bankAccountsKeepMine, linked, true)
}

/** Takes the mark off the linked account, so the sync offers the bank's details for it again. */
export function bringBackBankDetails(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'settings'>, linked: LinkedAccount): void {
  markBankAccount(unit, book, BANK_ACCOUNTS_KEEP_MINE_KEY, book.settings.bankAccountsKeepMine, linked, false)
}

/** The account opens at the amount that makes Kuna's balance agree with the bank's. Its opening day stays, so no row moves. */
export function fixOpening(unit: UnitOfWork, account: Account, opening: AccountMoney): void {
  unit.of(ACCOUNT_WRITES).change(account, { ...account, opening })
}
