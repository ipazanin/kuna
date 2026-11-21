import { optionalReference, requiredReference } from './recordReference'
import type { HeldBankRow } from './heldBankRow'
import type { DroppedRow } from './droppedRow'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, DROPPED_ROW_RECORDS, HELD_ROW_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { ibanKey } from './accountReading'
import { flagOf, requiredAccountMoney } from './fieldReading'
import { rowLinkText } from './rowLink'
import { CATEGORISED_BY, TRANSACTION_SOURCES } from './transaction'
import type { StoredRow, Transaction } from './transaction'
import { linkOf } from './transactionItemReading'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { beforeStartDay } from './account'
import type { Account } from './account'
import { rowKey } from './transaction'
import { readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'

/** A row's amount, which is never zero. */
function amountOf(fields: StoredFields): Transaction['amount'] {
  const amount = requiredAccountMoney(fields, 'amount')
  if (amount === 0) refuse(words.amountIsZero)
  return amount
}

export function transactionOf(fields: StoredFields, id: RecordId | null): StoredRow {
  const amount = amountOf(fields)
  return {
    id: ownId(id),
    account: requiredReference(fields, 'account', ACCOUNT_RECORDS),
    date: requiredDate(fields, 'date'),
    amount,
    payee: textOf(fields.payee),
    category: optionalReference(fields, 'category', CATEGORY_RECORDS),
    note: textOf(fields.note),
    source: requiredChoice(fields, 'source', TRANSACTION_SOURCES),
    pair: optionalReference(fields, 'pair', TRANSACTION_RECORDS),
    description: textOf(fields.description),
    counterpartyIban: ibanKey(textOf(fields.counterparty_iban)),
    importKey: textOf(fields.import_key),
    statement: textOf(fields.statement),
    categorisedBy: fields.categorised_by === undefined ? null : requiredChoice(fields, 'categorised_by', CATEGORISED_BY),
    movedAt: textOf(fields.moved_at),
    pocket: flagOf(fields, 'pocket'),
    cashWithdrawal: flagOf(fields, 'cash_withdrawal'),
    pending: flagOf(fields, 'pending'),
    link: linkOf(fields),
  }
}

export const TRANSACTION_CODEC: RecordCodec<StoredRow> = withIdField(TRANSACTION_RECORDS, words.entryLabel, transactionOf, (transaction) =>
  filledFields({
    account: keyOfRecordId(ACCOUNT_RECORDS, transaction.account),
    date: transaction.date,
    amount: amountText(transaction.amount),
    payee: transaction.payee,
    category: transaction.category === null ? null : keyOfRecordId(CATEGORY_RECORDS, transaction.category),
    note: transaction.note,
    source: transaction.source,
    pair: transaction.pair === null ? null : keyOfRecordId(TRANSACTION_RECORDS, transaction.pair),
    description: transaction.description,
    counterparty_iban: transaction.counterpartyIban,
    import_key: transaction.importKey,
    statement: transaction.statement,
    categorised_by: transaction.categorisedBy,
    moved_at: transaction.movedAt,
    pocket: transaction.pocket ? true : null,
    cash_withdrawal: transaction.cashWithdrawal ? true : null,
    pending: transaction.pending ? true : null,
    link: transaction.link === null ? null : rowLinkText(transaction.link),
  }),
)

function heldBankRowOf(fields: StoredFields, id: RecordId | null): HeldBankRow {
  return {
    id: ownId(id),
    account: requiredReference(fields, 'account', ACCOUNT_RECORDS),
    date: requiredDate(fields, 'date'),
    amount: amountOf(fields),
    payee: textOf(fields.payee),
    description: textOf(fields.description),
    counterpartyIban: ibanKey(textOf(fields.counterparty_iban)),
    importKey: textOf(fields.import_key),
    like: requiredReference(fields, 'like', TRANSACTION_RECORDS),
  }
}

/** A bank row on hold, stored as the entry it would be, with the entry it looks like. */
export const HELD_ROW_CODEC: RecordCodec<HeldBankRow> = withIdField(HELD_ROW_RECORDS, words.entryLabel, heldBankRowOf, (held) =>
  filledFields({
    account: keyOfRecordId(ACCOUNT_RECORDS, held.account),
    date: held.date,
    amount: amountText(held.amount),
    payee: held.payee,
    description: held.description,
    counterparty_iban: held.counterpartyIban,
    import_key: held.importKey,
    like: keyOfRecordId(TRANSACTION_RECORDS, held.like),
  }),
)

function droppedRowFields(fields: StoredFields, id: RecordId | null): DroppedRow {
  return {
    id: ownId(id),
    account: requiredReference(fields, 'account', ACCOUNT_RECORDS),
    date: requiredDate(fields, 'date'),
    amount: amountOf(fields),
    payee: textOf(fields.payee),
    filing: textOf(fields.filing),
  }
}

/** A payment the bank dropped, stored with the row it was and how it was filed. */
export const DROPPED_ROW_CODEC: RecordCodec<DroppedRow> = withIdField(DROPPED_ROW_RECORDS, words.entryLabel, droppedRowFields, (dropped) =>
  filledFields({
    account: keyOfRecordId(ACCOUNT_RECORDS, dropped.account),
    date: dropped.date,
    amount: amountText(dropped.amount),
    payee: dropped.payee,
    filing: dropped.filing,
  }),
)

/** Why a row of an account is not on it: the account is not in the file, or the row is from before the account's start day. */
function accountReason(accounts: ReadonlyMap<string, Account>, row: Pick<Transaction, 'account' | 'date'>): string | null {
  const account = accounts.get(row.account)
  if (account === undefined) return words.noAccount
  return beforeStartDay(account, row.date) ? words.beforeStartDay(account.openedOn) : null
}

/** The rows, of which a file from before items checks the category each keeps on itself. */
export function readTransactions(read: RecordsRead<StoredRow>, accounts: ReadonlyMap<string, Account>, categories: ReadonlySet<string>, beforeItems: boolean): Reading<StoredRow> {
  const byId = new Map(read.records.map((stored) => [stored.id, stored.record]))
  const sharingKey = sharedKeys(
    read.records.filter((stored) => stored.record.importKey !== ''),
    (stored) => rowKey(stored.record),
  )
  const reading = readEach(read, ({ record: transaction }) => {
    const onAccount = accountReason(accounts, transaction)
    if (onAccount !== null) return [onAccount]
    if (transaction.importKey !== '' && sharingKey.has(rowKey(transaction))) return [words.importKeyShared(transaction.importKey)]
    if (beforeItems && transaction.category !== null && !categories.has(transaction.category)) return [words.noCategory]
    if (transaction.pair === null) return []
    const other = byId.get(transaction.pair)
    if (other?.pair !== transaction.id) return [words.pairNotBack]
    return other.account === transaction.account ? [words.pairOnSameAccount] : []
  })
  return { ...reading, facts: [...reading.facts].sort((earlier, later) => earlier.date.localeCompare(later.date)) }
}

/**
 * Why a bank row on hold does not count: it carries no import key, it names an account that does not count or is from before
 * that account's start day, or an entry or another held row of its account already has its import key. One whose look-alike
 * is gone still counts, and To review says so. The write of a held row reads the same.
 */
export function readHeld(read: RecordsRead<HeldBankRow>, accounts: ReadonlyMap<string, Account>, transactions: readonly Transaction[]): Reading<HeldBankRow> {
  const booked = new Set(transactions.filter((row) => row.importKey !== '').map(rowKey))
  const sharingKey = sharedKeys(read.records, (stored) => rowKey(stored.record))
  return readEach(read, ({ record: held }) => {
    if (held.importKey === '') return [words.heldRowNoKey]
    const onAccount = accountReason(accounts, held)
    if (onAccount !== null) return [onAccount]
    if (booked.has(rowKey(held))) return [words.heldRowBooked(held.importKey)]
    return sharingKey.has(rowKey(held)) ? [words.heldRowShared(held.importKey)] : []
  })
}

/** Why a payment the bank dropped does not count: it names an account that does not count or is from before that account's start day. */
export function readDropped(read: RecordsRead<DroppedRow>, accounts: ReadonlyMap<string, Account>): Reading<DroppedRow> {
  return readEach(read, ({ record }) => {
    const onAccount = accountReason(accounts, record)
    return onAccount === null ? [] : [onAccount]
  })
}
