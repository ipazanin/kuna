import { amountOf } from '../../../shared/money/money'
import type { Transaction } from '../../workbook/domain/workbook'

const COLUMNS: readonly { readonly header: string; readonly cell: (transaction: Transaction) => string }[] = [
  { header: 'date', cell: (transaction) => transaction.date },
  { header: 'account', cell: (transaction) => transaction.account },
  { header: 'counterparty', cell: (transaction) => transaction.counterparty },
  { header: 'counterparty_iban', cell: (transaction) => transaction.counterpartyIban },
  { header: 'description', cell: (transaction) => transaction.description },
  { header: 'amount', cell: (transaction) => amountOf(transaction.amount).toFixed(2) },
  { header: 'balance', cell: (transaction) => amountOf(transaction.balance).toFixed(2) },
  { header: 'category', cell: (transaction) => transaction.category },
  { header: 'bucket', cell: (transaction) => transaction.bucket },
  { header: 'flagged_by', cell: (transaction) => transaction.flaggedBy },
  { header: 'reference', cell: (transaction) => transaction.reference },
]

/**
 * The rows as CSV with the ledger's own column names, amounts as plain decimals with a point. Text
 * that a spreadsheet would run as a formula gets a leading apostrophe, so opening the file in
 * Sheets or Excel never evaluates a payee name.
 */
export function transactionsCsv(transactions: readonly Transaction[]): string {
  const lines = [
    COLUMNS.map((column) => column.header),
    ...transactions.map((transaction) => COLUMNS.map((column) => column.cell(transaction))),
  ]
  return lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

function csvCell(text: string): string {
  const safe = /^[=+@\t\r]/.test(text) || (/^-/.test(text) && Number.isNaN(Number(text))) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}
