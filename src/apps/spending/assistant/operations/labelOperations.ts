import { TEXT, found, inputOf } from '../../../../shared/app/operationInput'
import { addLabel, deleteLabel, labelRows, renameLabel } from '../../labels/application/labelWrites'
import { labelNameProblem, newLabel } from '../../labels/domain/labels'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import type { Label } from '../../workbook/domain/label'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import { ITEM_RECORDS, LABEL_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

const ENTRIES: StrictSchema = {
  type: 'array',
  items: inputOf({ entry: TEXT, part: { type: ['string', 'null'], description: "One of the entry's parts to change alone, such as one line of a receipt, or null for all of its parts." } }),
}

/** What Labels and the selection on Entries do: add, rename and delete a label, and put one on entries or one of their parts, or take it off. */
export const LABEL_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-label',
    about:
      'A new label, a name that groups money across categories and months, such as a trip or a renovation. No other label has the name once case and accents are set aside. A label-entries step on the same card puts it on entries by its $ name.',
    input: inputOf({ name: TEXT }),
    refs: {},
    creates: LABEL_RECORDS.name,
    alone: false,
    example: { name: 'Prague' },
  },
  {
    name: 'rename-label',
    about: 'A new name for a label. Every entry that carries it keeps it.',
    input: inputOf({ label: TEXT, name: TEXT }),
    refs: { label: LABEL_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label', name: 'Home renovation' },
  },
  {
    name: 'delete-label',
    about: "Deletes a label and takes it off every entry and waiting receipt's line that carries it. Their categories stay.",
    input: inputOf({ label: TEXT }),
    refs: { label: LABEL_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label' },
  },
  {
    name: 'label-entries',
    about:
      'Puts a label on entries, beside their categories, which it changes no figure of: on every part of each entry, or with part on that part alone, such as the one line of a receipt that belongs to a renovation. A file from before parts keeps no labels, so move-to-items goes first.',
    input: inputOf({ label: TEXT, entries: ENTRIES }),
    refs: { label: LABEL_RECORDS.name, 'entries.entry': TRANSACTION_RECORDS.name, 'entries.part': ITEM_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label', entries: [{ entry: 'transaction', part: null }] },
  },
  {
    name: 'unlabel-entries',
    about: 'Takes a label off entries: off every part of each entry, or with part off that part alone. The label stays for the entries that keep it.',
    input: inputOf({ label: TEXT, entries: ENTRIES }),
    refs: { label: LABEL_RECORDS.name, 'entries.entry': TRANSACTION_RECORDS.name, 'entries.part': ITEM_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label', entries: [{ entry: 'transaction-split', part: null }] },
  },
]

const LABEL_OPERATION_NAMES: ReadonlySet<string> = new Set(LABEL_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the label operations. */
export function isLabelStep(operation: string): boolean {
  return LABEL_OPERATION_NAMES.has(operation)
}

function refuseName(name: string, labels: readonly Label[], own: RecordId | null): void {
  const problem = labelNameProblem(name, labels, own)
  if (problem === 'blank') throw new StepRefused('A label needs a name.')
  if (problem === 'taken') throw new StepRefused(`Another label is called ${name.trim()} once case and accents are set aside, so use that one.`)
}

/** The rows a step names and the parts it names alone, each part refused unless it is one of its entry's own. */
function picked(
  book: SpendingBook,
  given: readonly { readonly entry: string; readonly part: string | null }[],
  idOf: (value: unknown) => string,
): { readonly rows: readonly Transaction[]; readonly parts: ReadonlySet<RecordId> } {
  const itemsOf = rowItemsOf(book)
  const rows = new Map<RecordId, Transaction>()
  const parts = new Set<RecordId>()
  for (const { entry, part } of given) {
    const row = found(book.transactions, idOf(entry), 'entry')
    rows.set(row.id, row)
    if (part === null) continue
    const named = itemsOf(row).find((item) => item.id === idOf(part))
    if (named === undefined) throw new StepRefused("A part is one of its entry's own parts, as get_record of the entry lists them.")
    parts.add(named.id)
  }
  return { rows: [...rows.values()], parts }
}

/**
 * Writes a label step through the writes Labels and Entries use, and gives the label an add-label step made so a later step
 * names it by `$`. A file from before items keeps no labels, so a step that puts one on entries is refused there.
 */
export function writeLabelStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts'>,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): Label | null {
  if (operation === 'add-label') {
    refuseName(field['name'], book.labels, null)
    const label = newLabel(field['name'])
    addLabel(unit, label)
    return label
  }
  const label = found(book.labels, idOf(field['label']), 'label')
  if (operation === 'rename-label') {
    refuseName(field['name'], book.labels, label.id)
    renameLabel(unit, label, field['name'])
  } else if (operation === 'delete-label') {
    deleteLabel(unit, records, label)
  } else {
    if (isBeforeItems(records)) throw new StepRefused('This file stores entries the way older versions of Kuna did, so it keeps no labels. Propose move-to-items first.')
    const { rows, parts } = picked(book, field['entries'], idOf)
    labelRows(unit, records, rows, label.id, operation === 'label-entries', parts)
  }
  return null
}
