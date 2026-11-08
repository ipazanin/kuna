import type { SpendingBook, SpendingRecords } from './readSpendingBook'

/** The app of the hub whose file this is. */
export const SPENDING_APP = 'spending'

/** The Spending book the file holds, with the name of the file on screen. */
export interface SpendingWorkbook extends SpendingBook {
  readonly title: string
}

/** What the Spending app reads from its file: its records of each kind and the book they make. */
export interface SpendingBooks {
  readonly records: SpendingRecords
  readonly workbook: SpendingWorkbook
}
