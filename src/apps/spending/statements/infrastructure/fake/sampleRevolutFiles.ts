import { addDays } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'

const HEADER = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance']

export const SAMPLE_REVOLUT_FILE_NAME = 'account-statement-sample.csv'
export const SAMPLE_REFUSED_FILE_NAME = 'account-statement-no-fee.csv'

/** One row of the made-up export, `back` days before the day. */
function row(day: CivilDate, back: number, type: string, description: string, amount: string, fee: string, currency: string, state: string, product = 'Current'): string[] {
  const started = `${addDays(day, -back)} 09:30:00`
  return [type, product, started, started, description, amount, fee, currency, state, '']
}

/**
 * The rows of the fake build's Revolut export, oldest first: one already on the file, a coffee that fills the typed one, a
 * top-up that pairs with OTP's debit, a payment with a fee, a payment a rule files, one that waits on review, an exchange's
 * two legs, a pocket move whose savings side is left out, and a savings, a pending and a reverted row left out. Each one is made up.
 */
export function sampleRevolutRows(day: CivilDate): string[][] {
  return [
    HEADER,
    row(day, 10, 'CARD_PAYMENT', 'Harbour bistro', '-32.00', '0.00', 'EUR', 'COMPLETED'),
    row(day, 2, 'CARD_PAYMENT', 'Café on the square', '-4.20', '0.00', 'EUR', 'COMPLETED'),
    row(day, 1, 'TOPUP', 'Top-up from OTP', '75.00', '0.00', 'EUR', 'COMPLETED'),
    row(day, 1, 'CARD_PAYMENT', 'Fuel station abroad', '-40.00', '1.00', 'EUR', 'COMPLETED'),
    row(day, 1, 'CARD_PAYMENT', 'Corner market', '-12.30', '0.00', 'EUR', 'COMPLETED'),
    row(day, 1, 'EXCHANGE', 'Exchanged to USD', '-54.00', '0.00', 'EUR', 'COMPLETED'),
    row(day, 1, 'EXCHANGE', 'Exchanged from EUR', '58.00', '0.00', 'USD', 'COMPLETED'),
    row(day, 1, 'TRANSFER', 'To pocket', '-5.00', '0.00', 'EUR', 'COMPLETED', 'Savings'),
    row(day, 1, 'TRANSFER', 'Pocket Summer trip', '-20.00', '0.00', 'EUR', 'COMPLETED'),
    row(day, 1, 'TRANSFER', 'From current', '20.00', '0.00', 'EUR', 'COMPLETED', 'Savings'),
    row(day, 0, 'CARD_PAYMENT', 'Unknown shop', '-9.99', '0.00', 'EUR', 'COMPLETED'),
    row(day, 0, 'CARD_PAYMENT', 'Waiting bakery', '-3.10', '0.00', 'EUR', 'PENDING'),
    row(day, 0, 'CARD_PAYMENT', 'Returned scarf', '-15.00', '0.00', 'EUR', 'REVERTED'),
  ]
}

function csvOf(rows: readonly (readonly string[])[]): string {
  return rows.map((cells) => cells.join(',')).join('\n')
}

export function sampleRevolutCsv(day: CivilDate): string {
  return csvOf(sampleRevolutRows(day))
}

/** The same export with no Fee column, which the reader refuses. */
export function sampleRefusedCsv(day: CivilDate): string {
  const fee = HEADER.indexOf('Fee')
  return csvOf(sampleRevolutRows(day).map((cells) => cells.filter((_cell, place) => place !== fee)))
}
