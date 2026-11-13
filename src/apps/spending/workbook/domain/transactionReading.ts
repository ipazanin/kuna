import { optionalReference, requiredReference } from './recordReference'
import type { HeldBankRow } from './heldBankRow'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, HELD_ROW_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
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
