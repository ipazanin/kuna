import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import { normaliseIban } from '../../../shared/text/fold'
import { readRules } from '../../rules/domain/readRules'
import type { Rule } from '../../rules/domain/rule'
import { currencyProblem, parseSettings } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import { UNCLASSIFIED, isDefinedBucket } from '../domain/bucket'
import { ledgerRowKeyOf } from '../domain/ledgerRowKey'
import type { LedgerRowKey } from '../domain/ledgerRowKey'
import { isVatTreatment } from '../domain/vatTreatment'
import { ADVANCE_BUCKETS } from '../domain/workbook'
import type { Account, Category, Client, Invoice, OwnerAdvance, Transaction, Workbook, WorkbookProblem } from '../domain/workbook'
import { readAssets } from './assetsTabReader'
import { dateOf, inTabOrder, isUnreadable, moneyOf, optionalPeriod, readRow, slugListOf, slugOf, textOf } from './cellReading'
import type { RowProblem } from './cellReading'
import { readGrants } from './grantsTabReader'
import { readPlan } from './planTabReader'
import { readScenarios } from './scenariosTabReader'
import type { CellValue, SheetRow, WorkbookSnapshot } from './workbookSnapshot'
import { readYearEnd } from './yearEndTabReader'

/**
 * Turns the tabs into the domain workbook, whether they came from a Google Sheet or an xlsx file.
 * Every column is found by its header name. The ledger's `family`, `bucket` and `month` columns
 * are the Sheet's own formulas and are not read: family and bucket come from `categories`, the way
 * those formulas derive them. A missing tab or column reads as empty, and settings default.
 * A `rules` tab is read the way `Rules.gs` reads it, against the categories read here.
 */
export function readWorkbook(snapshot: WorkbookSnapshot): Workbook {
  const problems: WorkbookProblem[] = []
  const settings = readSettings(snapshot.settings, problems)
  const categories = readCategories(snapshot.categories, problems)
  const clients = readClients(snapshot.clients, problems)
  const hasClientsTab = !snapshot.meta.missingTabs.includes('clients')
  const categorySlugs = new Set(categories.map((category) => category.slug))
  const grants = keep('grants', readGrants(snapshot.grants), problems)
  const scenarios = readScenarios(snapshot.scenarios)
  problems.push(...tabProblems('scenarios', scenarios.problems))
  return {
    id: snapshot.meta.id,
    source: snapshot.meta.source,
    title: snapshot.meta.title,
    ledgerSheetId: snapshot.meta.ledgerSheetId,
    syncedAt: snapshot.meta.syncedAt,
    transactions: readLedger(snapshot.ledger, categories, problems),
    categories,
    accounts: readAccounts(snapshot.accounts, settings, problems),
    rules: readRulesTab(snapshot.rules, categories, hasClientsTab, problems),
    invoices: readInvoices(snapshot.invoices, clients, problems),
    clients,
    hasClientsTab,
    ownerAdvances: readOwnerAdvances(snapshot['owner-advances'], categories, problems),
    assets: keep('assets', readAssets(snapshot.assets, new Set(grants.map((grant) => grant.slug))), problems),
    grants,
    yearEndLines: keep('year-end', readYearEnd(snapshot['year-end'], categorySlugs), problems),
    planLines: keep('plan', readPlan(snapshot.plan, categorySlugs, new Set(scenarios.scenarios.map((scenario) => scenario.slug))), problems),
    payScenarios: scenarios.scenarios,
    settings,
    problems,
  }
}

/** The facts of one tab reader, its problems added to the workbook's under the tab's name. */
function keep<Fact extends { readonly sheetRow: number }>(
  tab: WorkbookProblem['tab'],
  reading: { readonly facts: readonly Fact[]; readonly problems: readonly RowProblem[] },
  problems: WorkbookProblem[],
): readonly Fact[] {
  problems.push(...tabProblems(tab, reading.problems))
  return reading.facts
}

function tabProblems(tab: WorkbookProblem['tab'], rowProblems: readonly RowProblem[]): WorkbookProblem[] {
  return rowProblems.map((problem) => ({ tab, ...problem }))
}

/** The key that finds a ledger row again, read as the ledger reader reads it, or null for a row it leaves out. */
export function ledgerRowKeyOfRow(row: SheetRow): LedgerRowKey | null {
  const transaction = readLedgerRow(row, 0, new Map())
  return typeof transaction === 'string' ? null : ledgerRowKeyOf(transaction)
}

/** The categories a `categories` tab defines, by the same rule the reader applies. */
export function definedCategories(rows: readonly SheetRow[]): readonly Category[] {
  return readCategories(rows, [])
}

export function definedCategorySlugs(rows: readonly SheetRow[]): ReadonlySet<string> {
  return new Set(definedCategories(rows).map((category) => category.slug))
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
 * bucket is one the analysis knows. Anything else leaves its ledger rows unclassified. A VAT
 * treatment the app does not know is reported and read as none, so the category still counts.
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
    const vat = slugOf(row.cells.vat)
    if (vat !== '' && !isVatTreatment(vat)) {
      problems.push({ tab: 'categories', sheetRow: row.sheetRow, reason: `vat "${vat}" is not a VAT treatment, so ${slug} reads as none` })
    }
    bySlug.set(slug, {
      slug,
      label: textOf(row.cells.label),
      family,
      bucket,
      colour: textOf(row.cells.colour),
      roles: slugListOf(row.cells.roles),
      vat: isVatTreatment(vat) ? vat : 'none',
    })
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
    accounts.push({ slug, label: textOf(row.cells.label), iban: normaliseIban(textOf(row.cells.iban)), currency })
  }
  return accounts
}

function readRulesTab(rows: readonly SheetRow[], categories: readonly Category[], hasClientsTab: boolean, problems: WorkbookProblem[]): readonly Rule[] {
  const read = readRules(rows, new Set(categories.map((category) => category.slug)), hasClientsTab)
  problems.push(...read.problems.map((problem) => ({ tab: 'rules' as const, ...problem })))
  return read.rules
}

/**
 * One client per name, with every IBAN its rows give. An IBAN two clients claim would attribute a
 * payment to whichever came first, so the later row is left out.
 */
function readClients(rows: readonly SheetRow[], problems: WorkbookProblem[]): Client[] {
  const bySlug = new Map<string, { name: string; ibans: string[] }>()
  const ownerOfIban = new Map<string, string>()
  for (const row of inTabOrder(rows)) {
    const slug = slugOf(row.cells.client)
    const iban = normaliseIban(textOf(row.cells.iban))
    if (slug === '' || iban === '') {
      problems.push({ tab: 'clients', sheetRow: row.sheetRow, reason: slug === '' ? 'no client name' : 'no IBAN' })
      continue
    }
    const owner = ownerOfIban.get(iban)
    if (owner !== undefined && owner !== slug) {
      problems.push({ tab: 'clients', sheetRow: row.sheetRow, reason: `${iban} already belongs to ${owner}` })
      continue
    }
    ownerOfIban.set(iban, slug)
    const client = bySlug.get(slug) ?? { name: '', ibans: [] }
    client.name ||= textOf(row.cells.name)
    if (!client.ibans.includes(iban)) {
      client.ibans.push(iban)
    }
    bySlug.set(slug, client)
  }
  return [...bySlug].map(([slug, client]) => ({ slug, name: client.name, ibans: client.ibans }))
}

/**
 * A number used twice for one client is left out the second time, since the matching would count
 * the invoice twice. A delivery period that cannot be read is reported, and the invoice kept with
 * its issue date standing for the period.
 */
function readInvoices(rows: readonly SheetRow[], clients: readonly Client[], problems: WorkbookProblem[]): Invoice[] {
  const known = new Set(clients.map((client) => client.slug))
  const seen = new Set<string>()
  const invoices: Invoice[] = []
  for (const row of inTabOrder(rows)) {
    const invoice = readInvoiceRow(row)
    const key = typeof invoice === 'string' ? '' : `${invoice.client} ${invoice.number}`
    if (typeof invoice === 'string' || seen.has(key)) {
      const reason = typeof invoice === 'string' ? invoice : `invoice ${invoice.number} for ${invoice.client} is already listed above`
      problems.push({ tab: 'invoices', sheetRow: row.sheetRow, reason })
      continue
    }
    if (!known.has(invoice.client)) {
      problems.push({
        tab: 'invoices',
        sheetRow: row.sheetRow,
        reason: `${invoice.client} is not on the clients tab, so no payment can be matched to invoice ${invoice.number}`,
      })
    }
    const deliveryPeriod = readRow(() => optionalPeriod(row.cells, 'period_from', 'period_to'))
    if (isUnreadable(deliveryPeriod)) {
      problems.push({ tab: 'invoices', sheetRow: row.sheetRow, reason: `${deliveryPeriod.unreadable}, so the issue date stands for the delivery period` })
    }
    seen.add(key)
    invoices.push({ ...invoice, deliveryPeriod: isUnreadable(deliveryPeriod) ? null : deliveryPeriod })
  }
  return invoices
}

function readInvoiceRow(row: SheetRow): Omit<Invoice, 'deliveryPeriod'> | string {
  const { cells } = row
  const number = textOf(cells.number)
  if (number === '') {
    return 'no invoice number'
  }
  const client = slugOf(cells.client)
  if (client === '') {
    return 'no client'
  }
  const amount = moneyOf(cells.amount)
  if (amount === null) {
    return `the amount "${textOf(cells.amount)}" is not a number`
  }
  const issued = dateOf(cells.issued)
  if (issued === null) {
    return `the issue date "${textOf(cells.issued)}" is not a date cell`
  }
  const due = dateOf(cells.due)
  if (due === null && cells.due !== undefined) {
    return `the due date "${textOf(cells.due)}" is not a date cell`
  }
  return { number, client, item: textOf(cells.item), amount, issued, due, sheetRow: row.sheetRow }
}

function readOwnerAdvances(rows: readonly SheetRow[], categories: readonly Category[], problems: WorkbookProblem[]): OwnerAdvance[] {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const advances: OwnerAdvance[] = []
  for (const row of inTabOrder(rows)) {
    const advance = readOwnerAdvanceRow(row, categoryBySlug)
    if (typeof advance === 'string') {
      problems.push({ tab: 'owner-advances', sheetRow: row.sheetRow, reason: advance })
    } else {
      advances.push(advance)
    }
  }
  return advances
}

/**
 * A positive amount is a cost the owner paid, a negative one the owner's private share of a company
 * payment. Either moves a cost, so a category outside the operating and taxes buckets leaves the row out.
 */
function readOwnerAdvanceRow(row: SheetRow, categoryBySlug: ReadonlyMap<string, Category>): OwnerAdvance | string {
  const { cells } = row
  const date = dateOf(cells.date)
  if (date === null) {
    return cells.date === undefined ? 'no date' : `the date "${textOf(cells.date)}" is not a date cell`
  }
  const amount = moneyOf(cells.amount)
  if (amount === null) {
    return cells.amount === undefined ? 'no amount' : `the amount "${textOf(cells.amount)}" is not a number`
  }
  if (amount === 0) {
    return 'the amount is zero'
  }
  const slug = slugOf(cells.category)
  const category = categoryBySlug.get(slug)
  if (category === undefined) {
    return slug === '' ? 'no category' : `"${slug}" is not on the categories tab`
  }
  if (!(ADVANCE_BUCKETS as readonly string[]).includes(category.bucket)) {
    return `"${slug}" is in the ${category.bucket} bucket, and an advance counts as an operating cost or a tax`
  }
  return { date, amount, description: textOf(cells.description), category: slug, family: category.family, bucket: category.bucket, sheetRow: row.sheetRow }
}

function readLedger(
  rows: readonly SheetRow[],
  categories: readonly Category[],
  problems: WorkbookProblem[],
): Transaction[] {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const tabOrder = inTabOrder(rows)
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
    signals: {
      purpose: textOf(cells.purpose),
      txDomain: textOf(cells.tx_domain),
      txFamily: textOf(cells.tx_family),
      txSubFamily: textOf(cells.tx_sub_family),
      creditorReference: textOf(cells.creditor_reference),
      instructedCurrency: textOf(cells.instructed_currency),
    },
    reviewReasons: reviewReasonsOf(cells.review_reasons),
    sheetRow: row.sheetRow,
  }
}

/** The statement parser's reasons, joined with `|` in one cell. */
function reviewReasonsOf(cell: CellValue | undefined): string[] {
  return textOf(cell)
    .split('|')
    .map((reason) => reason.trim())
    .filter((reason) => reason !== '')
}
