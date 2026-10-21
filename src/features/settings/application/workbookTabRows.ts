import { cellText } from '../../../shared/text/cellText'
import { normaliseIban } from '../../../shared/text/fold'
import { editsOf, untouchedOf } from '../../workbook/application/tabRowWrites'
import type { RowNoun, TabRowRules } from '../../workbook/application/tabRowWrites'
import type { FreshTabs } from '../../workbook/application/workbookWriter'
import type { RowCells } from '../../workbook/domain/rowChanges'
import { slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAssets } from '../../workbook/infrastructure/assetsTabReader'
import { slugListOf, slugOf, textOf } from '../../workbook/infrastructure/cellReading'
import { readGrants } from '../../workbook/infrastructure/grantsTabReader'
import { definedCategorySlugs, readAccountRows, readCategoryRows, readClientRows } from '../../workbook/infrastructure/workbookReader'
import type { SheetRow, WorkbookTab } from '../../workbook/infrastructure/workbookSnapshot'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import { readYearEndLines } from '../../workbook/infrastructure/yearEndTabReader'
import { accountChangeRefusals } from '../domain/accountGuards'
import { categoryChangeRefusals } from '../domain/categoryGuards'
import { clientChangeRefusals } from '../domain/clientGuards'

/** A tab's rows, from a fresh read or from the copy on screen. */
export type RowsOf = (tab: WorkbookTab) => readonly SheetRow[]

function rowsOfFresh(fresh: FreshTabs): RowsOf {
  return (tab) => fresh[tab]?.rows ?? []
}

function columnsOf(tab: WorkbookTab): string[] {
  return TEMPLATE_COLUMNS[tab].map((column) => column.name)
}

function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`
}

/** Each slug with what names it, in the order the kinds are given. */
function usesOf(kinds: readonly ReadonlyMap<string, string>[]): SlugUses {
  const uses = new Map<string, string[]>()
  for (const kind of kinds) {
    for (const [slug, use] of kind) {
      uses.set(slug, [...(uses.get(slug) ?? []), use])
    }
  }
  return uses
}

/** How many rows name each slug, as "3 ledger rows". */
function countedBy(rows: readonly SheetRow[], slugsOf: (row: SheetRow) => readonly string[], one: string, many: string): ReadonlyMap<string, string> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const slug of new Set(slugsOf(row))) {
      if (slug !== '') counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  return new Map([...counts].map(([slug, count]) => [slug, counted(count, one, many)]))
}

/** The rules that file rows into each category, by id, as "the rule merchant-model". */
function rulesNaming(rows: readonly SheetRow[]): ReadonlyMap<string, string> {
  const ids = new Map<string, string[]>()
  for (const row of rows) {
    const category = slugOf(row.cells.category)
    if (category !== '') ids.set(category, [...(ids.get(category) ?? []), textOf(row.cells.rule) || `on row ${row.sheetRow}`])
  }
  return new Map([...ids].map(([slug, named]) => [slug, named.length === 1 ? `the rule ${named[0]}` : `the rules ${named.join(', ')}`]))
}

/** What names each category outside its tab: ledger rows, rules, owner advances, split parts, year-end konto rows and plan rows. */
export function categoryUses(rowsOf: RowsOf): SlugUses {
  return usesOf([
    countedBy(rowsOf('ledger'), (row) => [slugOf(row.cells.category)], 'ledger row', 'ledger rows'),
    rulesNaming(rowsOf('rules')),
    countedBy(rowsOf('owner-advances'), (row) => [slugOf(row.cells.category)], 'owner advance', 'owner advances'),
    countedBy(rowsOf('splits'), (row) => [slugOf(row.cells.category)], 'split part', 'split parts'),
    countedBy(rowsOf('year-end'), (row) => slugListOf(row.cells.categories), 'year-end konto row', 'year-end konto rows'),
    countedBy(rowsOf('plan'), (row) => [slugOf(row.cells.item)], 'plan tab row', 'plan tab rows'),
  ])
}

/** What names each account outside its tab, which is the ledger's rows. */
export function accountUses(rowsOf: RowsOf): SlugUses {
  return usesOf([countedBy(rowsOf('ledger'), (row) => [slugOf(row.cells.account)], 'ledger row', 'ledger rows')])
}

/** What names each client outside its tab: invoices, billing plan rows and the billing_client setting. */
export function clientUses(rowsOf: RowsOf): SlugUses {
  const billingClient = rowsOf('settings').find((row) => slugOf(row.cells.key) === 'billing_client')
  return usesOf([
    countedBy(rowsOf('invoices'), (row) => [slugOf(row.cells.client)], 'invoice', 'invoices'),
    countedBy(rowsOf('outgoing-plan'), (row) => [slugOf(row.cells.client)], 'billing plan row', 'billing plan rows'),
    new Map(billingClient === undefined || slugOf(billingClient.cells.value) === '' ? [] : [[slugOf(billingClient.cells.value), 'the billing_client setting']]),
  ])
}

/** What names each grant outside its tab, which is the assets it funded. */
export function grantUses(rowsOf: RowsOf): SlugUses {
  return usesOf([countedBy(rowsOf('assets'), (row) => [slugOf(row.cells.funded_by)], 'asset', 'assets')])
}

function noun(one: string, many: string, article: RowNoun['article'] = 'a'): RowNoun {
  return { one, many, article }
}

export const CATEGORY_ROWS: TabRowRules = {
  tab: 'categories',
  noun: noun('category', 'categories'),
  columns: columnsOf('categories'),
  required: ['category', 'family', 'bucket'],
  caseless: ['category', 'family', 'bucket', 'vat'],
  dates: [],
  reads: ['ledger', 'rules', 'owner-advances', 'splits', 'year-end', 'plan'],
  read: (rows) => readCategoryRows(rows),
  refusals: (check, fresh) => {
    const advances = new Map<string, number>()
    for (const row of fresh['owner-advances']?.rows ?? []) {
      const slug = slugOf(row.cells.category)
      advances.set(slug, (advances.get(slug) ?? 0) + 1)
    }
    return categoryChangeRefusals(
      editsOf(check, (cells) => ({ slug: slugOf(cells.category), bucket: slugOf(cells.bucket) })),
      untouchedOf(check, (cells) => ({ slug: slugOf(cells.category) })).filter((row) => row.slug !== ''),
      { named: categoryUses(rowsOfFresh(fresh)), advances },
    )
  },
  label: (cells) => cellText(cells.category) || 'blank',
}

function clientIbansOf(rows: readonly SheetRow[]): ReadonlyMap<string, string> {
  return new Map(readClientRows(rows).facts.map((row) => [row.iban, row.slug]))
}

export const ACCOUNT_ROWS: TabRowRules = {
  tab: 'accounts',
  noun: noun('account', 'accounts', 'an'),
  columns: columnsOf('accounts'),
  required: ['account', 'iban'],
  caseless: ['account', 'iban', 'currency'],
  dates: [],
  reads: ['ledger', 'clients'],
  read: (rows) => readAccountRows(rows, null),
  refusals: (check, fresh) =>
    accountChangeRefusals(
      editsOf(check, (cells) => ({ slug: slugOf(cells.account), iban: normaliseIban(textOf(cells.iban)) })),
      untouchedOf(check, (cells) => ({ slug: slugOf(cells.account), iban: normaliseIban(textOf(cells.iban)) })).filter((row) => row.slug !== ''),
      { named: accountUses(rowsOfFresh(fresh)), clientIbans: clientIbansOf(fresh.clients?.rows ?? []) },
    ),
  label: (cells) => cellText(cells.account) || 'blank',
}

export const CLIENT_ROWS: TabRowRules = {
  tab: 'clients',
  noun: noun('client row', 'client rows'),
  columns: columnsOf('clients'),
  required: ['client', 'iban'],
  caseless: ['client', 'iban'],
  dates: [],
  reads: ['accounts', 'invoices', 'outgoing-plan', 'settings'],
  read: (rows) => readClientRows(rows),
  refusals: (check, fresh) => {
    const pick = (cells: RowCells | SheetRow['cells']) => ({ slug: slugOf(cells.client), name: textOf(cells.name), iban: normaliseIban(textOf(cells.iban)) })
    return clientChangeRefusals(editsOf(check, pick), untouchedOf(check, pick).filter((row) => row.slug !== ''), {
      named: clientUses(rowsOfFresh(fresh)),
      accountIbans: new Map(readAccountRows(fresh.accounts?.rows ?? [], null).facts.flatMap((account) => (account.iban === '' ? [] : [[account.iban, account.slug] as const]))),
    })
  },
  label: (cells) => [cellText(cells.client), cellText(cells.iban)].filter((part) => part !== '').join(', ') || 'blank',
}

export const ASSET_ROWS: TabRowRules = {
  tab: 'assets',
  noun: noun('asset', 'assets', 'an'),
  columns: columnsOf('assets'),
  required: ['asset', 'bought', 'cost_net', 'group'],
  caseless: ['group', 'funded_by'],
  dates: ['bought', 'in_use', 'disposed'],
  reads: ['grants'],
  read: (rows, fresh) => readAssets(rows, new Set(readGrants(fresh.grants?.rows ?? []).facts.map((grant) => grant.slug))),
  refusals: () => [],
  label: (cells) => cellText(cells.asset) || 'blank',
}

export const GRANT_ROWS: TabRowRules = {
  tab: 'grants',
  noun: noun('grant', 'grants'),
  columns: columnsOf('grants'),
  required: ['grant', 'received', 'amount'],
  caseless: ['grant', 'release', 'clawback_year1', 'clawback_year2'],
  dates: ['received', 'period_from', 'period_to', 'employment_required_until'],
  reads: ['assets'],
  read: (rows) => readGrants(rows),
  refusals: (check, fresh) =>
    slugChangeRefusals(
      'grant',
      {
        edits: editsOf(check, (cells) => slugOf(cells.grant)).map((edit) => ({ sheetRow: edit.sheetRow, from: edit.before, to: edit.after })),
        untouched: untouchedOf(check, (cells) => ({ slug: slugOf(cells.grant) })).filter((row) => row.slug !== ''),
      },
      grantUses(rowsOfFresh(fresh)),
      true,
    ),
  label: (cells) => cellText(cells.grant) || 'blank',
}

export const YEAR_END_ROWS: TabRowRules = {
  tab: 'year-end',
  noun: noun('year-end line', 'year-end lines'),
  columns: columnsOf('year-end'),
  required: ['year', 'statement', 'line', 'amount'],
  caseless: ['statement', 'line'],
  dates: [],
  reads: ['categories'],
  read: (rows, fresh) => readYearEndLines(rows, definedCategorySlugs(fresh.categories?.rows ?? [])),
  refusals: () => [],
  label: (cells) => [cells.year, cells.statement, cells.line].map((cell) => cellText(cell)).filter((part) => part !== '').join(' ') || 'blank',
}
