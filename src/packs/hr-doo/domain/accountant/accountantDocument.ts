import type { CellGrid, StatementCell } from '../../../../features/imports/domain/tabularStatement'
import { moneyFromAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { cellText } from '../../../../shared/text/cellText'

/** A tab of a workbook the accountant sends, by its name, with its cells from A1. */
export interface DocumentTab {
  readonly name: string
  readonly grid: CellGrid
}

/** Why a workbook could not be read, with the tab and the row as the spreadsheet numbers it when the reason has them. */
export interface DocumentRefusal {
  readonly tab: string | null
  readonly row: number | null
  readonly reason: string
}

export type DocumentReading<Document> = { readonly document: Document } | { readonly refusal: DocumentRefusal }

class DocumentRefused extends Error {
  readonly refusal: DocumentRefusal

  constructor(refusal: DocumentRefusal) {
    super(refusal.reason)
    this.refusal = refusal
  }
}

/** Stops a reading with the tab, the row from 1, and the reason. */
export function refuse(tab: string | null, row: number | null, reason: string): never {
  throw new DocumentRefused({ tab, row, reason })
}

/** The document the reader makes, or the refusal it stopped at. */
export function readingOf<Document>(read: () => Document): DocumentReading<Document> {
  try {
    return { document: read() }
  } catch (failure) {
    if (failure instanceof DocumentRefused) {
      return { refusal: failure.refusal }
    }
    throw failure
  }
}

/** A tab name or a label as the accountant typed it, trimmed and with its letters in one Unicode form. */
export function labelText(cell: StatementCell | undefined): string {
  return cellText(cell).normalize('NFC')
}

export function isBlankRow(row: readonly (StatementCell | undefined)[] | undefined): boolean {
  return row === undefined || row.every((cell) => labelText(cell) === '')
}

/** An amount cell, refused unless it holds a number. A blank cell is refused too unless `blank` says what it means. */
export function amountCell(tab: string, rowIndex: number, cell: StatementCell | undefined, what: string, blank?: Money): Money {
  if (typeof cell === 'number') {
    return moneyFromAmount(cell)
  }
  if (blank !== undefined && labelText(cell) === '') {
    return blank
  }
  return refuse(tab, rowIndex + 1, `${what} is not a number`)
}

export function gridRow(grid: CellGrid, rowIndex: number): readonly (StatementCell | undefined)[] {
  return grid[rowIndex] ?? []
}
