import { cellText } from '../../../shared/text/cellText'
import { slugOf } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** Where an added row goes: above row `before` of the read. */
export interface AddedPlace {
  readonly index: number
  readonly before: number
}

/**
 * Where each row added to the `ledger` tab goes, so the tab keeps reading newest first for a person
 * reading the Sheet: a statement's rows go in together above the first row whose day is not after
 * the statement's newest day, the statements one after another, each placed among the rows the ones
 * before it put in.
 */
export function placeLedgerRows(rows: readonly SheetRow[], added: readonly SheetRow['cells'][], lastRow: number): AddedPlace[] {
  const slots: { readonly readAs: number | null; readonly date: number; readonly index: number }[] = [...rows]
    .sort((upper, lower) => upper.sheetRow - lower.sheetRow)
    .map((row) => ({ readAs: row.sheetRow, date: typeof row.cells.date === 'number' ? row.cells.date : Number.NEGATIVE_INFINITY, index: -1 }))
  let start = 0
  while (start < added.length) {
    const statement = cellText(added[start]!.statement)
    const account = slugOf(added[start]!.account)
    let end = start
    while (end < added.length && cellText(added[end]!.statement) === statement && slugOf(added[end]!.account) === account) end += 1
    const block = added.slice(start, end).map((cells, offset) => ({ readAs: null, date: typeof cells.date === 'number' ? cells.date : 0, index: start + offset }))
    const newest = Math.max(...block.map((slot) => slot.date))
    const position = slots.findIndex((slot) => slot.date <= newest)
    slots.splice(position < 0 ? slots.length : position, 0, ...block)
    start = end
  }
  const places: AddedPlace[] = []
  let before = lastRow + 1
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index]!
    if (slot.readAs === null) {
      places.unshift({ index: slot.index, before })
    } else {
      before = slot.readAs
    }
  }
  return places
}

/** The row each row put in lands on once all of them are in, given the row each goes above. Rows sharing a place keep their order. */
export function insertedRowNumbers(befores: readonly number[]): number[] {
  return befores.map((before, index) => before + befores.filter((other, otherIndex) => other < before || (other === before && otherIndex < index)).length)
}
