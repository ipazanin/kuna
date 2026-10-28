import { cellText } from '../../src/shared/text/cellText'
import type { WorkbookStore } from '../../src/apps/company/workbook/application/createWorkbookStore'
import { codecOfKind } from '../../src/apps/company/workbook/application/recordCodecs'
import type { WriteReceipt } from '../../src/shared/storage/application/recordWrites'
import { newRecordId } from '../../src/shared/storage/domain/recordId'
import type { RecordKind } from '../../src/shared/storage/domain/recordKind'
import type { WriteRules } from '../../src/shared/storage/domain/writeRules'
import { cellsOfRecord, spreadsheetTabOfKind } from '../../src/apps/company/workbook/infrastructure/spreadsheetTab'
import type { Cells } from '../../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { recordsOfDocument } from '../../src/shared/storage/infrastructure/documentRecordStorage'
import type { DocumentCopy } from '../../src/shared/storage/infrastructure/documentRecordStorage'
import { ID_FIELD } from '../../src/shared/storage/domain/recordCodec'
import { TABS_WITH_IDS } from './rowIds'
import { recordOf } from './records'

type Store = WorkbookStore<DocumentCopy>

function carriesIds(kind: RecordKind<unknown>): boolean {
  return (TABS_WITH_IDS as readonly string[]).includes(spreadsheetTabOfKind(kind).tab)
}

/** The record the copy on screen holds at this row of the kind's tab, as the xlsx file it was opened from numbers it: the first record is row 2. */
export function recordOnRow<R>(store: Store, kind: RecordKind<R>, sheetRow: number): R {
  const document = store.state.snapshot!.document
  const record = document.records[kind.name]?.[sheetRow - 2]
  if (record === undefined) throw new Error(`No ${kind.noun.one} at row ${sheetRow}`)
  const [read] = recordsOfDocument({ ...document, records: { [kind.name]: [record] } }, kind, codecOfKind).records
  if (read === undefined) throw new Error(`Row ${sheetRow} does not read as ${kind.noun.article} ${kind.noun.one}`)
  return read.record
}

/** The record a new row of these cells makes, with an id of its own on a kind whose records carry one and none is given. */
export function newRecordOf<R>(kind: RecordKind<R>, cells: Cells): R {
  return recordOf(kind, carriesIds(kind) && cellText(cells[ID_FIELD]) === '' ? { ...cells, [ID_FIELD]: newRecordId() } : cells)
}

/** One write of a kind as a screen makes it: records added from cells, records on these rows changed by these cells, and records on these rows removed. */
export interface RowsWrite {
  readonly added?: readonly Cells[]
  readonly changed?: readonly { readonly sheetRow: number; readonly cells: Cells }[]
  readonly removed?: readonly number[]
}

export function writeRows<R>(store: Store, rules: WriteRules<R>, rows: RowsWrite): Promise<WriteReceipt | null> {
  const kind = rules.kind
  const added = (rows.added ?? []).map((cells) => newRecordOf(kind, cells))
  const changed = (rows.changed ?? []).map(({ sheetRow, cells }) => {
    const before = recordOnRow(store, kind, sheetRow)
    return { before, after: recordOf(kind, { ...cellsOfRecord(spreadsheetTabOfKind(kind), before), ...cells }) }
  })
  const removed = (rows.removed ?? []).map((sheetRow) => recordOnRow(store, kind, sheetRow))
  return store.write('Written', (unit) => {
    const repository = unit.of(rules)
    added.forEach((record) => repository.add(record))
    changed.forEach(({ before, after }) => repository.change(before, after))
    removed.forEach((record) => repository.remove(record))
  })
}

export function addRows<R>(store: Store, rules: WriteRules<R>, ...added: Cells[]): Promise<WriteReceipt | null> {
  return writeRows(store, rules, { added })
}

export function editRow<R>(store: Store, rules: WriteRules<R>, sheetRow: number, cells: Cells): Promise<WriteReceipt | null> {
  return writeRows(store, rules, { changed: [{ sheetRow, cells }] })
}

export function removeRows<R>(store: Store, rules: WriteRules<R>, ...sheetRows: number[]): Promise<WriteReceipt | null> {
  return writeRows(store, rules, { removed: sheetRows })
}

/** The cells of the records a write added, changed to or removed, as their tab holds them. */
export function cellsOf(receipt: WriteReceipt | null, verb: 'add' | 'change' | 'remove'): Cells[] {
  return (receipt?.records ?? []).flatMap(({ change }) => {
    if (change.verb !== verb) return []
    const mapping = spreadsheetTabOfKind(change.kind)
    const record = change.verb === 'remove' ? change.before : change.verb === 'add' || change.verb === 'change' ? change.after : null
    return record === null ? [] : [Object.fromEntries(Object.entries(cellsOfRecord(mapping, record)).filter(([, cell]) => cellText(cell) !== ''))]
  })
}
