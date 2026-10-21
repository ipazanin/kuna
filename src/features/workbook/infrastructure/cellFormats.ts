import { YEAR_END_STATEMENTS, yearEndLineDefinition } from '../domain/yearEnd'
import type { YearEndFigureKind, YearEndStatement } from '../domain/yearEnd'
import type { CellValue, WorkbookTab } from './workbookSnapshot'

export const DATE_FORMAT = 'yyyy-mm-dd'
const AMOUNT_FORMAT = '#,##0.00'
const RATE_FORMAT = '0.00%'

const COLUMN_FORMATS: Readonly<Partial<Record<WorkbookTab, Readonly<Record<string, string>>>>> = {
  ledger: { date: DATE_FORMAT, amount: AMOUNT_FORMAT, balance: AMOUNT_FORMAT },
  invoices: { amount: AMOUNT_FORMAT, issued: DATE_FORMAT, due: DATE_FORMAT, period_from: DATE_FORMAT, period_to: DATE_FORMAT },
  'outgoing-plan': { date: DATE_FORMAT, amount: AMOUNT_FORMAT },
  'owner-advances': { date: DATE_FORMAT, amount: AMOUNT_FORMAT },
  assets: { bought: DATE_FORMAT, in_use: DATE_FORMAT, cost_net: AMOUNT_FORMAT, disposed: DATE_FORMAT },
  grants: {
    received: DATE_FORMAT,
    amount: AMOUNT_FORMAT,
    fixed_part: AMOUNT_FORMAT,
    variable_part: AMOUNT_FORMAT,
    period_from: DATE_FORMAT,
    period_to: DATE_FORMAT,
    clawback_year1: AMOUNT_FORMAT,
    clawback_year2: AMOUNT_FORMAT,
    employment_required_until: DATE_FORMAT,
  },
  plan: { amount: AMOUNT_FORMAT, date: DATE_FORMAT },
  scenarios: { amount: AMOUNT_FORMAT, from: DATE_FORMAT, to: DATE_FORMAT },
  splits: { date: DATE_FORMAT, row_amount: AMOUNT_FORMAT, row_balance: AMOUNT_FORMAT, amount: AMOUNT_FORMAT },
  dismissed: { dismissed_on: DATE_FORMAT },
}

const FIGURE_FORMATS: Readonly<Record<YearEndFigureKind, string>> = { money: AMOUNT_FORMAT, date: DATE_FORMAT, rate: RATE_FORMAT, count: '0' }

/**
 * The number format a number in this cell takes, by its tab and column. The `year-end` amount
 * holds a date, a rate or a count on some lines, so its format follows the row's line. Null for a
 * column the template keeps as typed.
 */
export function numberFormatOf(tab: WorkbookTab, column: string, cellOf: (column: string) => CellValue | undefined): string | null {
  if (tab === 'year-end' && column === 'amount') {
    const textOf = (name: string): string => String(cellOf(name) ?? '').trim().toLowerCase()
    const statement = textOf('statement')
    const definition = (YEAR_END_STATEMENTS as readonly string[]).includes(statement) ? yearEndLineDefinition(statement as YearEndStatement, textOf('line')) : null
    return FIGURE_FORMATS[definition?.kind ?? 'money']
  }
  return COLUMN_FORMATS[tab]?.[column] ?? null
}

/** Whether the cell holds a date as its serial number, so a person reads it as a day. */
export function isDateCell(tab: WorkbookTab, column: string, cellOf: (column: string) => CellValue | undefined): boolean {
  return typeof cellOf(column) === 'number' && numberFormatOf(tab, column, cellOf) === DATE_FORMAT
}
