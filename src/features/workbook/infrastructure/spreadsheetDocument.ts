import { cellText } from '../../../shared/text/cellText'
import { codecOfKind } from '../application/recordCodecs'
import { ID_FIELD } from '../domain/recordCodec'
import type { RecordFields } from '../domain/recordFields'
import { newRecordId, recordIdOf } from '../domain/recordId'
import { LEDGER_RECORDS } from '../domain/recordKind'
import { refusalOr } from '../domain/storedFields'
import type { StoredField } from '../domain/storedFields'
import type { CellFormat } from './cellFormats'
import { storedFieldsOfCells } from './cellReading'
import { fieldValueOf } from './documentFormat'
import type { DocumentRecord, WorkbookDocument } from './documentFormat'
import { newDocument } from './documentRecordStorage'
import { installedPackTabs } from './packTabs'
import { CORE_TABS, cellsOfFields, spreadsheetTabOfKind } from './spreadsheetTab'
import type { SpreadsheetTab } from './spreadsheetTab'
import { EMPTY_TABS } from './workbookSnapshot'
import type { SheetRow, WorkbookTabs } from './workbookSnapshot'

/** Every tab mapping, core's and the installed pack's, in the order the document lists its kinds. */
function spreadsheetTabs(): readonly SpreadsheetTab<unknown>[] {
  return [...Object.values(CORE_TABS), ...installedPackTabs()] as readonly SpreadsheetTab<unknown>[]
}

/** A cell's field as the file holds it: a day in a date column as `yyyy-mm-dd`, a flag as a flag, anything else as its text. */
function documentValueOf(field: StoredField, format: CellFormat | null): string | boolean {
  if (field.flag !== null) {
    return field.flag
  }
  return format === 'date' && field.date !== null ? field.date : field.text
}

/**
 * A row as a record of the file, moved as stored: each cell by its column's format, so nothing is
 * repaired on the way. A ledger row the factory reads and that has no id gets one.
 */
function documentRecordOfRow(mapping: SpreadsheetTab<unknown>, row: SheetRow): DocumentRecord {
  const fields = storedFieldsOfCells(row.cells)
  const fieldOf = (column: string): string => cellText(row.cells[column]).toLowerCase()
  const record = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, documentValueOf(field, mapping.formatOf(name, fieldOf))]))
  if (mapping.kind.name !== LEDGER_RECORDS.name || ID_FIELD in record) {
    return record
  }
  const codec = codecOfKind(mapping.kind)
  const key = codec.key(fields)
  const read = refusalOr(() => codec.make(fields, key === null ? null : recordIdOf(mapping.kind, key)))
  return 'made' in read ? { ...record, [ID_FIELD]: newRecordId() } : record
}

/** The workbook of an xlsx file as the app's document: every record of every tab, in the order of the rows. */
export function documentOfTabs(app: string, tabs: WorkbookTabs, savedAt: string): WorkbookDocument {
  return newDocument(
    app,
    Object.fromEntries(spreadsheetTabs().map((mapping) => [mapping.kind.name, [...tabs[mapping.tab]].sort((upper, lower) => upper.sheetRow - lower.sheetRow).map((row) => documentRecordOfRow(mapping, row))])),
    savedAt,
  )
}

/** How many records the document holds of each kind, named by the tab an xlsx file keeps them on, or by the kind's name where no tab maps it. Empty kinds are left out. */
export function recordCountsOf(document: WorkbookDocument): readonly { readonly name: string; readonly count: number }[] {
  const tabs = new Map(spreadsheetTabs().map((mapping) => [mapping.kind.name, mapping.tab]))
  return Object.entries(document.records)
    .filter(([, records]) => records.length > 0)
    .map(([kind, records]) => ({ name: tabs.get(kind) ?? kind, count: records.length }))
}

/** A record of the file as its fields, a value the app does not read left out. */
function fieldsOfRecord(record: DocumentRecord): RecordFields {
  return Object.fromEntries(
    Object.entries(record).flatMap(([name, value]) => {
      const field = fieldValueOf(value)
      return field === null ? [] : [[name, field]]
    }),
  )
}

/** The document as the tabs of an xlsx file, each record a row of its kind's tab in the order the document holds them. A kind no tab maps is left out. */
export function tabsOfDocument(document: WorkbookDocument): WorkbookTabs {
  const tabs = Object.fromEntries(
    spreadsheetTabs().map((mapping) => [
      mapping.tab,
      (document.records[mapping.kind.name] ?? []).map((record, index): SheetRow => {
        const cells = cellsOfFields(spreadsheetTabOfKind(mapping.kind), fieldsOfRecord(record))
        return { sheetRow: index + 2, cells: Object.fromEntries(Object.entries(cells).filter(([, cell]) => cellText(cell) !== '')) }
      }),
    ]),
  )
  return { ...EMPTY_TABS, ...tabs }
}
