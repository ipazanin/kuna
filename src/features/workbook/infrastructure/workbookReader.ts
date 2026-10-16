import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { normaliseIban } from '../../../shared/text/fold'
import { currencyProblem, parseSettings } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import { UNCLASSIFIED, isDefinedBucket } from '../domain/bucket'
import type { Account, Category, Transaction, Workbook, WorkbookProblem } from '../domain/workbook'
import type { CellValue, SheetRow, WorkbookSnapshot } from './workbookSnapshot'

/**
 * Turns the tabs into the domain workbook, whether they came from a Google Sheet or an xlsx file.
 * Every column is found by its header name. The ledger's `family`, `bucket` and `month` columns
 * are the Sheet's own formulas and are not read: family and bucket come from `categories`, the way
 * those formulas derive them. A missing tab or column reads as empty, and settings default.
 */
export function readWorkbook(snapshot: WorkbookSnapshot): Workbook {
  const problems: WorkbookProblem[] = []
  const settings = readSettings(snapshot.settings, problems)
  const categories = readCategories(snapshot.categories, problems)
  return {
    id: snapshot.meta.id,
    source: snapshot.meta.source,
    title: snapshot.meta.title,
    ledgerSheetId: snapshot.meta.ledgerSheetId,
    syncedAt: snapshot.meta.syncedAt,
    transactions: readLedger(snapshot.ledger, categories, problems),
    categories,
    accounts: readAccounts(snapshot.accounts, settings, problems),
    settings,
    problems,
  }
}

function readSettings(rows: readonly SheetRow[], problems: WorkbookProblem[]): Settings {
  const parsed = parseSettings(
    rows.map((row) => ({ key: textOf(row.cells.key), value: row.cells.value, sheetRow: row.sheetRow })),
  )
  problems.push(...parsed.problems.map((problem) => ({ tab: 'settings' as const, ...problem })))
  return parsed.settings
}

/**
 * Sheets matches a category case-insensitively and takes the first row that defines it, so this
 * does too. A row is a definition only when category, family and bucket are all filled, and the
 * bucket is one the analysis knows. Anything else leaves its ledger rows unclassified.
 */
function readCategories(rows: readonly SheetRow[], problems: WorkbookProblem[]): Category[] {
  const bySlug = new Map<string, Category>()
  for (const row of rows) {
    const slug = slugOf(row.cells.category)
    const family = slugOf(row.cells.family)
    const bucket = slugOf(row.cells.bucket)
    if (slug === '' || family === '' || bucket === '') {
      problems.push({ tab: 'categories', sheetRow: row.sheetRow, reason: 'category, family and bucket are not all filled' })
      continue
    }
    if (!isDefinedBucket(bucket)) {
      problems.push({ tab: 'categories', sheetRow: row.sheetRow, reason: `"${bucket}" is not a bucket` })
      continue
    }
    if (bySlug.has(slug)) {
      problems.push({ tab: 'categories', sheetRow: row.sheetRow, reason: `"${slug}" is already defined above` })
      continue
    }
    bySlug.set(slug, { slug, family, bucket, colour: textOf(row.cells.colour), roles: rolesOf(row.cells.roles) })
  }
  return [...bySlug.values()]
}

/** One currency per workbook: an account in another one is still read, and its amounts shown as the workbook's. */
function readAccounts(rows: readonly SheetRow[], settings: Settings, problems: WorkbookProblem[]): Account[] {
  const accounts: Account[] = []
  for (const row of rows) {
    const slug = slugOf(row.cells.account)
    if (slug === '') {
      problems.push({ tab: 'accounts', sheetRow: row.sheetRow, reason: 'no account name' })
      continue
    }
    const currency = textOf(row.cells.currency).toUpperCase()
    if (currency !== '' && currency !== settings.currency) {
      const invalid = currencyProblem(currency)
      problems.push({
        tab: 'accounts',
        sheetRow: row.sheetRow,
        reason: invalid ?? `${slug} is in ${currency} but the workbook counts in ${settings.currency}, so its amounts read as ${settings.currency}`,
      })
    }
    accounts.push({ slug, iban: normaliseIban(textOf(row.cells.iban)), currency })
  }
  return accounts
}

function readLedger(
  rows: readonly SheetRow[],
  categories: readonly Category[],
  problems: WorkbookProblem[],
): Transaction[] {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const tabOrder = [...rows].sort((upper, lower) => upper.sheetRow - lower.sheetRow)
  const transactions: Transaction[] = []
  tabOrder.forEach((row, position) => {
    const transaction = readLedgerRow(row, tabOrder.length - position, categoryBySlug)
    if (typeof transaction === 'string') {
      problems.push({ tab: 'ledger', sheetRow: row.sheetRow, reason: transaction })
    } else {
      transactions.push(transaction)
    }
  })
  return transactions
}

/** The transaction on one ledger row, or why the row cannot be read. */
function readLedgerRow(
  row: SheetRow,
  sequence: number,
  categoryBySlug: ReadonlyMap<string, Category>,
): Transaction | string {
  const { cells } = row
  if (typeof cells.date !== 'number') {
    return cells.date === undefined ? 'no date' : `the date "${String(cells.date)}" is not a date cell`
  }
  const account = slugOf(cells.account)
  if (account === '') {
    return 'no account'
  }
  const amount = moneyOf(cells.amount)
  if (amount === null) {
    return cells.amount === undefined ? 'no amount' : `the amount "${String(cells.amount)}" is not a number`
  }
  const balance = moneyOf(cells.balance)
  if (balance === null) {
    return cells.balance === undefined ? 'no balance' : `the balance "${String(cells.balance)}" is not a number`
  }
  const category = slugOf(cells.category)
  const defined = categoryBySlug.get(category)
  return {
    account,
    date: civilDateFromSerial(cells.date),
    sequence,
    statement: textOf(cells.statement),
    counterparty: textOf(cells.counterparty),
    counterpartyIban: normaliseIban(textOf(cells.counterparty_iban)),
    description: textOf(cells.description),
    amount,
    balance,
    category,
    family: defined?.family ?? UNCLASSIFIED,
    bucket: defined?.bucket ?? UNCLASSIFIED,
    flaggedBy: slugOf(cells.flagged_by),
    // The column holds numbers on some rows and text on others, so it is always read as text.
    reference: textOf(cells.reference),
    sheetRow: row.sheetRow,
  }
}

function textOf(cell: CellValue | undefined): string {
  return cell === undefined ? '' : String(cell).trim()
}

/** A comma-separated list, such as `revenue, watched`. */
function rolesOf(cell: CellValue | undefined): string[] {
  return textOf(cell)
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role !== '')
}

function slugOf(cell: CellValue | undefined): string {
  return textOf(cell).toLowerCase()
}

function moneyOf(cell: CellValue | undefined): Money | null {
  return typeof cell === 'number' && Number.isFinite(cell) ? moneyFromAmount(cell) : null
}
