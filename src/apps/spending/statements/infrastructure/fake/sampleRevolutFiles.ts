import { fakeHomeLoanShare, latestFakeHomeLoanDue } from '../../../workbook/infrastructure/fake/fakeHomeLoan'
import { addDays, daysBetween } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../../shared/calendar/monthKey'

const HEADER = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance']

export const SAMPLE_REVOLUT_FILE_NAME = 'account-statement-sample.csv'
export const SAMPLE_REFUSED_FILE_NAME = 'account-statement-no-fee.csv'
export const SAMPLE_MISSING_FILE_NAME = 'account-statement-gbp-chf.csv'
export const SAMPLE_LOAN_FILE_NAME = 'account-statement-loan.csv'
export const SAMPLE_MANY_SHOPS_FILE_NAME = 'account-statement-many-shops.csv'

/** One row of the made-up export, `back` days before the day. */
function row(day: CivilDate, back: number, type: string, description: string, amount: string, fee: string, currency: string, state: string, product = 'Current'): string[] {
  const started = `${addDays(day, -back)} 09:30:00`
  return [type, product, started, started, description, amount, fee, currency, state, '']
}

/**
 * The rows of the fake build's Revolut export, oldest first: one already on the file, a coffee that fills the typed one, a
 * top-up that pairs with OTP's debit, a payment with a fee, a payment a rule files, one that waits on review, an exchange's
 * two legs, a pocket move whose savings side is left out, cash taken out at a cash machine, and a savings, a pending and a
 * reverted row left out. Each one is made up.
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
    row(day, 0, 'ATM', 'Cash at Ilica ATM', '-40.00', '0.00', 'EUR', 'COMPLETED'),
    row(day, 0, 'CARD_PAYMENT', 'Unknown shop', '-9.99', '0.00', 'EUR', 'COMPLETED'),
    row(day, 0, 'CARD_PAYMENT', 'Waiting bakery', '-3.10', '0.00', 'EUR', 'PENDING'),
    row(day, 0, 'CARD_PAYMENT', 'Returned scarf', '-15.00', '0.00', 'EUR', 'REVERTED'),
  ]
}

/** A made-up export of twelve card payments at shops no rule or typed row knows, so all of them wait on review at once. */
export function sampleManyShopsRows(day: CivilDate): string[][] {
  const shops = ['Bike repair', 'Flower stall', 'Key cutter', 'Shoe mender', 'Toy shop', 'Paint shop', 'Garden centre', 'Tea house', 'Print shop', 'Music shop', 'Frame maker', 'Map shop']
  return [HEADER, ...shops.map((shop, place) => row(day, 4, 'CARD_PAYMENT', shop, `-${place + 11}.40`, '0.00', 'EUR', 'COMPLETED'))]
}

export function sampleManyShopsCsv(day: CivilDate): string {
  return csvOf(sampleManyShopsRows(day))
}

function csvOf(rows: readonly (readonly string[])[]): string {
  return rows.map((cells) => cells.join(',')).join('\n')
}

export function sampleRevolutCsv(day: CivilDate): string {
  return csvOf(sampleRevolutRows(day))
}

/** A made-up export of one row: the fake home loan's latest instalment paid from Revolut on its due date, at your share of its plan. */
export function sampleLoanCsv(day: CivilDate): string {
  const due = latestFakeHomeLoanDue(day)
  return csvOf([HEADER, row(day, daysBetween(due, day), 'TRANSFER', 'Example Bank', String(-fakeHomeLoanShare(monthOf(due))), '0.00', 'EUR', 'COMPLETED')])
}

/** The same export with no Fee column, which the reader refuses. */
export function sampleRefusedCsv(day: CivilDate): string {
  const fee = HEADER.indexOf('Fee')
  return csvOf(sampleRevolutRows(day).map((cells) => cells.filter((_cell, place) => place !== fee)))
}

/** A made-up export in GBP and CHF, which no account of the statements set keeps, with the balances Revolut prints after each row. */
export function sampleMissingAccountsRows(day: CivilDate): string[][] {
  const withBalance = (cells: string[], balance: string): string[] => [...cells.slice(0, -1), balance]
  return [
    HEADER,
    withBalance(row(day, 6, 'CARD_PAYMENT', 'Book shop', '-18.50', '0.00', 'GBP', 'COMPLETED'), '231.50'),
    withBalance(row(day, 4, 'TOPUP', 'Top-up from OTP', '100.00', '0.00', 'GBP', 'COMPLETED'), '331.50'),
    withBalance(row(day, 3, 'CARD_PAYMENT', 'Mountain railway', '-42.00', '0.50', 'CHF', 'COMPLETED'), '57.50'),
  ]
}

export function sampleMissingAccountsCsv(day: CivilDate): string {
  return csvOf(sampleMissingAccountsRows(day))
}

export const SAMPLE_RENAMED_FILE_NAME = 'promet-primjer-banke.csv'

/** A day as the made-up bank writes it, such as 07.11.2026. */
function writtenDay(day: CivilDate): string {
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}

/**
 * A made-up export of the bank the fake statements set keeps a recipe for, after the bank renamed its amount column from
 * Iznos to Iznos EUR, so the saved recipe no longer reads it until its amount column is changed.
 */
export function sampleRenamedColumnCsv(day: CivilDate): string {
  return [
    'Datum;Opis;Iznos EUR',
    `${writtenDay(addDays(day, -3))};Gradska ljekarna;-12,40`,
    `${writtenDay(addDays(day, -2))};Pekara na uglu;-3,80`,
    `${writtenDay(addDays(day, -1))};Povrat poreza;150,00`,
  ].join('\n')
}
