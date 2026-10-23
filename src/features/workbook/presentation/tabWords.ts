import type { RecordKind } from '../domain/recordKind'
import { spreadsheetTabOfKind } from '../infrastructure/spreadsheetTab'
import { contentColumns } from '../infrastructure/workbookTemplate'

/** The columns a person gives the tab that holds a kind, as "item, date, amount". */
export function columnsInWords(kind: RecordKind<unknown>): string {
  return contentColumns(spreadsheetTabOfKind(kind).tab).join(', ')
}
