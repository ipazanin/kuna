import type { StoredLine } from './beforeItems'
import type { TransactionItem } from './transactionItem'
import { BY_DAYS, OUT_OF_EVENTS, eventPutIn } from './event'
import type { EventChoice } from './event'
import { flagOf, requiredAccountMoney } from './fieldReading'
import { optionalReference, requiredReference } from './recordReference'
import { rowLinkOf, rowLinkText } from './rowLink'
import type { RowLink } from './rowLink'
import { CATEGORY_RECORDS, EVENT_RECORDS, ITEM_RECORDS, LABEL_RECORDS, LINE_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { idsOf, idsText, ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
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

/** An item's `event` field: blank while it joins an event by its day, `out` when taken out of every event, or the key of the event it was put in. */
function eventChoiceOf(fields: StoredFields): EventChoice {
  const key = textOf(fields.event).trim()
  if (key === '') return BY_DAYS
  return key === OUT_OF_EVENTS ? OUT_OF_EVENTS : recordIdOf(EVENT_RECORDS, key)
}

function eventChoiceText(choice: EventChoice): string | null {
  if (choice === BY_DAYS) return null
  const event = eventPutIn(choice)
  return event === null ? OUT_OF_EVENTS : keyOfRecordId(EVENT_RECORDS, event)
}

/** Of an item's rule labels, those it still carries, since a label taken off by hand is no longer the rule's. */
function heldRuleLabels(item: Pick<TransactionItem, 'labels' | 'ruleLabels'>): readonly RecordId[] {
  return item.ruleLabels.filter((label) => item.labels.includes(label))
}

/** An item as the file keeps it. A file from before rules added labels keeps none of them as a rule's. */
export function transactionItemOf(fields: StoredFields, id: RecordId | null): TransactionItem {
  const { transaction, receipt, printed, amount, category } = partOf(fields, id, () => optionalReference(fields, 'category', CATEGORY_RECORDS))
  const labels = idsOf(fields.labels, LABEL_RECORDS)
  return {
    id: ownId(id),
    transaction,
    receipt,
    printed,
    note: textOf(fields.note),
    amount,
    category,
    link: linkOf(fields),
    labels,
    ruleLabels: heldRuleLabels({ labels, ruleLabels: idsOf(fields.rule_labels, LABEL_RECORDS) }),
    event: eventChoiceOf(fields),
    splitByLink: flagOf(fields, 'split_by_link'),
  }
}

export const ITEM_CODEC: RecordCodec<TransactionItem> = withIdField(ITEM_RECORDS, words.partLabel, transactionItemOf, (item): RecordFields =>
  filledFields({
    ...partFields(item),
    note: item.note,
    amount: amountText(item.amount),
    category: item.category === null ? null : keyOfRecordId(CATEGORY_RECORDS, item.category),
    link: item.link === null ? null : rowLinkText(item.link),
    labels: idsText(item.labels, LABEL_RECORDS),
    rule_labels: idsText(heldRuleLabels(item), LABEL_RECORDS),
    event: eventChoiceText(item.event),
    split_by_link: item.splitByLink ? true : null,
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
