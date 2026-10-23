import { storedFieldOf } from '../domain/storedFields'
import type { StoredFields } from '../domain/storedFields'
import type { CellValue, SheetRow } from './workbookSnapshot'

export function textOf(cell: CellValue | undefined): string {
  return cell === undefined ? '' : String(cell).trim()
}

export function slugOf(cell: CellValue | undefined): string {
  return textOf(cell).toLowerCase()
}

/** A row's filled cells as fields, by header. */
export function fieldsOf(cells: SheetRow['cells']): StoredFields {
  return Object.fromEntries(Object.entries(cells).map(([name, cell]) => [name, storedFieldOf(cell)]))
}
