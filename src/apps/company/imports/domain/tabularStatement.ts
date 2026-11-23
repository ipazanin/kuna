import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { inEuros, roundedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { absMoney, addMoney, negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { HEADER_SEARCH_ROWS } from '../../../../shared/recipes/domain/headerRow'
import { sectionColumns } from '../../../../shared/recipes/domain/recipe'
import type { Recipe, TableFile } from '../../../../shared/recipes/domain/recipe'
import { runRecipe } from '../../../../shared/recipes/domain/runRecipe'
import type { AskedRow, RecipeRow } from '../../../../shared/recipes/domain/runRecipe'
import { tableRows } from '../../../../shared/recipes/domain/tableRows'
import { occurrenceKeys } from '../../../../shared/text/factKey'
import { fold, normaliseIban } from '../../../../shared/text/fold'
import { NO_SIGNALS, StatementRefused } from './importedStatement'
import type { ImportedRow, ImportedStatement, StatementReading } from './importedStatement'
import { words } from './words'

/** A table file's first sheet as text from A1, row by row, as `readFirstSheetCells` reads it. */
export type TableCells = readonly (readonly string[])[]

/**
 * The rows of a bank's table file, read by a recipe into the account its bank and currency find: the header row found by its
 * column names, then every row below in booking order, oldest first when the file lists newest first. A row whose date is blank,
 * or holds a label such as "Total" where the date goes, is skipped and noted, and so is a row the recipe leaves out. A row with
 * a date or an amount that cannot be read, or that no kind takes, refuses the file, since leaving a payment out would break
 * every balance after it. With a balance column each row's balance must follow from the row before. A row without a reference
 * column, or with a blank one, gets a key of its account, date, amount, balance and text with its count among equal rows of
 * the file, so the same row in a later export gets the same key.
 */
export function readTabularStatement(cells: TableCells, recipe: Recipe<TableFile>, account: string, fileName: string, fileHash: string): StatementReading {
  const label = `${fileName.replace(/\.[^.]+$/, '') || fileName} (${fileHash.slice(0, 8)})`
  try {
    return { statement: tabularStatement(cells, recipe, account, fileName, fileHash, label) }
  } catch (failure) {
    if (failure instanceof StatementRefused) {
      return { fileName, label, refusal: failure.message }
    }
    throw failure
  }
}

interface ReadRow {
  /** The row of the bank's own file, numbered as a spreadsheet numbers it, for the notes about it. */
  readonly fileRow: number
  readonly date: CivilDate
  readonly amount: Money
  readonly balance: Money | null
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
  readonly reference: string
}

/** A decimal in whole cents, or null for one finer than a cent, which the ledger cannot hold. */
function centsOf(amount: Decimal | null): Money | null {
  return amount === null || roundedDecimal(amount, 2) !== amount ? null : inEuros(amount, null)
}

/** Why the recipe did not read a row: a blank date or a label where it goes is noted, and anything else stops the file. */
function askedNoteOrProblem(asked: AskedRow, fileRow: number, formats: string): { readonly note: string } | { readonly problem: string } {
  if (asked.why.kind !== 'unreadable') return { problem: words.table.noKind(fileRow) }
  const { field, text } = asked.why
  switch (field) {
    case 'date':
    case 'time':
      if (text === '') return { note: words.table.noDate(fileRow) }
      // A label such as a total holds no digit where the date goes. Anything else is a date the recipe misreads.
      return /\d/.test(text) ? { problem: words.table.notADate(fileRow, text, formats) } : { note: words.table.labelForDate(fileRow, text) }
    case 'amount':
      return { problem: words.table.rowProblem(fileRow, text === '' ? words.table.noAmount : words.table.amountNotAmount(text)) }
    case 'balance':
      return { problem: words.table.balanceNotAmount(fileRow, text) }
    default:
      return { problem: words.table.rowProblem(fileRow, words.table.notAnAmount(text)) }
  }
}

function tabularStatement(cells: TableCells, recipe: Recipe<TableFile>, account: string, fileName: string, fileHash: string, label: string): ImportedStatement {
  const [section] = recipe.sections
  const table = tableRows(recipe, cells)
  const run = table.kind === 'read' ? runRecipe(recipe, table.rows) : null
  if (section === undefined || table.kind === 'misfit' || run === null || run.kind === 'misfit') {
    throw new StatementRefused(words.table.noHeader(HEADER_SEARCH_ROWS, fileName, recipe.name, section === undefined ? [] : sectionColumns(section)))
  }
  const source = table.rows.get(section.name) ?? []
  const cellOf = (place: number, field: string): string => {
    const column = [section.fields, ...section.kinds.map((kind) => kind.fields)].find((fields) => fields[field] !== undefined)?.[field]?.from
    return column === undefined ? '' : (source[place]?.get(column) ?? '')
  }
  const formats = [...new Set(section.kinds.flatMap((kind) => Object.values(kind.fields).flatMap((field) => (field.as === 'date' ? field.formats : []))))].join(', ')
  const notes: string[] = []
  const problems: string[] = []
  const rows: ReadRow[] = []
  let leftOut = 0
  const events = [...run.rows.map((row) => ({ place: row.place, row })), ...run.asked.map((asked) => ({ place: asked.place ?? 0, asked }))].sort((one, other) => one.place - other.place)
  for (const event of events) {
    const fileRow = table.lines[event.place] ?? 0
    if ('asked' in event) {
      const outcome = askedNoteOrProblem(event.asked, fileRow, formats)
      if ('note' in outcome) notes.push(outcome.note)
      else problems.push(outcome.problem)
      continue
    }
    const { row } = event
    if (row.kind !== 'entry') {
      leftOut += 1
      continue
    }
    const amount = amountOfRow(row, (field) => cellOf(row.place, field))
    if (typeof amount === 'string') {
      problems.push(words.table.rowProblem(fileRow, amount))
      continue
    }
    const balanceRead = row.decimals.balance ?? null
    const balance = centsOf(balanceRead)
    if (balanceRead !== null && balance === null) {
      problems.push(words.table.balanceNotAmount(fileRow, cellOf(row.place, 'balance')))
      continue
    }
    rows.push({
      fileRow,
      date: row.dates.date!,
      amount,
      balance,
      counterparty: row.texts.counterparty ?? '',
      counterpartyIban: row.texts.counterpartyIban ?? '',
      description: row.texts.description ?? '',
      reference: row.texts.reference ?? '',
    })
  }
  if (problems.length > 0) {
    throw new StatementRefused(words.table.unreadable(fileName, recipe.name, problems.slice(0, 5), Math.max(0, problems.length - 5)))
  }
  if (rows.length === 0) {
    throw new StatementRefused(words.table.noRows(fileName))
  }
  if (leftOut > 0) notes.push(words.table.leftOut(leftOut))
  const ordered = inBookingOrder(rows, fileName)
  checkBalances(ordered)
  const withoutReference = ordered.filter((row) => row.reference === '')
  const keys = occurrenceKeys(withoutReference.map((row) => rowFacts(account, row)))
  const keyOfRow = new Map(withoutReference.map((row, index) => [row, keys[index]]))
  const imported: ImportedRow[] = ordered.map((row) => {
    const reference = row.reference === '' ? `row-${keyOfRow.get(row)}` : row.reference
    return {
      date: row.date,
      amount: row.amount,
      balance: row.balance,
      counterparty: row.counterparty,
      counterpartyIban: row.counterpartyIban,
      description: row.description,
      reference,
      signals: NO_SIGNALS,
      reviewReasons: [],
    }
  })
  const first = ordered[0]!
  const last = ordered[ordered.length - 1]!
  return {
    fileName,
    source: { kind: 'table', recipe: recipe.name, fileHash },
    label,
    account,
    opening: first.balance === null ? null : subtractMoney(first.balance, first.amount),
    closing: last.balance,
    rows: imported,
    notes,
  }
}

/** The row's signed amount: the signed column, or the credit less the debit, where exactly one of the two holds an amount. */
function amountOfRow(row: RecipeRow, cellOf: (field: string) => string): Money | string {
  if ('amount' in row.decimals) {
    return centsOf(row.decimals.amount ?? null) ?? words.table.amountNotAmount(cellOf('amount'))
  }
  const debitRead = row.decimals.debit ?? null
  const creditRead = row.decimals.credit ?? null
  const debit = centsOf(debitRead)
  const credit = centsOf(creditRead)
  if ((debitRead !== null && debit === null) || (creditRead !== null && credit === null)) {
    return words.table.notAnAmount(debitRead !== null && debit === null ? cellOf('debit') : cellOf('credit'))
  }
  const debitPart = debit === null || debit === 0 ? null : debit
  const creditPart = credit === null || credit === 0 ? null : credit
  if (debitPart !== null && creditPart !== null) {
    return words.table.bothColumns
  }
  if (debitPart === null && creditPart === null) {
    return debit === null && credit === null ? words.table.neitherColumn : words.table.zero
  }
  if (creditPart !== null && creditPart < 0) {
    return words.table.negativeCredit(cellOf('credit'))
  }
  return debitPart !== null ? negateMoney(absMoney(debitPart)) : creditPart!
}

/** Oldest first. A file listing newest first is turned round whole, so a day's rows keep the bank's order. */
function inBookingOrder(rows: readonly ReadRow[], fileName: string): readonly ReadRow[] {
  const dates = rows.map((row) => row.date)
  const ascending = dates.every((date, index) => index === 0 || dates[index - 1]! <= date)
  const descending = dates.every((date, index) => index === 0 || dates[index - 1]! >= date)
  if (!ascending && !descending) {
    throw new StatementRefused(words.table.unordered(fileName))
  }
  return ascending ? rows : [...rows].reverse()
}

/** With a balance column, each row's balance is the one before plus its amount, as the bank's own chain. */
function checkBalances(rows: readonly ReadRow[]): void {
  rows.forEach((row, index) => {
    const previous = rows[index - 1]
    if (previous === undefined || previous.balance === null || row.balance === null) return
    const expected = addMoney(previous.balance, row.amount)
    if (expected !== row.balance) {
      throw new StatementRefused(words.table.balanceBreak(row.fileRow, row.balance, previous.fileRow, previous.balance, row.amount, expected))
    }
  })
}

/** The facts that tell a row from every other row of its account, so a key from another export of the same row matches. */
function rowFacts(account: string, row: ReadRow): string[] {
  return [account, row.date, String(row.amount), String(row.balance ?? ''), fold(row.description), fold(row.counterparty), normaliseIban(row.counterpartyIban)]
}
