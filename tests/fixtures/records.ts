import { cellText } from '../../src/shared/text/cellText'
import type { WorkbookStore } from '../../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../../src/apps/company/workbook/domain/readWorkbook'
import { recordsOfKindIn } from '../../src/apps/company/workbook/domain/readWorkbook'
import type { RecordId } from '../../src/shared/storage/domain/recordId'
import type { RecordKind } from '../../src/shared/storage/domain/recordKind'
import type { ReadRecord, RecordsRead } from '../../src/shared/storage/domain/recordsRead'
import { recordsOfRows, spreadsheetTabOfKind } from '../../src/apps/company/workbook/infrastructure/spreadsheetTab'
import type { Cells } from '../../src/apps/company/workbook/infrastructure/spreadsheetTab'

function readOf<R>(kind: RecordKind<R>, cells: Cells): RecordsRead<R> {
  const filled = Object.fromEntries(Object.entries(cells).filter(([, cell]) => cellText(cell) !== ''))
  return recordsOfRows(spreadsheetTabOfKind(kind), [{ sheetRow: 2, cells: filled }])
}

/** The record a row of these cells reads as, a blank cell left out as a read leaves it, which fails the test when the kind's factory refuses it. */
export function recordOf<R>(kind: RecordKind<R>, cells: Cells): R {
  const read = readOf(kind, cells)
  const [made] = read.records
  if (made === undefined) {
    throw new Error(`The fixture's ${kind.noun.one} is refused: ${read.refused[0]?.reason}`)
  }
  return made.record
}

/** What the copy on screen holds of a kind. */
export function recordsOnScreen<R>(store: WorkbookStore<CompanyBooks>, kind: RecordKind<R>): RecordsRead<R> {
  return recordsOfKindIn(store.state.records!, kind)
}

/** The one record on screen with this identity. */
export function recordOnScreen<R>(store: WorkbookStore<CompanyBooks>, kind: RecordKind<R>, id: RecordId): ReadRecord<R> {
  const holding = recordsOnScreen(store, kind).records.filter((stored) => stored.id === id)
  if (holding.length !== 1) {
    throw new Error(`${holding.length} ${kind.noun.many} on screen hold ${id}.`)
  }
  return holding[0]!
}
