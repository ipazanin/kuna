import { OPTIONAL_COLUMNS, WORKBOOK_COLUMNS, WORKBOOK_TYPES } from '../domain/portfolioWorkbook'
import type { WorkbookType } from '../domain/portfolioWorkbook'
import { parseCivilDate, serialFromCivilDate } from '../../../../shared/calendar/civilDate'
import { sheetJs } from '../../../../shared/xlsx/sheetGrids'

export const PORTFOLIO_TEMPLATE_FILE_NAME = 'portfolio-workbook-template.xlsx'

type Column = keyof typeof WORKBOOK_COLUMNS | keyof typeof OPTIONAL_COLUMNS

/** The words of the How to fill tab, in the language on screen. The column headers and types stay as the reader reads them. */
export interface TemplateHelp {
  readonly tabName: string
  readonly columnHeader: string
  readonly typeHeader: string
  readonly meaningHeader: string
  readonly columns: Readonly<Record<Column, string>>
  readonly types: Readonly<Record<WorkbookType, string>>
  readonly notes: readonly string[]
}

/** Every column in the order the reader lists them, the optional ones last. */
const TITLES: Readonly<Record<Column, string>> = { ...WORKBOOK_COLUMNS, ...OPTIONAL_COLUMNS }
const COLUMNS = Object.keys(TITLES) as Column[]

type Cells = Partial<Record<Column, string | number>>

const BROKER = { broker: 'Example Broker', account: 'EXAMPLE-1', sourceFile: 'example-statement.csv' } as const
const ABC = { yahooSymbol: 'ABC', brokerSymbol: 'ABC', isin: 'US0000000001' } as const
const NEWCO = { yahooSymbol: 'NEWCO', brokerSymbol: 'NEWCO' } as const
const DIVIDEND_NOTE = 'ABC Cash Dividend USD 0.50 per Share'

function line(date: string, cells: Cells): (string | number)[] {
  return COLUMNS.map((column) => (column === 'date' ? serialFromCivilDate(parseCivilDate(date)!) : (cells[column] ?? '')))
}

/** Made-up rows of each kind the How to fill tab explains first. */
function exampleRows(): (string | number)[][] {
  return [
    line('2025-01-02', { ...BROKER, type: 'DEPOSIT', currency: 'EUR', netCash: 2000, note: 'Made-up deposit' }),
    line('2025-01-03', { ...BROKER, type: 'FX', currency: 'EUR', commission: 2, netCash: -1002, counterCurrency: 'USD', counterAmount: 1100 }),
    line('2025-01-06', { ...BROKER, ...ABC, time: '15:30:00', type: 'BUY', quantity: 10, price: 100, currency: 'USD', gross: -1000, commission: 1, netCash: -1001 }),
    line('2025-03-14', { ...BROKER, ...ABC, type: 'DIVIDEND', currency: 'USD', gross: 5, netCash: 5, note: DIVIDEND_NOTE }),
    line('2025-03-14', { ...BROKER, ...ABC, type: 'WITHHOLDING TAX', currency: 'USD', netCash: -0.75, note: `${DIVIDEND_NOTE} - US Tax` }),
    line('2025-06-10', { ...BROKER, ...ABC, type: 'SPLIT', quantity: 30, note: 'ABC split 4 for 1' }),
    line('2025-07-01', { ...BROKER, ...NEWCO, type: 'SPINOFF', quantity: 4, price: 12, currency: 'USD', spinOffFrom: 'ABC', costShare: 5.2051, note: 'NEWCO spun off from ABC' }),
  ]
}

/**
 * A portfolio workbook to fill in, as xlsx bytes: a Transactions tab with every column the reader reads and made-up
 * example rows, and a How to fill tab with a line for each column and each type. SheetJS loads only now.
 */
export async function portfolioTemplateFile(help: TemplateHelp): Promise<Uint8Array<ArrayBuffer>> {
  const XLSX = await sheetJs()
  const book = XLSX.utils.book_new()
  const transactions = XLSX.utils.aoa_to_sheet([COLUMNS.map((column) => TITLES[column]), ...exampleRows()])
  XLSX.utils.book_append_sheet(book, transactions, 'Transactions')
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      [help.columnHeader, help.meaningHeader],
      ...COLUMNS.map((column) => [TITLES[column], help.columns[column]]),
      [],
      [help.typeHeader, help.meaningHeader],
      ...WORKBOOK_TYPES.map((type) => [type, help.types[type]]),
      [],
      ...help.notes.map((note) => [note]),
    ]),
    help.tabName,
  )
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
