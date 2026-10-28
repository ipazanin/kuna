/** What the Loans app reads from its file: no records yet, and the name of the file on screen. */
export interface LoansBooks {
  readonly records: Readonly<Record<string, never>>
  readonly workbook: { readonly title: string }
}
