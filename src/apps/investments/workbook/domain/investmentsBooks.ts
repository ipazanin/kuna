import type { InvestmentBookReading, InvestmentsRecords } from './readInvestmentBook'

/** The title of an Investments file made in this browser. It is stored with the file, so it stays English. */
export const LOCAL_INVESTMENTS_TITLE = 'Investments file'

/** The records that count with the name of the file on screen. */
export interface InvestmentsWorkbook extends InvestmentBookReading {
  readonly title: string
}

/** What the Investments app reads from its file: its records of each kind and the book they make. */
export interface InvestmentsBooks {
  readonly records: InvestmentsRecords
  readonly workbook: InvestmentsWorkbook
}
