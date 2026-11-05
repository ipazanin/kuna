import { optionalReference, requiredReference } from './recordReference'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { TRANSACTION_SOURCES } from './transaction'
import type { Transaction } from './transaction'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, requiredMoney, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function transactionOf(fields: StoredFields, id: RecordId | null): Transaction {
  const amount = requiredMoney(fields, 'amount')
  if (amount === 0) refuse(words.amountIsZero)
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
  }
}

export const TRANSACTION_CODEC: RecordCodec<Transaction> = withIdField(TRANSACTION_RECORDS, words.entryLabel, transactionOf, (transaction) =>
  filledFields({
    account: keyOfRecordId(ACCOUNT_RECORDS, transaction.account),
    date: transaction.date,
    amount: amountText(transaction.amount),
    payee: transaction.payee,
    category: transaction.category === null ? null : keyOfRecordId(CATEGORY_RECORDS, transaction.category),
    note: transaction.note,
    source: transaction.source,
    pair: transaction.pair === null ? null : keyOfRecordId(TRANSACTION_RECORDS, transaction.pair),
  }),
)
