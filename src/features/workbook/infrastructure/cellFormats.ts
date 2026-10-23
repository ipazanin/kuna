import { packTabOf } from './packTabs'
import type { CellValue, CoreTab, WorkbookTab } from './workbookSnapshot'

export const DATE_FORMAT = 'yyyy-mm-dd'
export const AMOUNT_FORMAT = '#,##0.00'
export const RATE_FORMAT = '0.00%'

const COLUMN_FORMATS: Readonly<Partial<Record<CoreTab, Readonly<Record<string, string>>>>> = {
  ledger: { date: DATE_FORMAT, amount: AMOUNT_FORMAT, balance: AMOUNT_FORMAT },
  invoices: { amount: AMOUNT_FORMAT, issued: DATE_FORMAT, due: DATE_FORMAT, period_from: DATE_FORMAT, period_to: DATE_FORMAT },
  'outgoing-plan': { date: DATE_FORMAT, amount: AMOUNT_FORMAT },
  splits: { date: DATE_FORMAT, row_amount: AMOUNT_FORMAT, row_balance: AMOUNT_FORMAT, amount: AMOUNT_FORMAT },
  dismissed: { dismissed_on: DATE_FORMAT },
}

/**
 * The number format a number in this cell takes, by its tab and column, a pack's tab by the pack's
 * own formats. Null for a column the template keeps as typed.
 */
export function numberFormatOf(tab: WorkbookTab, column: string, cellOf: (column: string) => CellValue | undefined): string | null {
  const pack = packTabOf(tab)
  return pack === null ? (COLUMN_FORMATS[tab as CoreTab]?.[column] ?? null) : pack.numberFormat(column, cellOf)
}

/** Whether the cell holds a date as its serial number, so a person reads it as a day. */
export function isDateCell(tab: WorkbookTab, column: string, cellOf: (column: string) => CellValue | undefined): boolean {
  return typeof cellOf(column) === 'number' && numberFormatOf(tab, column, cellOf) === DATE_FORMAT
}
