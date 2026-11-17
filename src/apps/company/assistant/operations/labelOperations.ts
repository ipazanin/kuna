import { fieldsOf, rowOf } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { addLabel, deleteLabel, labelRows, renameLabel } from '../../labels/application/labelWrites'
import { newLabel } from '../../labels/domain/labels'
import { ITEM_RECORDS, LABEL_RECORDS, LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import { storedItemsOfRow, storesItems } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/workbook'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { TEXT, found, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { labelNameProblem } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Ledger rows a step changes, each whole or with one of its parts alone. */
const ROWS: StrictSchema = {
  type: 'array',
  items: inputOf({ row: TEXT, part: { type: ['string', 'null'], description: "One of the row's parts to change alone, such as one part of a split, or null for all of its parts." } }),
}

const OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-label',
    about:
      'A new label, a name that groups parts of ledger rows across categories and months, such as a conference or an office fit-out. No other label has the name once case and accents are set aside. A label-rows step on the same card puts it on rows by its $ name.',
    input: inputOf({ name: TEXT }),
    refs: {},
    creates: LABEL_RECORDS.name,
    alone: false,
    example: { name: 'Berlin 2027' },
  },
  {
    name: 'rename-label',
    about: 'A new name for a label. Every row that carries it keeps it.',
    input: inputOf({ label: TEXT, name: TEXT }),
    refs: { label: LABEL_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label', name: 'Office fit-out' },
  },
  {
    name: 'delete-label',
    about: 'Deletes a label and takes it off every row that carries it. Their categories stay.',
    input: inputOf({ label: TEXT }),
    refs: { label: LABEL_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label' },
  },
  {
    name: 'label-rows',
    about:
      'Puts a label on ledger rows, beside their categories, which it changes no figure of: on every part of each row, or with part on that part alone, such as the one part of a split that belongs to a conference. Books from before items keep no labels, so move-to-items goes first.',
    input: inputOf({ label: TEXT, rows: ROWS }),
    refs: { label: LABEL_RECORDS.name, 'rows.row': LEDGER_RECORDS.name, 'rows.part': ITEM_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label', rows: [{ row: 'ledger-row', part: null }] },
  },
  {
    name: 'unlabel-rows',
    about: 'Takes a label off ledger rows: off every part of each row, or with part off that part alone. The label stays for the rows that keep it.',
    input: inputOf({ label: TEXT, rows: ROWS }),
    refs: { label: LABEL_RECORDS.name, 'rows.row': LEDGER_RECORDS.name, 'rows.part': ITEM_RECORDS.name },
    creates: null,
    alone: false,
    example: { label: 'label', rows: [{ row: 'ledger-row-split', part: null }] },
  },
]

function refuseName(name: string, labels: readonly Label[], own: RecordId | null): void {
  const problem = labelNameProblem(name, labels, own)
  if (problem === 'blank') throw new StepRefused('A label needs a name.')
  if (problem === 'taken') throw new StepRefused(`Another label is called ${name.trim()} once case and accents are set aside, so use that one.`)
}

/** The rows a step names and the parts it names alone, each part refused unless it is one of its row's own. */
function pickedRows(card: CompanyCard, given: readonly { readonly row: string; readonly part: string | null }[]): { readonly rows: readonly Transaction[]; readonly parts: ReadonlySet<RecordId> } {
  const items = card.records().items
  const rows = new Map<string, Transaction>()
  const parts = new Set<RecordId>()
  for (const { row: ref, part } of given) {
    const row = rowOf(card, ref)
    rows.set(row.id, row)
    if (part === null) continue
    const named = storedItemsOfRow(items, row).find((item) => item.id === card.idOf(part))
    if (named === undefined) throw new StepRefused("A part is one of its row's own parts, as get_record of the row lists them.")
    parts.add(named.id)
  }
  return { rows: [...rows.values()], parts }
}

/** Writes a label step through the writes Labels and Transactions use. A label add-label makes is named by its `$` name in a later step. */
function planLabelStep(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const { labels } = card.workbook
  if (step.operation === 'add-label') {
    refuseName(field['name'], labels, null)
    const label = newLabel(field['name'])
    addLabel(card.unit, label)
    card.made(step.as, label.id)
    return
  }
  const label = found(labels, card.idOf(field['label']), 'label')
  if (step.operation === 'rename-label') {
    refuseName(field['name'], labels, label.id)
    renameLabel(card.unit, label, field['name'])
  } else if (step.operation === 'delete-label') {
    deleteLabel(card.unit, card.records(), label)
  } else {
    const records = card.records()
    if (!storesItems(records)) throw new StepRefused('These books keep their rows the way older versions of Kuna did, so they keep no labels. Propose move-to-items first.')
    const { rows, parts } = pickedRows(card, field['rows'])
    labelRows(card.unit, records, rows, label.id, step.operation === 'label-rows', parts)
  }
}

/** What Labels and the picked rows on Transactions do: add, rename and delete a label, and put one on rows or one of their parts, or take it off. */
export const LABEL_OPERATIONS: CompanyOperationSet = {
  operations: OPERATIONS,
  planStep: planLabelStep,
}
