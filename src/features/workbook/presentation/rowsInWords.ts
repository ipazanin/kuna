import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import { cellText } from '../../../shared/text/cellText'
import type { RowNoun, TabRowRules } from '../application/tabRowWrites'
import type { RowCells, TabRowsReceipt } from '../domain/rowChanges'
import { isDateCell } from '../infrastructure/cellFormats'

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function counted(noun: RowNoun, count: number): string {
  return count === 1 ? `${noun.article} ${noun.one}` : `${count} ${noun.many}`
}

const VERBS = {
  added: { done: 'added', undone: 'adding' },
  changed: { done: 'changed', undone: 'changing' },
  removed: { done: 'deleted', undone: 'deleting' },
} as const

/** "Added 3 plan rows", "Changed a category and deleted an asset", or for an undo "Undid adding an invoice". */
export function rowsChangeInWords(rules: TabRowRules, receipt: TabRowsReceipt, undid: TabRowsReceipt | null): string {
  const described = undid ?? receipt
  const parts = (['added', 'changed', 'removed'] as const)
    .filter((part) => described[part].length > 0)
    .map((part) => `${undid === null ? VERBS[part].done : VERBS[part].undone} ${counted(rules.noun, described[part].length)}`)
  const sentence = parts.length <= 1 ? (parts[0] ?? `changed the ${rules.tab} tab`) : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
  const said = undid === null ? sentence : `undid ${sentence}`
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}`
}

/** A cell of the row as a person reads it: a date's serial number as a day, a blank as "blank", text in quotes. */
function cellInWords(rules: TabRowRules, column: string, cells: RowCells): string {
  const cell = cells[column]
  if (typeof cell === 'number' && Number.isFinite(cell) && isDateCell(rules.tab, column, (name) => cells[name])) {
    return dayFormat.format(new Date(civilDateFromSerial(cell)))
  }
  const text = cellText(cell)
  return text === '' ? 'blank' : `"${text}"`
}

/** The cells a change wrote, each from what it held to what it holds. */
export function changedCellsInWords(rules: TabRowRules, before: RowCells, after: RowCells): { readonly column: string; readonly from: string; readonly to: string }[] {
  return rules.columns
    .filter((column) => cellText(before[column]) !== cellText(after[column]))
    .map((column) => ({ column, from: cellInWords(rules, column, before), to: cellInWords(rules, column, after) }))
}
