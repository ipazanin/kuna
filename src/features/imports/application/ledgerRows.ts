import { addMoney, plainAmount, subtractMoney } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import type { RowsChangeCheck, TabRowRules } from '../../workbook/application/tabRowWrites'
import type { RowCells } from '../../workbook/domain/rowChanges'
import type { Transaction } from '../../workbook/domain/workbook'
import { dateOf, moneyOf, slugOf } from '../../workbook/infrastructure/cellReading'
import { definedCategories, readLedgerTab } from '../../workbook/infrastructure/workbookReader'
import { contentColumns } from '../../workbook/infrastructure/workbookTemplate'
import { LEDGER_RECORDS } from '../../workbook/domain/recordKind'

const COLUMNS = contentColumns('ledger')

/**
 * Statement rows added to the `ledger` tab, and taken out again by Undo. The write places them
 * where the shadow-accounting Apps Script inserts a batch, so the tab keeps reading newest first.
 * Undo takes the rows out, since a blank row in the ledger stops the Apps Script too.
 *
 * Against the tab as it is right before the write, no added row may already be there by its
 * account and reference, each account's new rows must open at its newest balance and run on from
 * it, and no row may predate the account's newest row. A row taken out must have no row of its
 * account booked after it left in, since that row's balance follows from it.
 */
export const LEDGER_ROWS: TabRowRules = {
  tab: 'ledger',
  kind: LEDGER_RECORDS,
  columns: COLUMNS,
  required: ['date', 'account', 'amount', 'balance'],
  caseless: [],
  reads: ['categories'],
  read: (rows, fresh) => readLedgerTab(rows, definedCategories(fresh.categories?.rows ?? [])),
  refusals: (check, fresh) => {
    const before = readLedgerTab(check.before, definedCategories(fresh.categories?.rows ?? [])).facts
    return [...addedRefusals(check, before), ...removedRefusals(check, before)]
  },
}

/** Each account's newest row in booking order, as the readers take a closing balance. */
function newestByAccount(transactions: readonly Transaction[]): Map<string, Transaction> {
  const newest = new Map<string, Transaction>()
  for (const transaction of transactions) {
    const held = newest.get(transaction.account)
    if (held === undefined || transaction.date > held.date || (transaction.date === held.date && transaction.sequence > held.sequence)) {
      newest.set(transaction.account, transaction)
    }
  }
  return newest
}

function addedRefusals(check: RowsChangeCheck, before: readonly Transaction[]): string[] {
  const added = check.edits.flatMap((edit) => (edit.before === null && edit.after !== null ? [edit.after] : []))
  if (added.length === 0) return []
  const refusals: string[] = []
  const held = new Set(before.filter((row) => row.reference !== '').map((row) => `${row.account}|${row.reference}`))
  const already = added.filter((cells) => held.has(`${slugOf(cells.account)}|${cellText(cells.reference)}`))
  if (already.length > 0) {
    refusals.push(
      `${already.length === 1 ? 'One of these rows is' : `${already.length} of these rows are`} on the ledger tab already, such as the ${slugOf(already[0]!.account)} row with reference ${cellText(already[0]!.reference)}. The morning ingest may have filed ${already.length === 1 ? 'it' : 'them'} since the dry run. Look at the dry run again.`,
    )
  }
  const newest = newestByAccount(before)
  for (const account of new Set(added.map((cells) => slugOf(cells.account)))) {
    const rows = inBookingOrder(added.filter((cells) => slugOf(cells.account) === account))
    const latest = newest.get(account)
    let balance = latest?.balance ?? null
    for (const cells of rows) {
      const date = dateOf(cells.date)
      const amount = moneyOf(cells.amount)
      const after = moneyOf(cells.balance)
      if (date === null || amount === null || after === null) continue
      if (latest !== undefined && date < latest.date) {
        refusals.push(`A new ${account} row is dated ${date}, before ${latest.date}, the newest row of ${account} on the tab now.`)
        break
      }
      if (balance !== null && addMoney(balance, amount) !== after) {
        refusals.push(`The new ${account} rows open at ${plainAmount(subtractMoney(after, amount))}, but the tab now leaves ${account} at ${plainAmount(balance)}. Look at the dry run again.`)
        break
      }
      balance = after
    }
  }
  return refusals
}

function removedRefusals(check: RowsChangeCheck, before: readonly Transaction[]): string[] {
  const removedRows = new Set(check.edits.filter((edit) => edit.after === null).map((edit) => edit.id))
  const removed = before.filter((row) => removedRows.has(row.id))
  const refusals: string[] = []
  for (const account of new Set(removed.map((row) => row.account))) {
    const oldest = Math.min(...removed.filter((row) => row.account === account).map((row) => row.sequence))
    const newer = before.find((row) => row.account === account && row.sequence > oldest && !removedRows.has(row.id))
    if (newer !== undefined) {
      refusals.push(`The ${account} row of ${newer.date} with the balance ${plainAmount(newer.balance)} is booked after the rows to take out, so its balance follows from them. Take it out first, or leave the rows.`)
    }
  }
  return refusals
}

/** Added rows of one account, oldest first: statements in the order given, each held newest first. */
function inBookingOrder(added: readonly RowCells[]): RowCells[] {
  const blocks: RowCells[][] = []
  for (const cells of added) {
    const block = blocks[blocks.length - 1]
    if (block !== undefined && cellText(block[0]!.statement) === cellText(cells.statement)) {
      block.push(cells)
    } else {
      blocks.push([cells])
    }
  }
  return blocks.flatMap((block) => [...block].reverse())
}
