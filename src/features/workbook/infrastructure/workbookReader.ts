import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import { normaliseIban } from '../../../shared/text/fold'
import { readRules } from '../../rules/domain/readRules'
import { orderTies } from '../../rules/domain/rule'
import type { Rule } from '../../rules/domain/rule'
import { currencyProblem, parseSettings } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import { bookingOrder } from '../domain/bookingOrder'
import { sharedKeys } from '../domain/sharedKeys'
import { UNCLASSIFIED, isDefinedBucket } from '../domain/bucket'
import { ledgerRowKeyOf } from '../domain/ledgerRowKey'
import type { LedgerRowKey } from '../domain/ledgerRowKey'
import { isVatTreatment } from '../domain/vatTreatment'
import { ADVANCE_BUCKETS, NO_CLIENT_INVOICING } from '../domain/workbook'
import type { Account, Category, Client, ClientInvoicing, Invoice, OwnerAdvance, Transaction, Workbook, WorkbookProblem } from '../domain/workbook'
import { readAssets } from './assetsTabReader'
import { readBillingPlan } from './billingPlanTabReader'
import { booleanOf, dateOf, idOf, inTabOrder, isUnreadable, moneyOf, optionalPeriod, readRow, slugListOf, slugOf, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import { readDismissals } from './dismissedTabReader'
import { readGrants } from './grantsTabReader'
import { readPlan } from './planTabReader'
import { readScenarios } from './scenariosTabReader'
import { readSplits } from './splitsTabReader'
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
  const categories = withoutRows(keep('categories', readCategoryRows(snapshot.categories), problems))
  const clients = clientsOf(keep('clients', readClientRows(snapshot.clients), problems))
  const hasClientsTab = !snapshot.meta.missingTabs.includes('clients')
  const categorySlugs = new Set(categories.map((category) => category.slug))
  const grants = keep('grants', readGrants(snapshot.grants), problems)
  const scenarios = readScenarios(snapshot.scenarios)
  problems.push(...tabProblems('scenarios', scenarios.problems))
  const transactions = readLedger(snapshot.ledger, categories, problems)
  const advances = readOwnerAdvanceRows(snapshot['owner-advances'], categories)
  problems.push(...tabProblems('owner-advances', advances.problems))
  const splits = readSplits(snapshot.splits, transactions, categories)
  problems.push(...tabProblems('splits', splits.problems))
  return {
    id: snapshot.meta.id,
    source: snapshot.meta.source,
    title: snapshot.meta.title,
    ledgerSheetId: snapshot.meta.ledgerSheetId,
    syncedAt: snapshot.meta.syncedAt,
    transactions,
    categories,
    accounts: withoutRows(keep('accounts', readAccountRows(snapshot.accounts, settings.currency), problems)),
    rules: readRulesTab(snapshot.rules, categories, hasClientsTab, problems),
    invoices: keep('invoices', readInvoiceRows(snapshot.invoices, new Set(clients.map((client) => client.slug))), problems),
    clients,
    hasClientsTab,
    billingPlan: keep('outgoing-plan', readBillingPlan(snapshot['outgoing-plan'], new Set(clients.map((client) => client.slug))), problems),
    ownerAdvances: advances.facts,
    splits: splits.splits,
    assets: keep('assets', readAssets(snapshot.assets, new Set(grants.map((grant) => grant.slug))), problems),
    grants,
    yearEndLines: keep('year-end', readYearEnd(snapshot['year-end'], categorySlugs), problems),
    planLines: keep('plan', readPlan(snapshot.plan, categorySlugs, new Set(scenarios.scenarios.map((scenario) => scenario.slug))), problems),
    payScenarios: scenarios.scenarios,
    dismissals: keep('dismissed', readDismissals(snapshot.dismissed), problems),
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

/** A tab's facts without the row each came from, for a fact the rest of the app knows by its name. */
function withoutRows<Fact extends { readonly sheetRow: number }>(facts: readonly Fact[]): Omit<Fact, 'sheetRow'>[] {
  return facts.map(({ sheetRow: _row, ...fact }) => fact)
}

/** A tab's problems in the order of its rows, so a problem a reader finds across rows is listed with the rest. */
function tabProblems(tab: WorkbookProblem['tab'], rowProblems: readonly RowProblem[]): WorkbookProblem[] {
  return [...rowProblems].sort((upper, lower) => upper.sheetRow - lower.sheetRow).map((problem) => ({ tab, ...problem }))
}

/** The key that finds a ledger row again, read as the ledger reader reads it, or null for a row it leaves out. */
export function ledgerRowKeyOfRow(row: SheetRow): LedgerRowKey | null {
  const transaction = readLedgerRow(row, new Map())
  return typeof transaction === 'string' ? null : ledgerRowKeyOf(transaction)
}

/** The transactions a `ledger` tab holds against a `categories` tab, by the same rule the reader applies. */
export function definedTransactions(ledgerRows: readonly SheetRow[], categoryRows: readonly SheetRow[]): readonly Transaction[] {
  return readLedger(ledgerRows, definedCategories(categoryRows), [])
}

/** The categories a `categories` tab defines, by the same rule the reader applies. */
export function definedCategories(rows: readonly SheetRow[]): readonly Category[] {
  return withoutRows(readCategoryRows(rows).facts)
}

export function definedCategorySlugs(rows: readonly SheetRow[]): ReadonlySet<string> {
  return new Set(definedCategories(rows).map((category) => category.slug))
}

/** The clients a `clients` tab names, by the same rule the reader applies. */
export function definedClientSlugs(rows: readonly SheetRow[]): ReadonlySet<string> {
  return new Set(readClientRows(rows).facts.map((row) => row.slug))
}

function readSettings(rows: readonly SheetRow[], problems: WorkbookProblem[]): Settings {
  const parsed = parseSettings(
    rows.map((row) => ({ key: textOf(row.cells.key), value: row.cells.value, sheetRow: row.sheetRow })),
  )
  problems.push(...parsed.problems.map((problem) => ({ tab: 'settings' as const, ...problem })))
  return parsed.settings
}

/**
 * A category is matched case-insensitively. A row is a definition only when category, family and
 * bucket are all filled, and the bucket is one the analysis knows. A category two rows define is
 * defined by neither, since where a row sits decides nothing. Anything else leaves its ledger rows
 * unclassified. A VAT treatment the app does not know is reported and read as none, so the category
 * still counts.
 */
export function readCategoryRows(rows: readonly SheetRow[]): TabReading<Category & { readonly sheetRow: number }> {
  const definitions: (Category & { readonly sheetRow: number })[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const slug = slugOf(row.cells.category)
    const family = slugOf(row.cells.family)
    const bucket = slugOf(row.cells.bucket)
    if (slug === '' || family === '' || bucket === '') {
      problems.push({ sheetRow: row.sheetRow, reason: 'category, family and bucket are not all filled' })
      continue
    }
    if (!isDefinedBucket(bucket)) {
      problems.push({ sheetRow: row.sheetRow, reason: `"${bucket}" is not a bucket` })
      continue
    }
    const vat = slugOf(row.cells.vat)
    if (vat !== '' && !isVatTreatment(vat)) {
      problems.push({ sheetRow: row.sheetRow, reason: `vat "${vat}" is not a VAT treatment, so ${slug} reads as none` })
    }
    definitions.push({
      slug,
      label: textOf(row.cells.label),
      family,
      bucket,
      colour: textOf(row.cells.colour),
      roles: slugListOf(row.cells.roles),
      vat: isVatTreatment(vat) ? vat : 'none',
      sheetRow: row.sheetRow,
    })
  }
  const shared = sharedKeys(definitions, (category) => category.slug)
  for (const category of definitions.filter((definition) => shared.has(definition.slug))) {
    problems.push({ sheetRow: category.sheetRow, reason: `"${category.slug}" is defined on more than one row, so none of them counts` })
  }
  return { facts: definitions.filter((category) => !shared.has(category.slug)), problems }
}

/**
 * One currency per workbook: an account in another one is still read, and its amounts shown as the
 * workbook's. With no workbook currency given, only a currency that is not one is reported. An
 * account named on more than one row is read from none of them.
 */
export function readAccountRows(rows: readonly SheetRow[], workbookCurrency: string | null): TabReading<Account & { readonly sheetRow: number }> {
  const facts: (Account & { readonly sheetRow: number })[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const slug = slugOf(row.cells.account)
    if (slug === '') {
      problems.push({ sheetRow: row.sheetRow, reason: 'no account name' })
      continue
    }
    const currency = textOf(row.cells.currency).toUpperCase()
    const invalid = currency === '' ? null : currencyProblem(currency)
    if (invalid !== null) {
      problems.push({ sheetRow: row.sheetRow, reason: invalid })
    } else if (currency !== '' && workbookCurrency !== null && currency !== workbookCurrency) {
      problems.push({ sheetRow: row.sheetRow, reason: `${slug} is in ${currency} but the workbook counts in ${workbookCurrency}, so its amounts read as ${workbookCurrency}` })
    }
    facts.push({ slug, label: textOf(row.cells.label), iban: normaliseIban(textOf(row.cells.iban)), currency, sheetRow: row.sheetRow })
  }
  const shared = sharedKeys(facts, (account) => account.slug)
  for (const account of facts.filter((fact) => shared.has(fact.slug))) {
    problems.push({ sheetRow: account.sheetRow, reason: `${account.slug} is named on more than one row, so none of them counts` })
  }
  return { facts: facts.filter((account) => !shared.has(account.slug)), problems }
}

/** The rules as `readRules` reads them, with enabled rules that share an order reported, since the app and `Rules.gs` break that tie differently. */
function readRulesTab(rows: readonly SheetRow[], categories: readonly Category[], hasClientsTab: boolean, problems: WorkbookProblem[]): readonly Rule[] {
  const read = readRules(rows, new Set(categories.map((category) => category.slug)), hasClientsTab)
  const ties = orderTies(read.rules).flatMap((tie) => {
    const reason = `${tie.map((rule) => rule.id).join(' and ')} share the order ${tie[0]!.order}, so the app tries them by id and the Apps Script by row. Give each its own order`
    return tie.map((rule) => ({ sheetRow: rule.sheetRow ?? 0, reason }))
  })
  problems.push(...tabProblems('rules', [...read.problems, ...ties]))
  return read.rules
}

/** One row of the `clients` tab: a client and one IBAN it pays from. */
export interface ClientRow {
  readonly slug: string
  readonly name: string
  readonly iban: string
  readonly invoicing: ClientRowInvoicing
  readonly sheetRow: number
}

/** The invoice columns of one clients row, with `reverseCharge` null where the cell is blank. */
type ClientRowInvoicing = Omit<ClientInvoicing, 'reverseCharge'> & { readonly reverseCharge: boolean | null }

/** The invoice columns of one clients row. A language the browser does not know or a reverse charge that is not TRUE or FALSE is reported, and read as blank. */
function clientInvoicingOf(row: SheetRow, problems: RowProblem[]): ClientRowInvoicing {
  const { cells } = row
  let mailLanguage = textOf(cells.mail_language).toLowerCase()
  if (mailLanguage !== '' && !knownLanguage(mailLanguage)) {
    problems.push({ sheetRow: row.sheetRow, reason: `"${mailLanguage}" is not a language such as en or hr, so the mail is written in English` })
    mailLanguage = ''
  }
  const reverseCharge = cells.reverse_charge === undefined || textOf(cells.reverse_charge) === '' ? null : booleanOf(cells.reverse_charge)
  if (reverseCharge === null && cells.reverse_charge !== undefined && textOf(cells.reverse_charge) !== '') {
    problems.push({ sheetRow: row.sheetRow, reason: `reverse_charge "${textOf(cells.reverse_charge)}" is neither TRUE nor FALSE, so it reads as FALSE` })
  }
  return {
    address: textOf(cells.address),
    country: textOf(cells.country),
    taxId: textOf(cells.tax_id),
    invoiceMail: textOf(cells.invoice_mail),
    mailLanguage,
    reverseCharge,
  }
}

function knownLanguage(tag: string): boolean {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0
  } catch {
    return false
  }
}

/**
 * One row per IBAN. An IBAN on more than one row would attribute a payment by where a row sits, so
 * every row of it is left out. A name or invoice detail a client's rows give differently is
 * reported on each of its rows, and reads blank.
 */
export function readClientRows(rows: readonly SheetRow[]): TabReading<ClientRow> {
  const read: ClientRow[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const slug = slugOf(row.cells.client)
    const iban = normaliseIban(textOf(row.cells.iban))
    if (slug === '' || iban === '') {
      problems.push({ sheetRow: row.sheetRow, reason: slug === '' ? 'no client name' : 'no IBAN' })
      continue
    }
    read.push({ slug, name: textOf(row.cells.name), iban, invoicing: clientInvoicingOf(row, problems), sheetRow: row.sheetRow })
  }
  const shared = sharedKeys(read, (row) => row.iban)
  for (const row of read.filter((candidate) => shared.has(candidate.iban))) {
    problems.push({ sheetRow: row.sheetRow, reason: `${row.iban} is on more than one row, so none of them counts` })
  }
  const facts = read.filter((row) => !shared.has(row.iban))
  for (const [slug, ofClient] of rowsByClient(facts)) {
    const { differing } = clientOf(slug, ofClient)
    if (differing.length > 0) {
      const reason = `the rows of ${slug} give ${differing.join(', ')} differently, so ${differing.length === 1 ? 'it reads' : 'they read'} blank`
      problems.push(...ofClient.map((row) => ({ sheetRow: row.sheetRow, reason })))
    }
  }
  return { facts, problems }
}

function clientsOf(rows: readonly ClientRow[]): Client[] {
  return [...rowsByClient(rows)].map(([slug, ofClient]) => clientOf(slug, ofClient).client)
}

function rowsByClient(rows: readonly ClientRow[]): Map<string, ClientRow[]> {
  const bySlug = new Map<string, ClientRow[]>()
  for (const row of rows) {
    bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row])
  }
  return bySlug
}

/** One client from its rows: every IBAN they give, and each name and invoice detail they agree on, by the column it comes from. */
function clientOf(slug: string, rows: readonly ClientRow[]): { readonly client: Client; readonly differing: readonly string[] } {
  const differing: string[] = []
  const agreed = <Value extends string | boolean>(column: string, values: readonly (Value | null)[]): Value | null => {
    const filled = [...new Set(values.filter((value): value is Value => value !== null && value !== ''))]
    if (filled.length > 1) {
      differing.push(column)
    }
    return filled.length === 1 ? filled[0]! : null
  }
  const client: Client = {
    slug,
    name: agreed('name', rows.map((row) => row.name)) ?? '',
    ibans: rows.map((row) => row.iban),
    invoicing: {
      address: agreed('address', rows.map((row) => row.invoicing.address)) ?? NO_CLIENT_INVOICING.address,
      country: agreed('country', rows.map((row) => row.invoicing.country)) ?? NO_CLIENT_INVOICING.country,
      taxId: agreed('tax_id', rows.map((row) => row.invoicing.taxId)) ?? NO_CLIENT_INVOICING.taxId,
      invoiceMail: agreed('invoice_mail', rows.map((row) => row.invoicing.invoiceMail)) ?? NO_CLIENT_INVOICING.invoiceMail,
      mailLanguage: agreed('mail_language', rows.map((row) => row.invoicing.mailLanguage)) ?? NO_CLIENT_INVOICING.mailLanguage,
      reverseCharge: agreed('reverse_charge', rows.map((row) => row.invoicing.reverseCharge)) ?? NO_CLIENT_INVOICING.reverseCharge,
    },
  }
  return { client, differing }
}

/**
 * A number used twice for one client leaves out every row of it, since the matching would count the
 * invoice twice. A delivery period that cannot be read is reported, and the invoice kept with its
 * issue date standing for the period.
 */
export function readInvoiceRows(rows: readonly SheetRow[], clientSlugs: ReadonlySet<string>): TabReading<Invoice> {
  const invoices: Invoice[] = []
  const problems: RowProblem[] = []
  const read = inTabOrder(rows).map((row) => ({ row, invoice: readInvoiceRow(row) }))
  const keyOf = (invoice: Omit<Invoice, 'deliveryPeriod'>): string => `${invoice.client} ${invoice.number}`
  const shared = sharedKeys(
    read.flatMap(({ invoice }) => (typeof invoice === 'string' ? [] : [invoice])),
    keyOf,
  )
  for (const { row, invoice } of read) {
    if (typeof invoice === 'string' || shared.has(keyOf(invoice))) {
      const reason = typeof invoice === 'string' ? invoice : `invoice ${invoice.number} for ${invoice.client} is listed on more than one row, so none of them counts`
      problems.push({ sheetRow: row.sheetRow, reason })
      continue
    }
    if (!clientSlugs.has(invoice.client)) {
      problems.push({
        sheetRow: row.sheetRow,
        reason: `${invoice.client} is not on the clients tab, so no payment can be matched to invoice ${invoice.number}`,
      })
    }
    const deliveryPeriod = readRow(() => optionalPeriod(row.cells, 'period_from', 'period_to'))
    if (isUnreadable(deliveryPeriod)) {
      problems.push({ sheetRow: row.sheetRow, reason: `${deliveryPeriod.unreadable}, so the issue date stands for the delivery period` })
    }
    invoices.push({ ...invoice, deliveryPeriod: isUnreadable(deliveryPeriod) ? null : deliveryPeriod })
  }
  return { facts: invoices, problems }
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

/**
 * A cost the owner paid counts as a cost, so a category outside the operating and taxes buckets
 * leaves the row out. A negative amount, the owner's private share of a company payment, belongs on
 * the splits tab and leaves the row out too.
 */
export function readOwnerAdvanceRows(rows: readonly SheetRow[], categories: readonly Category[]): TabReading<OwnerAdvance> {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const facts: OwnerAdvance[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const advance = readOwnerAdvanceRow(row, categoryBySlug)
    if (typeof advance === 'string') {
      problems.push({ sheetRow: row.sheetRow, reason: advance })
    } else {
      facts.push(advance)
    }
  }
  return { facts, problems }
}

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
  if (amount < 0) {
    return 'a negative amount is the owner’s private share of a company payment, which belongs on the splits tab. Press "Split" on its bank row on Transactions instead'
  }
  const slug = slugOf(cells.category)
  const category = categoryBySlug.get(slug)
  if (category === undefined) {
    return slug === '' ? 'no category' : `"${slug}" is not on the categories tab`
  }
  if (!(ADVANCE_BUCKETS as readonly string[]).includes(category.bucket)) {
    return `"${slug}" is in the ${category.bucket} bucket, and an advance counts as an operating cost or a tax`
  }
  return { date, amount, description: textOf(cells.description), category: slug, family: category.family, bucket: category.bucket, sheetRow: row.sheetRow, ...idOf(cells) }
}

/**
 * The transactions a `ledger` tab holds against these categories, each numbered in booking order,
 * and why the other rows were left out. A day whose balances do not chain is reported on the row
 * the guessed order closes it with.
 */
export function readLedgerTab(rows: readonly SheetRow[], categories: readonly Category[]): TabReading<Transaction> {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const entries: Omit<Transaction, 'sequence'>[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const entry = readLedgerRow(row, categoryBySlug)
    if (typeof entry === 'string') {
      problems.push({ sheetRow: row.sheetRow, reason: entry })
    } else {
      entries.push(entry)
    }
  }
  const order = bookingOrder(entries)
  const sequenceOf = new Map(order.entries.map((entry, index) => [entry, index + 1]))
  for (const day of order.unchained) {
    problems.push({
      sheetRow: day.closing.sheetRow,
      reason: `the balances of the ${day.account} rows of ${day.date} do not follow from one another, so they are ordered by reference and this row's balance closing the day is a guess`,
    })
  }
  return { facts: entries.map((entry): Transaction => ({ ...entry, sequence: sequenceOf.get(entry)! })), problems }
}

function readLedger(rows: readonly SheetRow[], categories: readonly Category[], problems: WorkbookProblem[]): Transaction[] {
  return [...keep('ledger', readLedgerTab(rows, categories), problems)]
}

/** The transaction on one ledger row, or why the row cannot be read. */
function readLedgerRow(row: SheetRow, categoryBySlug: ReadonlyMap<string, Category>): Omit<Transaction, 'sequence'> | string {
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
