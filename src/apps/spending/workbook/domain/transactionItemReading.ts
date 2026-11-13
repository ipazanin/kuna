import type { TransactionItem } from './transactionItem'
import { requiredAccountMoney } from './fieldReading'
import { optionalReference, requiredReference } from './recordReference'
import { CATEGORY_RECORDS, ITEM_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function transactionItemOf(fields: StoredFields, id: RecordId | null): TransactionItem {
  const amount = requiredAccountMoney(fields, 'amount')
  if (amount === 0) refuse(words.amountIsZero)
  const transaction = optionalReference(fields, 'transaction', TRANSACTION_RECORDS)
  const receipt = optionalReference(fields, 'receipt', RECEIPT_RECORDS)
  if (transaction === null && receipt === null) refuse(words.partEntryOrReceipt)
  return {
    id: ownId(id),
    transaction,
    receipt,
    printed: textOf(fields.printed),
    text: textOf(fields.text),
    amount,
    category: requiredReference(fields, 'category', CATEGORY_RECORDS),
  }
}

export const ITEM_CODEC: RecordCodec<TransactionItem> = withIdField(ITEM_RECORDS, words.partLabel, transactionItemOf, (part) =>
  filledFields({
    transaction: part.transaction === null ? null : keyOfRecordId(TRANSACTION_RECORDS, part.transaction),
    receipt: part.receipt === null ? null : keyOfRecordId(RECEIPT_RECORDS, part.receipt),
    printed: part.printed,
    text: part.text,
    amount: amountText(part.amount),
    category: keyOfRecordId(CATEGORY_RECORDS, part.category),
  }),
)
