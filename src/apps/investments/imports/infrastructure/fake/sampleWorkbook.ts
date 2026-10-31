import { WORKBOOK_COLUMNS } from '../../domain/portfolioWorkbook'
import { parseCivilDate, serialFromCivilDate } from '../../../../../shared/calendar/civilDate'

/**
 * A made-up portfolio workbook for the fake build's import: two accounts at one broker and one at another, with a
 * deposit, an exchange, buys of the fake prices file's shares and fund, a dividend with its withholding and one
 * withholding with no dividend, interest, a fee with a half cent, a refund, a split, a spin-off, a sale, transfers of
 * cash and of units, a dividend booked net, two equal referral credits, a withdrawal and a row of a kind Kuna does not
 * read. Every account, symbol and figure is made up.
 */
export const SAMPLE_WORKBOOK_FILE_NAME = 'example-portfolio.xlsx'

type Column = keyof typeof WORKBOOK_COLUMNS
type Cells = Partial<Record<Column, string | number>>

const MAIN = { broker: 'IBKR', account: 'U0000001', sourceFile: 'activity-2025.csv' } as const
const SECOND = { broker: 'IBKR', account: 'U0000002', sourceFile: 'activity-2025.csv' } as const
const REVOLUT = { broker: 'Revolut', account: 'RVL-1', sourceFile: 'trading-statement.csv' } as const
const ABC = { yahooSymbol: 'ABC', brokerSymbol: 'ABC', isin: 'US0000000001' } as const
const DEF = { yahooSymbol: 'DEF', brokerSymbol: 'DEF' } as const
const XYZ = { yahooSymbol: 'XYZ.DE', brokerSymbol: 'XYZ', isin: 'IE0000000002' } as const
const NEWCO = { yahooSymbol: 'NEWCO', brokerSymbol: 'NEWCO' } as const
const DIVIDEND_NOTE = 'ABC(US0000000001) Cash Dividend USD 0.36 per Share'

const COLUMNS = Object.keys(WORKBOOK_COLUMNS) as Column[]

function line(date: string, cells: Cells): (string | number)[] {
  return COLUMNS.map((column) => (column === 'date' ? serialFromCivilDate(parseCivilDate(date)!) : (cells[column] ?? '')))
}

/** The Transactions tab under a title row, its columns named as the workbook names them. */
export function sampleWorkbookGrid(): (string | number)[][] {
  return [
    ['Portfolio transactions, made up'],
    COLUMNS.map((column) => WORKBOOK_COLUMNS[column]),
    line('2025-01-02', { ...MAIN, type: 'DEPOSIT', currency: 'EUR', netCash: 5000, note: 'Electronic fund transfer' }),
    line('2025-01-03', { ...MAIN, type: 'FX', currency: 'EUR', commission: 2, netCash: -1002, counterCurrency: 'USD', counterAmount: 1100 }),
    line('2025-01-06', { ...MAIN, ...ABC, time: '15:30:00', type: 'BUY', quantity: 6, price: 150, currency: 'USD', gross: -900, commission: 1, netCash: -901 }),
    line('2025-02-03', { ...MAIN, ...ABC, time: '15:41:07', type: 'BUY', quantity: 1, price: 152, currency: 'USD', gross: -152, commission: 0.35, netCash: -153 }),
    line('2025-02-10', { ...MAIN, ...ABC, type: 'CORPORATE ACTION', note: 'ABC tender offer, not taken' }),
    line('2025-03-14', { ...MAIN, ...ABC, type: 'DIVIDEND', currency: 'USD', gross: 2.52, netCash: 2.52, note: DIVIDEND_NOTE }),
    line('2025-03-14', { ...MAIN, ...ABC, type: 'WITHHOLDING TAX', currency: 'USD', netCash: -0.38, note: `${DIVIDEND_NOTE} - US Tax` }),
    line('2025-04-01', { ...MAIN, ...ABC, type: 'WITHHOLDING TAX', currency: 'USD', netCash: -0.1, note: `${DIVIDEND_NOTE} - US Tax` }),
    line('2025-04-30', { ...MAIN, type: 'INTEREST', currency: 'EUR', gross: 3.2, netCash: 3.2, note: 'EUR Credit Interest for Apr-2025' }),
    line('2025-04-30', { ...MAIN, type: 'WITHHOLDING TAX', currency: 'EUR', netCash: -0.32, note: 'EUR Credit Interest for Apr-2025 - Tax' }),
    line('2025-05-02', { ...MAIN, type: 'FEE', currency: 'EUR', netCash: -3.005, note: 'Market data' }),
    line('2025-05-05', { ...MAIN, type: 'FEE REFUND', currency: 'EUR', netCash: 1, note: 'Market data refund' }),
    line('2025-06-10', { ...MAIN, ...ABC, type: 'SPLIT', quantity: 7, note: 'ABC(US0000000001) Split 2 for 1' }),
    line('2025-07-01', { ...MAIN, ...NEWCO, type: 'SPINOFF', quantity: 2, price: 12, currency: 'USD', note: 'NEWCO spun off from ABC' }),
    line('2025-08-01', { ...MAIN, ...ABC, time: '16:02:44', type: 'SELL', quantity: -5, price: 80.000000000000014, currency: 'USD', gross: 400, commission: 1, netCash: 399 }),
    line('2025-08-15', { ...MAIN, type: 'INTERNAL CASH TRANSFER', currency: 'EUR', netCash: -500 }),
    line('2025-08-15', { ...SECOND, type: 'INTERNAL CASH TRANSFER', currency: 'EUR', netCash: 500 }),
    line('2025-09-01', { ...MAIN, ...ABC, type: 'TRANSFER OUT', quantity: -4 }),
    line('2025-09-01', { ...SECOND, ...ABC, type: 'TRANSFER IN', quantity: 4 }),
    line('2025-10-06', { ...SECOND, ...XYZ, type: 'BUY', quantity: 3, price: 110, currency: 'EUR', gross: -330, commission: 1, netCash: -331 }),
    line('2025-10-20', { ...SECOND, type: 'WITHDRAWAL', currency: 'EUR', netCash: -100 }),
    line('2025-11-03', { ...REVOLUT, type: 'DEPOSIT', currency: 'USD', netCash: 220, revolutRate: 1.095 }),
    line('2025-11-04', { ...REVOLUT, ...DEF, type: 'BUY', quantity: 2, price: 60, currency: 'USD', netCash: -120 }),
    line('2025-12-15', { ...REVOLUT, ...DEF, type: 'DIVIDEND', currency: 'USD', gross: 1.7, netCash: 1.7 }),
    line('2026-01-05', { ...REVOLUT, time: '09:00:00', type: 'REFERRAL CREDIT', currency: 'EUR', gross: 10, netCash: 10 }),
    line('2026-01-05', { ...REVOLUT, time: '09:00:00', type: 'REFERRAL CREDIT', currency: 'EUR', gross: 10, netCash: 10 }),
  ]
}

/** The workbook as xlsx bytes, with a working tab of its owner's that the import never reads, written by SheetJS, which loads only now. */
export async function sampleWorkbookFile(): Promise<Uint8Array> {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['Check', 'Result'],
      ['Cash agrees with the statements', 'TRUE'],
    ]),
    'Checks',
  )
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sampleWorkbookGrid()), 'Transactions')
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
