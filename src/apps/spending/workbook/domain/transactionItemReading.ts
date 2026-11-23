import type { StoredLine } from './beforeItems'
import type { TransactionItem } from './transactionItem'
import { BY_DAYS, OUT_OF_EVENTS, eventPutIn } from './event'
import type { EventChoice } from './event'
import { flagOf, requiredAccountMoney } from './fieldReading'
import { optionalReference, requiredReference } from './recordReference'
import { rowLinkOf, rowLinkText } from './rowLink'
import type { RowLink } from './rowLink'
import { CATEGORY_RECORDS, EVENT_RECORDS, ITEM_RECORDS, LABEL_RECORDS, LINE_RECORDS, RECEIPT_RECORDS, SHARED_COST_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { idsOf, idsText, ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { RecordFields } from '../../../../shared/storage/domain/recordFields'
import { itemOfWaitingLine, itemsOfStoredRow } from './beforeItems'
import type { Receipt } from './receipt'
import type { StoredRow, Transaction } from './transaction'
import { accountMoneyOfEuros, negateAccountMoney, sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { plainAmount } from '../../../../shared/money/money'
import { doubted, problemOf, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'

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
export function eventChoiceOf(fields: StoredFields): EventChoice {
  const key = textOf(fields.event).trim()
  if (key === '') return BY_DAYS
  return key === OUT_OF_EVENTS ? OUT_OF_EVENTS : recordIdOf(EVENT_RECORDS, key)
}

export function eventChoiceText(choice: EventChoice): string | null {
  if (choice === BY_DAYS) return null
  const event = eventPutIn(choice)
  return event === null ? OUT_OF_EVENTS : keyOfRecordId(EVENT_RECORDS, event)
}

/** Of an item's rule labels, those it still carries, since a label taken off by hand is no longer the rule's. */
export function heldRuleLabels(item: Pick<TransactionItem, 'labels' | 'ruleLabels'>): readonly RecordId[] {
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
    payee: textOf(fields.payee).trim(),
    sharedCost: optionalReference(fields, 'shared_cost', SHARED_COST_RECORDS),
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
    payee: item.payee,
    shared_cost: item.sharedCost === null ? null : keyOfRecordId(SHARED_COST_RECORDS, item.sharedCost),
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

/**
 * Items that count keep counting when they name a label or an event the file lacks, doubted for it. The screens show them under
 * no label, and in the event their day falls in.
 */
export function withKnownNames(reading: Reading<TransactionItem>, read: RecordsRead<TransactionItem>, labels: ReadonlySet<RecordId>, events: ReadonlySet<RecordId>): Reading<TransactionItem> {
  return doubted(reading, read, (item) => {
    const unknown = item.labels.find((label) => !labels.has(label))
    if (unknown !== undefined) return words.noLabel(keyOfRecordId(LABEL_RECORDS, unknown))
    const event = eventPutIn(item.event)
    return event === null || events.has(event) ? null : words.noEvent(keyOfRecordId(EVENT_RECORDS, event))
  })
}

/** What the parts of an entry add up to: the entry's amount, or for the lines of a receipt that waits, minus its total. */
function wholeOfParts(transactions: readonly Transaction[], receipts: readonly Receipt[]): ReadonlyMap<RecordId, AccountMoney> {
  return new Map<RecordId, AccountMoney>([
    ...transactions.map((row) => [row.id, row.amount] as const),
    ...receipts.flatMap((receipt) => (receipt.transaction === null ? [[receipt.id, negateAccountMoney(accountMoneyOfEuros(receipt.total))] as const] : [])),
  ])
}

/** A part as both shapes of the file hold it, which the add-up rule reads. */
type Part = Pick<TransactionItem, 'transaction' | 'receipt' | 'amount' | 'category'>

/**
 * The parts of entries and the lines of waiting receipts. A part names a whole that counts, and when a receipt split it, that
 * entry's receipt, and a category that counts. The parts of a whole add up to it and count all or none. A file moved to items
 * also lets a part of a row waiting on review go without a category, such as one a deleted shared cost sent back, and never splits a transfer's leg.
 */
export function readParts<P extends Part>(read: RecordsRead<P>, transactions: readonly Transaction[], receipts: readonly Receipt[], categories: ReadonlySet<string>, beforeItems: boolean): Reading<P> {
  const wholes = wholeOfParts(transactions, receipts)
  const receiptOf = new Map(receipts.map((receipt) => [receipt.id, receipt]))
  const legs = new Set(transactions.filter((row) => row.pair !== null).map((row) => row.id))
  /** The entry the part is of, or the waiting receipt whose line it is, which its siblings share. */
  const wholeOf = (part: Part): RecordId | null => part.transaction ?? part.receipt
  const siblings = new Map<RecordId | null, Part[]>()
  for (const { record: part } of read.records) siblings.set(wholeOf(part), [...(siblings.get(wholeOf(part)) ?? []), part])
  const ownReason = (part: Part): string | null => {
    const whole = wholeOf(part)
    if (whole === null || !wholes.has(whole)) return part.transaction === null ? words.noReceipt : words.noEntry
    if (part.receipt !== null && receiptOf.get(part.receipt)?.transaction !== part.transaction) return words.noReceipt
    const many = (siblings.get(whole)?.length ?? 0) > 1
    if (!beforeItems && many && part.transaction !== null && legs.has(part.transaction)) return words.transferLegSplit
    if (part.category === null) return beforeItems || part.transaction === null ? words.uncategorisedNotAlone : null
    return categories.has(part.category) ? null : words.noCategory
  }
  const brokenWholes = new Set<RecordId | null>()
  for (const { record: part } of read.records) {
    if (ownReason(part) !== null) brokenWholes.add(wholeOf(part))
  }
  return readEach(read, ({ record: part }) => {
    const own = ownReason(part)
    if (own !== null) return [own]
    // All or none, since parts left counting without their sibling would drop its money from every figure.
    if (brokenWholes.has(wholeOf(part))) return [beforeItems ? words.siblingPartLeftOut : words.itemLeftOut]
    const amounts = (siblings.get(wholeOf(part)) ?? []).map((sibling) => sibling.amount)
    const whole = wholes.get(wholeOf(part)!)!
    return restOfWhole(whole, amounts) === 0 ? [] : [words.partsDoNotAddUp(plainAmount(sumAccountMoney(amounts)), plainAmount(whole))]
  })
}

/** Every row and waiting receipt's items as a file from before items holds them, in the order of the file's rows and then of its lines. */
export function itemsBeforeItems(read: RecordsRead<StoredRow>, rows: readonly StoredRow[], lines: readonly StoredLine[]): readonly TransactionItem[] {
  const counted = new Set(rows)
  const linesOf = new Map<RecordId, StoredLine[]>()
  for (const line of lines) {
    if (line.transaction !== null) linesOf.set(line.transaction, [...(linesOf.get(line.transaction) ?? []), line])
  }
  return [
    ...read.records.flatMap(({ record: row }) => (counted.has(row) ? itemsOfStoredRow(row, linesOf.get(row.id) ?? []) : [])),
    ...lines.filter((line) => line.transaction === null).map(itemOfWaitingLine),
  ]
}

/**
 * The rows of a file moved to items that have an item that counts, and those without as left out: for the reason their items
 * are, or for having none.
 */
export function withItems(reading: Reading<StoredRow>, read: RecordsRead<StoredRow>, items: Reading<TransactionItem>, stored: RecordsRead<TransactionItem>): Reading<StoredRow> {
  const itemized = new Set(items.facts.map((item) => item.transaction))
  const reasonOf = new Map<RecordId | null, string>()
  for (const { id, record } of stored.records) {
    const reason = items.problems.find((problem) => problem.id === id)?.reason
    if (reason !== undefined && !reasonOf.has(record.transaction)) reasonOf.set(record.transaction, reason)
  }
  const kept = new Set(reading.facts.filter((row) => itemized.has(row.id)))
  const left = read.records.filter((stored) => reading.facts.includes(stored.record) && !kept.has(stored.record))
  return {
    facts: reading.facts.filter((row) => kept.has(row)),
    problems: [...reading.problems, ...left.map((stored) => problemOf(stored, reasonOf.get(stored.record.id) ?? words.entryWithoutPart))],
  }
}
