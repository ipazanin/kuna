import type { StoredLine } from './beforeItems'
import type { TransactionItem } from './transactionItem'
import { requiredAccountMoney } from './fieldReading'
import { optionalReference, requiredReference } from './recordReference'
import { rowLinkOf, rowLinkText } from './rowLink'
import type { RowLink } from './rowLink'
import { CATEGORY_RECORDS, ITEM_RECORDS, LINE_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { RecordFields } from '../../../../shared/storage/domain/recordFields'

/** The fields an item and a line share: what it is part of, as the till printed it, its amount, never zero, and its category. */
function partOf(fields: StoredFields, id: RecordId | null, categoryOf: () => RecordId | null): Omit<StoredLine, 'text'> {
  const amount = requiredAccountMoney(fields, 'amount')
  if (amount === 0) refuse(words.amountIsZero)
  const transaction = optionalReference(fields, 'transaction', TRANSACTION_RECORDS)
  const receipt = optionalReference(fields, 'receipt', RECEIPT_RECORDS)
  if (transaction === null && receipt === null) refuse(words.partEntryOrReceipt)
  return { id: ownId(id), transaction, receipt, printed: textOf(fields.printed), amount, category: categoryOf() }
}

function partFields(part: Omit<StoredLine, 'id' | 'text'>): Readonly<Record<string, string | null>> {
  return {
    transaction: part.transaction === null ? null : keyOfRecordId(TRANSACTION_RECORDS, part.transaction),
    receipt: part.receipt === null ? null : keyOfRecordId(RECEIPT_RECORDS, part.receipt),
    printed: part.printed,
  }
}

/** The record in another app an item's `link` field names, refused when it is not of the shape a link takes. */
export function linkOf(fields: StoredFields): RowLink | null {
  if (fields.link === undefined) return null
  const text = textOf(fields.link)
  return rowLinkOf(text) ?? refuse(words.notALink(text))
}

export function transactionItemOf(fields: StoredFields, id: RecordId | null): TransactionItem {
  const { transaction, receipt, printed, amount, category } = partOf(fields, id, () => optionalReference(fields, 'category', CATEGORY_RECORDS))
  return { id: ownId(id), transaction, receipt, printed, note: textOf(fields.note), amount, category, link: linkOf(fields) }
}

export const ITEM_CODEC: RecordCodec<TransactionItem> = withIdField(ITEM_RECORDS, words.partLabel, transactionItemOf, (item): RecordFields =>
  filledFields({
    ...partFields(item),
    note: item.note,
    amount: amountText(item.amount),
    category: item.category === null ? null : keyOfRecordId(CATEGORY_RECORDS, item.category),
    link: item.link === null ? null : rowLinkText(item.link),
  }),
)

function storedLineOf(fields: StoredFields, id: RecordId | null): StoredLine {
  const { transaction, receipt, printed, amount, category } = partOf(fields, id, () => requiredReference(fields, 'category', CATEGORY_RECORDS))
  return { id: ownId(id), transaction, receipt, printed, text: textOf(fields.text), amount, category }
}

/** A part of an entry as a file from before items keeps it. */
export const LINE_CODEC: RecordCodec<StoredLine> = withIdField(LINE_RECORDS, words.partLabel, storedLineOf, (line): RecordFields =>
  filledFields({
    ...partFields(line),
    text: line.text,
    amount: amountText(line.amount),
    category: line.category === null ? null : keyOfRecordId(CATEGORY_RECORDS, line.category),
  }),
)
