import { requiredAccountMoney } from './fieldReading'
import { requiredReference } from './recordReference'
import type { ReceiptLine } from './receiptLine'
import { CATEGORY_RECORDS, LINE_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function receiptLineOf(fields: StoredFields, id: RecordId | null): ReceiptLine {
  const amount = requiredAccountMoney(fields, 'amount')
  if (amount === 0) refuse(words.amountIsZero)
  return {
    id: ownId(id),
    transaction: requiredReference(fields, 'transaction', TRANSACTION_RECORDS),
    receipt: requiredReference(fields, 'receipt', RECEIPT_RECORDS),
    printed: textOf(fields.printed),
    text: textOf(fields.text),
    amount,
    category: requiredReference(fields, 'category', CATEGORY_RECORDS),
  }
}

export const LINE_CODEC: RecordCodec<ReceiptLine> = withIdField(LINE_RECORDS, words.lineLabel, receiptLineOf, (line) =>
  filledFields({
    transaction: keyOfRecordId(TRANSACTION_RECORDS, line.transaction),
    receipt: keyOfRecordId(RECEIPT_RECORDS, line.receipt),
    printed: line.printed,
    text: line.text,
    amount: amountText(line.amount),
    category: keyOfRecordId(CATEGORY_RECORDS, line.category),
  }),
)
