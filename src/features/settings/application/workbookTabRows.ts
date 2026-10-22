import { normaliseIban } from '../../../shared/text/fold'
import { editsOf, untouchedOf } from '../../workbook/application/tabRowWrites'
import type { TabRowRules } from '../../workbook/application/tabRowWrites'
import type { FreshTabs } from '../../workbook/infrastructure/workbookWriter'
import type { RowCells } from '../../workbook/domain/rowChanges'
import { slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAssets } from '../../workbook/infrastructure/assetsTabReader'
import { slugListOf, slugOf, textOf } from '../../workbook/infrastructure/cellReading'
import { readGrants } from '../../workbook/infrastructure/grantsTabReader'
import { definedCategorySlugs, readAccountRows, readCategoryRows, readClientRows } from '../../workbook/infrastructure/workbookReader'
import type { SheetRow, WorkbookTab } from '../../workbook/infrastructure/workbookSnapshot'
import { contentColumns } from '../../workbook/infrastructure/workbookTemplate'
import { readYearEndLines } from '../../workbook/infrastructure/yearEndTabReader'
import { accountChangeRefusals } from '../domain/accountGuards'
import { categoryChangeRefusals } from '../domain/categoryGuards'
import { clientChangeRefusals } from '../domain/clientGuards'
import { ACCOUNT_RECORDS, ASSET_RECORDS, CATEGORY_RECORDS, CLIENT_RECORDS, GRANT_RECORDS, YEAR_END_RECORDS } from '../../workbook/domain/recordKind'

/** A tab's rows, from a fresh read or from the copy on screen. */
export type RowsOf = (tab: WorkbookTab) => readonly SheetRow[]

function rowsOfFresh(fresh: FreshTabs): RowsOf {
  return (tab) => fresh[tab]?.rows ?? []
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
    if (category !== '') ids.set(category, [...(ids.get(category) ?? []), textOf(row.cells.rule) || 'one without an id'])
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

export const CATEGORY_ROWS: TabRowRules = {
  tab: 'categories',
  kind: CATEGORY_RECORDS,
  columns: contentColumns('categories'),
  required: ['category', 'family', 'bucket'],
  caseless: ['category', 'family', 'bucket', 'vat'],
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
}

function clientIbansOf(rows: readonly SheetRow[]): ReadonlyMap<string, string> {
  return new Map(readClientRows(rows).facts.map((row) => [row.iban, row.slug]))
}

export const ACCOUNT_ROWS: TabRowRules = {
  tab: 'accounts',
  kind: ACCOUNT_RECORDS,
  columns: contentColumns('accounts'),
  required: ['account', 'iban'],
  caseless: ['account', 'iban', 'currency'],
  reads: ['ledger', 'clients'],
  read: (rows) => readAccountRows(rows, null),
  refusals: (check, fresh) =>
    accountChangeRefusals(
      editsOf(check, (cells) => ({ slug: slugOf(cells.account), iban: normaliseIban(textOf(cells.iban)) })),
      untouchedOf(check, (cells) => ({ slug: slugOf(cells.account), iban: normaliseIban(textOf(cells.iban)) })).filter((row) => row.slug !== ''),
      { named: accountUses(rowsOfFresh(fresh)), clientIbans: clientIbansOf(fresh.clients?.rows ?? []) },
    ),
}

export const CLIENT_ROWS: TabRowRules = {
  tab: 'clients',
  kind: CLIENT_RECORDS,
  columns: contentColumns('clients'),
  required: ['client', 'iban'],
  caseless: ['client', 'iban'],
  reads: ['accounts', 'invoices', 'outgoing-plan', 'settings'],
  read: (rows) => readClientRows(rows),
  refusals: (check, fresh) => {
    const pick = (cells: RowCells | SheetRow['cells']) => ({ slug: slugOf(cells.client), name: textOf(cells.name), iban: normaliseIban(textOf(cells.iban)) })
    return clientChangeRefusals(editsOf(check, pick), untouchedOf(check, pick).filter((row) => row.slug !== ''), {
      named: clientUses(rowsOfFresh(fresh)),
      accountIbans: new Map(readAccountRows(fresh.accounts?.rows ?? [], null).facts.flatMap((account) => (account.iban === '' ? [] : [[account.iban, account.slug] as const]))),
    })
  },
}

export const ASSET_ROWS: TabRowRules = {
  tab: 'assets',
  kind: ASSET_RECORDS,
  columns: contentColumns('assets'),
  required: ['asset', 'bought', 'cost_net', 'group'],
  caseless: ['group', 'funded_by'],
  reads: ['grants'],
  read: (rows, fresh) => readAssets(rows, new Set(readGrants(fresh.grants?.rows ?? []).facts.map((grant) => grant.slug))),
  refusals: () => [],
}

export const GRANT_ROWS: TabRowRules = {
  tab: 'grants',
  kind: GRANT_RECORDS,
  columns: contentColumns('grants'),
  required: ['grant', 'received', 'amount'],
  caseless: ['grant', 'release', 'clawback_year1', 'clawback_year2'],
  reads: ['assets'],
  read: (rows) => readGrants(rows),
  refusals: (check, fresh) =>
    slugChangeRefusals(
      'grant',
      {
        edits: editsOf(check, (cells) => slugOf(cells.grant)).map((edit) => ({ from: edit.before, to: edit.after })),
        untouched: untouchedOf(check, (cells) => ({ slug: slugOf(cells.grant) })).filter((row) => row.slug !== ''),
      },
      grantUses(rowsOfFresh(fresh)),
      true,
    ),
}

export const YEAR_END_ROWS: TabRowRules = {
  tab: 'year-end',
  kind: YEAR_END_RECORDS,
  columns: contentColumns('year-end'),
  required: ['year', 'statement', 'line', 'amount'],
  caseless: ['statement', 'line'],
  reads: ['categories'],
  read: (rows, fresh) => readYearEndLines(rows, definedCategorySlugs(fresh.categories?.rows ?? [])),
  refusals: () => [],
}
