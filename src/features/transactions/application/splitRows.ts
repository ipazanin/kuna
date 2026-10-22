import { serialFromCivilDate } from '../../../shared/calendar/civilDate'
import { amountOf, plainAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import { installedPack } from '../../packs/packContribution'
import type { TabRowRules } from '../../workbook/application/tabRowWrites'
import type { RowCells, TabRowsChange } from '../../workbook/domain/rowChanges'
import type { SplitPart } from '../../workbook/domain/splits'
import type { Transaction } from '../../workbook/domain/workbook'
import { readAssets } from '../../workbook/infrastructure/assetsTabReader'
import { dateOf, moneyOf, slugOf } from '../../workbook/infrastructure/cellReading'
import { readSplits } from '../../workbook/infrastructure/splitsTabReader'
import { definedCategories, definedTransactions } from '../../workbook/infrastructure/workbookReader'
import { contentColumns } from '../../workbook/infrastructure/workbookTemplate'
import { SPLIT_PART_RECORDS } from '../../workbook/domain/recordKind'

/** One part as the tab holds it: the bank row's key, then the part, the date as a serial number so the cell is a date cell. */
export function splitCellsOf(row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>, part: Pick<SplitPart, 'amount' | 'category' | 'note'>): RowCells {
  return {
    date: serialFromCivilDate(row.date),
    account: row.account,
    row_amount: amountOf(row.amount),
    row_balance: amountOf(row.balance),
    amount: amountOf(part.amount),
    category: part.category,
    note: part.note.trim(),
  }
}

const COLUMNS = contentColumns('splits')

/**
 * The `splits` tab, checked by its reader against the ledger and the categories as they are now,
 * so a split the guards refuse is never written. A split of a row the pack keeps whole, such as
 * one an asset claims as its whole payment, is refused too.
 */
export const SPLIT_ROWS: TabRowRules = {
  tab: 'splits',
  kind: SPLIT_PART_RECORDS,
  columns: COLUMNS,
  required: COLUMNS.filter((column) => column !== 'note'),
  caseless: ['account', 'category'],
  reads: ['ledger', 'categories', 'assets'],
  read: (rows, fresh) => {
    const categoryRows = fresh.categories?.rows ?? []
    return readSplits(rows, definedTransactions(fresh.ledger?.rows ?? [], categoryRows), definedCategories(categoryRows))
  },
  refusals: (check, fresh) => {
    const categoryRows = fresh.categories?.rows ?? []
    const transactions = definedTransactions(fresh.ledger?.rows ?? [], categoryRows)
    const claiming = installedPack().rowsKeptWhole({ assets: readAssets(fresh.assets?.rows ?? [], new Set()).facts, transactions, categories: definedCategories(categoryRows) })
    const written = check.edits.flatMap((edit) => (edit.after === null ? [] : [edit.after]))
    const claimed = transactions.filter((row) => claiming.has(row.id) && written.some((cells) => keyHolds(cells, row)))
    return claimed.map((row) => {
      const claimedBy = claiming.get(row.id)!
      return `${claimedBy.map((name) => `"${name}"`).join(' and ')} on the assets tab ${claimedBy.length === 1 ? 'claims' : 'claim'} the ${row.account} row of ${row.date} for ${plainAmount(row.amount)} as payment, so the row stays whole.`
    })
  },
}

function keyHolds(cells: RowCells, row: Transaction): boolean {
  return dateOf(cells.date) === row.date && slugOf(cells.account) === row.account && moneyOf(cells.row_amount) === row.amount && moneyOf(cells.row_balance) === row.balance
}

/** A part as the editor gives it, with the row's sign. */
export interface SplitPartDraft {
  readonly amount: Money
  readonly category: string
  readonly note: string
}

const PART_COLUMNS = ['amount', 'category', 'note'] as const

/**
 * The change that leaves the splits tab holding these parts of the row: the rows it holds now take
 * the parts in order, parts beyond them are added, and rows beyond the parts are deleted. A row
 * keeps its key cells as read, and only a part's cells that differ are written.
 */
export function splitRowsChange(row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>, current: readonly RowCells[], parts: readonly SplitPartDraft[]): TabRowsChange {
  const typed = parts.map((part) => splitCellsOf(row, part))
  const changed = current.slice(0, typed.length).flatMap((held, index) => {
    const wanted = typed[index]!
    const differs = (column: (typeof PART_COLUMNS)[number]) =>
      column === 'category' ? cellText(held[column]).toLowerCase() !== cellText(wanted[column]).toLowerCase() : cellText(held[column]) !== cellText(wanted[column])
    if (!PART_COLUMNS.some(differs)) {
      return []
    }
    const after = { ...held, ...Object.fromEntries(PART_COLUMNS.filter(differs).map((column) => [column, wanted[column] ?? ''])) }
    return [{ before: held, after }]
  })
  return { added: typed.slice(current.length), changed, removed: current.slice(typed.length) }
}
