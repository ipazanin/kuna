import { PART_AMOUNT, TEXT, TEXT_OR_NULL, found, inputOf } from '../../../../shared/app/operationInput'
import { removeSplitOf, writeEntry, writeEntrySplit } from '../../entries/application/entryWrites'
import { entrySplit, newPartChoices } from '../../entries/domain/entrySplit'
import type { ItemDraft, PartChoices } from '../../entries/domain/entrySplit'
import { en as entriesEnglish } from '../../entries/presentation/words'
import { refiledReceiptLines } from '../../receipts/domain/receiptLines'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { BY_DAYS, OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { EventChoice } from '../../workbook/domain/event'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { isSplit, itemizedRow } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { CATEGORY_RECORDS, EVENT_RECORDS, ITEM_RECORDS, LABEL_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { accountMoneyFromAmount, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

const EVENT_RULES = ['on-its-days', 'out-of-events'] as const

/** The labels and event a part of split-entry carries as the Split dialog sets them, each null to keep what the part has. */
const PART_CHOICES: StrictSchema = inputOf({
  labels: { type: ['array', 'null'], items: TEXT, description: "The refs of every label the part carries, an empty list for none, or null to keep the part's own." },
  event: { type: ['string', 'null'], description: 'The ref of the event the part is put in by hand, or null.' },
  eventRule: {
    type: ['string', 'null'],
    enum: [...EVENT_RULES, null],
    description: 'on-its-days puts the part on the event its day gives it, out-of-events takes it out of every event, or null. With null in event and in eventRule the part keeps its own.',
  },
})

interface PartChoiceInput {
  readonly labels: readonly string[] | null
  readonly event: string | null
  readonly eventRule: (typeof EVENT_RULES)[number] | null
}

/** What the entry dialog's Split and its receipt lines do: split an entry by hand, take a split or a receipt off, and file a receipt's lines anew. */
export const SPLIT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'split-entry',
    about: [
      "Splits an entry into parts by hand, each under a category of its own, as the entry's Split does. A split has two parts or more, and splitting an entry again puts the new parts in place of its old ones.",
      "Each amount is above zero in the entry's account currency. Kuna signs it as the entry is, and exactly one part has amount null and takes the rest, which must leave something.",
      'A part goes under any category a row may take, For the company too, but never under a group with categories under it or under Between my accounts. note is the owner\'s optional words on the part, or "".',
      "part is the ref of the entry's part it keeps, which stays the same part with its new amount, category and note, or null for a new part. The one part of an entry not split yet goes to the first part that names none.",
      "Every part keeps the entry's link. A transfer's leg and an entry a receipt split stay as they are.",
      "choices sets a part's labels and event as the Split does, and all null leaves them to Kuna, which carries those of the parts the new part took money from. Where choices sets one, what it leaves null stays as the part has it, and a new part starts from the labels every part of the entry carries and the event of its largest part.",
      'A label or an event the same card adds is named by its $ name. A file from before parts keeps no labels or events.',
    ].join(' '),
    input: inputOf({
      entry: TEXT,
      parts: { type: 'array', items: inputOf({ part: TEXT_OR_NULL, amount: PART_AMOUNT, category: TEXT, note: TEXT, choices: PART_CHOICES }) },
    }),
    refs: {
      entry: TRANSACTION_RECORDS.name,
      'parts.part': ITEM_RECORDS.name,
      'parts.category': CATEGORY_RECORDS.name,
      'parts.choices.labels': LABEL_RECORDS.name,
      'parts.choices.event': EVENT_RECORDS.name,
    },
    creates: null,
    alone: false,
    example: {
      entry: 'transaction',
      parts: [
        { part: null, amount: 30, category: 'category', note: 'Lunch', choices: { labels: null, event: null, eventRule: null } },
        { part: null, amount: null, category: 'category-other', note: '', choices: { labels: null, event: null, eventRule: null } },
      ],
    },
  },
  {
    name: 'remove-split',
    about: 'Takes the parts off an entry split by hand, and keeps the entry under the category most of its money was in. An entry a receipt split loses its lines through remove-receipt.',
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-split' },
  },
  {
    name: 'remove-receipt',
    about: 'Takes the receipt off an entry, with the lines it split the entry into, and keeps the entry. The photo stays where it was kept.',
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-receipt' },
  },
  {
    name: 'refile-receipt',
    about: [
      "Files lines of the receipt on an entry anew, as the entry dialog does. Each line names one of the receipt's lines by its ref, and takes a category as a part of split-entry does, never a group with categories under it or Between my accounts.",
      "note is the owner's words on the line, or null to keep them, and category null keeps its category. A line's amount, the entry's amount and its account stay the receipt's, and a line not named stays as it is.",
    ].join(' '),
    input: inputOf({
      entry: TEXT,
      lines: { type: 'array', items: inputOf({ line: TEXT, category: TEXT_OR_NULL, note: TEXT_OR_NULL }) },
    }),
    refs: { entry: TRANSACTION_RECORDS.name, 'lines.line': ITEM_RECORDS.name, 'lines.category': CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-receipt', lines: [{ line: 'item-receipt-line', category: 'category-child', note: 'Bread for the trip' }] },
  },
]

const SPLIT_OPERATION_NAMES: ReadonlySet<string> = new Set(SPLIT_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the split operations. */
export function isSplitStep(operation: string): boolean {
  return SPLIT_OPERATION_NAMES.has(operation)
}

/** An amount above zero signed as the row is, so a part of money out is money out. */
function signedAs(row: Transaction, amount: AccountMoney): AccountMoney {
  return row.amount < 0 ? negateAccountMoney(amount) : amount
}

/** The event a part's choices name, on its days, out of every event, or the event by its ref, or null to keep the part's own. */
function eventChoiceOf(book: SpendingBook, { event, eventRule }: PartChoiceInput, idOf: (value: unknown) => string): EventChoice | null {
  if (event !== null && eventRule !== null) throw new StepRefused('A part takes an event or an eventRule, not both.')
  if (event !== null) return found(book.events, idOf(event), 'event').id
  if (eventRule === null) return null
  return eventRule === 'on-its-days' ? BY_DAYS : OUT_OF_EVENTS
}

/** The labels and event a part is given, with what the choices leave null as the part has it, or null when they set nothing. */
function choicesOf(
  book: SpendingBook,
  records: SpendingRecords,
  held: readonly TransactionItem[],
  kept: TransactionItem | undefined,
  given: PartChoiceInput,
  idOf: (value: unknown) => string,
): PartChoices | null {
  const event = eventChoiceOf(book, given, idOf)
  if (given.labels === null && event === null) return null
  if (isBeforeItems(records)) throw new StepRefused('This file stores entries the way older versions of Kuna did, so it keeps no labels or events. Propose move-to-items first.')
  const own = kept ?? newPartChoices(held)
  return { labels: given.labels === null ? own.labels : [...new Set(given.labels.map((label) => found(book.labels, idOf(label), 'label').id))], event: event ?? own.event }
}

/** Splits an entry by hand as the entry's Split does, and gives the entry with its new parts. */
function splitEntry(unit: UnitOfWork, book: SpendingBook, records: SpendingRecords, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): ItemizedRow {
  const row = found(book.transactions, idOf(field['entry']), 'row')
  const given = field['parts'] as readonly {
    readonly part: string | null
    readonly amount: number | null
    readonly category: string
    readonly note: string
    readonly choices: PartChoiceInput
  }[]
  const held = itemizedRow(book, row).items
  const keptPart = (ref: string | null): RecordId | null => {
    if (ref === null) return null
    const part = held.find((candidate) => candidate.id === idOf(ref))
    if (part === undefined) throw new StepRefused("A part keeps only one of the entry's own parts.")
    return part.id
  }
  const drafts = given.map((part): ItemDraft => {
    const id = keptPart(part.part)
    const choices = choicesOf(
      book,
      records,
      held,
      held.find((candidate) => candidate.id === id),
      part.choices,
      idOf,
    )
    return {
      id,
      amount: part.amount === null ? 'rest' : signedAs(row, accountMoneyFromAmount(part.amount)),
      category: found(book.categories, idOf(part.category), 'category').id,
      note: part.note,
      ...(choices === null ? {} : { choices }),
    }
  })
  const kept = drafts.flatMap((draft) => (draft.id === null ? [] : [draft.id]))
  if (new Set(kept).size < kept.length) throw new StepRefused("Each of the entry's parts is kept by one part at most.")
  const split = entrySplit(book, row, drafts)
  if ('refused' in split) throw new StepRefused(entriesEnglish.split.refusals[split.refused])
  writeEntrySplit(unit, records, split)
  return { row: split.row, items: split.parts }
}

/** Files a receipt's lines anew as the entry dialog does, and gives the entry with its refiled lines. */
function refileReceipt(unit: UnitOfWork, book: SpendingBook, records: SpendingRecords, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): ItemizedRow {
  const before = itemizedRow(book, found(book.transactions, idOf(field['entry']), 'row'))
  if (!book.receipts.some((receipt) => receipt.transaction === before.row.id)) throw new StepRefused('That entry has no receipt.')
  const given = field['lines'] as readonly { readonly line: string; readonly category: string | null; readonly note: string | null }[]
  const refiles = given.map((line) => {
    const held = before.items.find((item) => item.id === idOf(line.line))
    const category = line.category === null ? held?.category : found(book.categories, idOf(line.category), 'category').id
    if (held === undefined || category === null || category === undefined) throw new StepRefused("A line names one of the entry's own receipt lines.")
    return { line: held.id, category, note: line.note ?? held.note }
  })
  const lines = refiledReceiptLines(book.categories, before.items, refiles)
  if ('refused' in lines) throw new StepRefused(lines.refused === 'not-a-receipt-line' ? "A line names one of the entry's own receipt lines." : entriesEnglish.split.refusals[lines.refused])
  writeEntry(unit, records, before, { row: before.row, items: lines }, null)
  return { row: before.row, items: lines }
}

/** Writes a split step through the writes the entry dialog uses, and gives the entry with its new parts when they change. */
export function writeSplitStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): ItemizedRow | null {
  if (operation === 'split-entry') return splitEntry(unit, book, records, field, idOf)
  if (operation === 'refile-receipt') return refileReceipt(unit, book, records, field, idOf)
  const row = found(book.transactions, idOf(field['entry']), 'row')
  const hasReceipt = book.receipts.some((receipt) => receipt.transaction === row.id)
  if (operation === 'remove-split') {
    if (hasReceipt) throw new StepRefused('A receipt split that entry, so remove-receipt takes its lines off.')
    if (!isSplit(itemizedRow(book, row).items)) throw new StepRefused('That entry is not split.')
  } else if (!hasReceipt) {
    throw new StepRefused('That entry has no receipt.')
  }
  removeSplitOf(unit, records, row)
  return null
}
