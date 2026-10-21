import { amountOf } from '../../../shared/money/money'
import type { ListedRow } from '../domain/listedRows'

const COLUMNS: readonly { readonly header: string; readonly cell: (row: ListedRow) => string }[] = [
  { header: 'date', cell: (row) => row.date },
  { header: 'account', cell: (row) => (row.kind === 'bank' ? row.account : '') },
  { header: 'counterparty', cell: (row) => row.counterparty },
  { header: 'counterparty_iban', cell: (row) => row.counterpartyIban },
  { header: 'description', cell: (row) => row.description },
  { header: 'amount', cell: (row) => amountOf(row.amount).toFixed(2) },
  { header: 'balance', cell: (row) => (row.kind === 'bank' ? amountOf(row.balance).toFixed(2) : '') },
  { header: 'category', cell: (row) => row.category },
  { header: 'bucket', cell: (row) => row.bucket },
  { header: 'flagged_by', cell: (row) => (row.kind === 'bank' ? row.flaggedBy : '') },
  { header: 'reference', cell: (row) => (row.kind === 'bank' ? row.reference : '') },
  { header: 'note', cell: (row) => (row.kind === 'bank' ? (row.split?.note ?? '') : '') },
  { header: 'tab', cell: (row) => (row.kind === 'owner-advance' ? 'owner-advances' : row.split === undefined ? 'ledger' : 'splits') },
]

/**
 * The rows as CSV with the ledger's own column names, amounts as plain decimals with a point, and
 * a last column naming the tab each row comes from, so an owner advance and a part of a split row
 * are told apart. A part keeps its bank row's date, account, balance and reference. Text that a
 * spreadsheet would run as a formula gets a leading apostrophe, so opening the file in Sheets or
 * Excel never evaluates a payee name.
 */
export function transactionsCsv(rows: readonly ListedRow[]): string {
  const lines = [COLUMNS.map((column) => column.header), ...rows.map((row) => COLUMNS.map((column) => column.cell(row)))]
  return lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

function csvCell(text: string): string {
  const safe = /^[=+@\t\r]/.test(text) || (/^-/.test(text) && Number.isNaN(Number(text))) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}
