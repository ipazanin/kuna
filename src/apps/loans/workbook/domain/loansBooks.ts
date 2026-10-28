import type { LoanBook, LoansRecords } from './readLoanBook'

/** The loans the file holds, with the name of the file on screen. */
export interface LoansWorkbook extends LoanBook {
  readonly title: string
}

/** What the Loans app reads from its file: its records of each kind and the loans they make. */
export interface LoansBooks {
  readonly records: LoansRecords
  readonly workbook: LoansWorkbook
}
