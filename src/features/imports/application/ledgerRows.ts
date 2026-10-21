import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import { addMoney, plainAmount, subtractMoney } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import type { AddedPlace, RowsChangeCheck, TabRowRules } from '../../workbook/application/tabRowWrites'
import type { RowCells } from '../../workbook/domain/rowChanges'
import type { Transaction } from '../../workbook/domain/workbook'
import { dateOf, moneyOf, slugOf } from '../../workbook/infrastructure/cellReading'
import { definedCategories, readLedgerTab } from '../../workbook/infrastructure/workbookReader'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'

const COLUMNS = TEMPLATE_COLUMNS.ledger.map((column) => column.name)

/**
 * Statement rows added to the `ledger` tab, and taken out again by Undo. The tab reads newest
 * first, so each statement goes in as one block where the shadow-accounting Apps Script inserts a
 * batch: above the first row that is not newer than the batch's newest day. The Apps Script reads
 * each account's balance off its topmost row, so a block at the foot would break its next morning.
 * Undo takes the rows out whole, since a blank row in the ledger stops the Apps Script too.
 *
 * Against the tab as it is right before the write, no added row may already be there by its
 * account and reference, each account's new rows must open at its newest balance and run on from
 * it, and no row may predate the account's newest row. A row taken out must have no newer row of
 * its account above it, since that row's balance follows from it.
 */
export const LEDGER_ROWS: TabRowRules = {
  tab: 'ledger',
  noun: { one: 'ledger row', many: 'ledger rows', article: 'a' },
  columns: COLUMNS,
  required: ['date', 'account', 'amount', 'balance'],
  caseless: [],
  dates: ['date'],
  reads: ['categories'],
  read: (rows, fresh) => readLedgerTab(rows, definedCategories(fresh.categories?.rows ?? [])),
  refusals: (check, fresh) => {
    const before = readLedgerTab(check.before, definedCategories(fresh.categories?.rows ?? [])).facts
    return [...addedRefusals(check, before), ...removedRefusals(check, before)]
  },
  label: (cells) => {
    const date = typeof cells.date === 'number' && Number.isFinite(cells.date) ? civilDateFromSerial(cells.date) : cellText(cells.date)
    return [date, cellText(cells.counterparty) || cellText(cells.description), cellText(cells.amount)].filter((part) => part !== '').join(', ') || 'blank'
  },
  place: (rows, added, lastRow) => placeBlocks(rows, added, lastRow),
  deletesWholeRows: true,
}

/** Each account's newest row on the tab, by day and then by tab position, as the readers take a closing balance. */
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
  const removed = check.edits.filter((edit) => edit.after === null)
  const refusals: string[] = []
  for (const account of new Set(removed.map((edit) => slugOf(edit.before?.account)))) {
    const rows = removed.filter((edit) => slugOf(edit.before?.account) === account).map((edit) => edit.sheetRow)
    const lowest = Math.max(...rows)
    const newer = before.find((row) => row.account === account && row.sheetRow < lowest && !rows.includes(row.sheetRow))
    if (newer !== undefined) {
      refusals.push(`Row ${newer.sheetRow} of ${account} sits above the rows to take out, so its balance follows from them. Take it out first, or leave the rows.`)
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

/**
 * Where each added row goes, as the Apps Script's `insertPositionFor` places a batch: a statement's
 * rows go in together above the first row whose day is not after the statement's newest day, the
 * statements one after another, each placed among the rows the ones before it put in.
 */
export function placeBlocks(rows: readonly SheetRow[], added: readonly RowCells[], lastRow: number): AddedPlace[] {
  const slots: { readonly readAs: number | null; readonly date: number; readonly index: number }[] = [...rows]
    .sort((upper, lower) => upper.sheetRow - lower.sheetRow)
    .map((row) => ({ readAs: row.sheetRow, date: typeof row.cells.date === 'number' ? row.cells.date : Number.NEGATIVE_INFINITY, index: -1 }))
  let start = 0
  while (start < added.length) {
    const statement = cellText(added[start]!.statement)
    const account = slugOf(added[start]!.account)
    let end = start
    while (end < added.length && cellText(added[end]!.statement) === statement && slugOf(added[end]!.account) === account) end += 1
    const block = added.slice(start, end).map((cells, offset) => ({ readAs: null, date: typeof cells.date === 'number' ? cells.date : 0, index: start + offset }))
    const newest = Math.max(...block.map((slot) => slot.date))
    const position = slots.findIndex((slot) => slot.date <= newest)
    slots.splice(position < 0 ? slots.length : position, 0, ...block)
    start = end
  }
  const places: AddedPlace[] = []
  let before = lastRow + 1
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index]!
    if (slot.readAs === null) {
      places.unshift({ index: slot.index, before })
    } else {
      before = slot.readAs
    }
  }
  return places
}
