import { splitLedger } from '../../../../workbook/domain/splits'
import type { Transaction, Workbook } from '../../../../workbook/domain/workbook'
import { paymentRowsOf } from '../../domain/assets/assetRegister'
import { words } from '../words'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { MoneyFormat } from '../../../../../../shared/money/moneyFormat'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { listInWords } from '../../../../../../shared/text/listInWords'

/** A bank row by its day, its other side and its amount. */
function paymentInWords(row: Transaction, format: MoneyFormat): string {
  return [dayLabel(row.date), row.counterparty || row.description, formatMoney(row.amount, 'negative', format)].filter((part) => part !== '').join(', ')
}

/**
 * The payments that hold the items, each once in the order the items name them, or null for none. An item no debit of the ledger
 * holds reads as `missing`, such as a part a card's own write splits off.
 */
export function paymentsOfItems(workbook: Workbook, items: readonly RecordId[], format: MoneyFormat, missing: string = words.proposals.paymentGone): string | null {
  if (items.length === 0) return null
  const ledger = splitLedger(workbook.transactions, workbook.splits)
  const named = items.map((item) => {
    const row = paymentRowsOf(item, ledger)[0]
    return row === undefined ? missing : paymentInWords(row, format)
  })
  return listInWords([...new Set(named)])
}

/** In books from before items: the bank rows of the row ids, each by its day, its other side and its amount, or null for none. */
export function paymentsOfRows(workbook: Workbook, rowIds: readonly string[], format: MoneyFormat): string | null {
  if (rowIds.length === 0) return null
  return listInWords(
    rowIds.map((rowId) => {
      const row = workbook.transactions.find((transaction) => transaction.rowId === rowId)
      return row === undefined ? words.proposals.paymentGone : paymentInWords(row, format)
    }),
  )
}
