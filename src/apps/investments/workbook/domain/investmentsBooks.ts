import type { InvestmentBookReading, InvestmentsRecords } from './readInvestmentBook'

/** The records that count with the name of the file on screen. */
export interface InvestmentsWorkbook extends InvestmentBookReading {
  readonly title: string
}

/** What the Investments app reads from its file: its records of each kind and the book they make. */
export interface InvestmentsBooks {
  readonly records: InvestmentsRecords
  readonly workbook: InvestmentsWorkbook
}
