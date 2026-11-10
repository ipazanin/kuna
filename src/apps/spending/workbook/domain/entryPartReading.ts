import type { EntryPart } from './entryPart'
import { requiredAccountMoney } from './fieldReading'
import { optionalReference, requiredReference } from './recordReference'
import { CATEGORY_RECORDS, PART_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function entryPartOf(fields: StoredFields, id: RecordId | null): EntryPart {
  const amount = requiredAccountMoney(fields, 'amount')
  if (amount === 0) refuse(words.amountIsZero)
  return {
    id: ownId(id),
    transaction: requiredReference(fields, 'transaction', TRANSACTION_RECORDS),
    receipt: optionalReference(fields, 'receipt', RECEIPT_RECORDS),
    printed: textOf(fields.printed),
    text: textOf(fields.text),
    amount,
    category: requiredReference(fields, 'category', CATEGORY_RECORDS),
  }
}

export const PART_CODEC: RecordCodec<EntryPart> = withIdField(PART_RECORDS, words.partLabel, entryPartOf, (part) =>
  filledFields({
    transaction: keyOfRecordId(TRANSACTION_RECORDS, part.transaction),
    receipt: part.receipt === null ? null : keyOfRecordId(RECEIPT_RECORDS, part.receipt),
    printed: part.printed,
    text: part.text,
    amount: amountText(part.amount),
    category: keyOfRecordId(CATEGORY_RECORDS, part.category),
  }),
)
