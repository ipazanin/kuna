export const DATE_FORMAT = 'yyyy-mm-dd'

/**
 * What a column holds as a number cell: a day as its serial number, an amount, a rate as a fraction,
 * a whole count, or a plain number. A column without one keeps its fields as text.
 */
export type CellFormat = 'date' | 'amount' | 'rate' | 'count' | 'number'

/** A column's cell format, which may follow other fields of the record, read as lower-case text. Null for a column kept as text. */
export type CellFormatOf = (column: string, fieldOf: (column: string) => string) => CellFormat | null

/** The cell formats of a tab whose columns each keep one format. */
export function byColumn(formats: Readonly<Record<string, CellFormat>>): CellFormatOf {
  return (column) => formats[column] ?? null
}

const NUMBER_FORMATS: Readonly<Record<CellFormat, string | null>> = {
  date: DATE_FORMAT,
  amount: '#,##0.00',
  rate: '0.00%',
  count: '0',
  number: null,
}

/** The number format a cell of this format shows its number in. Null for a number shown as typed. */
export function numberFormatOfCell(format: CellFormat | null): string | null {
  return format === null ? null : NUMBER_FORMATS[format]
}
