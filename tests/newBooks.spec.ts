import { describe, expect, it } from 'vitest'

import { gettingSetUp } from '../src/apps/company/onboarding/presentation/gettingSetUp'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { newBooksDocument } from '../src/apps/company/workbook/presentation/workbookFiles'
import { STATEMENTS_BY_HAND } from '../src/apps/company/onboarding/domain/statementsChoice'
import { STARTING_CATEGORIES } from '../src/apps/company/packs/hr-doo/preset/domain/startingCategories'
import { startingRules } from '../src/apps/company/packs/hr-doo/preset/domain/startingRules'
import { civil } from './fixtures/ledger'

const SAVED = '2026-10-26T09:00:00.000Z'

/** New books as onboarding makes them. */
function newBooks(): WorkbookDocument {
  return newBooksDocument(STATEMENTS_BY_HAND, SAVED)
}

function read(document: WorkbookDocument) {
  return readDocument({ id: 'new', source: 'drive', title: 'kuna-company.json', syncedAt: SAVED }, document)
}

/** The value of each settings row the document holds, a row without a value as blank. */
function rowsOf(document: WorkbookDocument): Record<string, string> {
  return Object.fromEntries((document.records.setting ?? []).map((row) => [String(row.key), row.value === undefined ? '' : String(row.value)]))
}

/** The document with these settings rows set, as the company and statement steps write them. */
function withRows(document: WorkbookDocument, values: Readonly<Record<string, string | boolean>>): WorkbookDocument {
  const setting = (document.records.setting ?? []).map((row) => (String(row.key) in values ? { ...row, value: values[String(row.key)]! } : row))
  return { ...document, records: { ...document.records, setting } }
}

describe('new books', () => {
  it('hold an explicit row for every choice, statements by hand switching filing on sync off, and no account, row or folder', () => {
    const document = newBooks()
    const rows = rowsOf(document)

    expect(rows).toMatchObject({
      owner_pay_module: 'false',
      statements_sync: 'false',
      statements_folder: '',
      hr_vat_returns_folder: '',
      hr_payroll_folder: '',
      currency: 'EUR',
    })
    const { workbook } = read(document)
    expect(workbook.settings).toMatchObject({ ownerPayModule: false, statementsSync: false, statementsFolder: [] })
    expect(workbook.accounts).toEqual([])
    expect(workbook.transactions).toEqual([])
    expect(workbook.problems).toEqual([])
  })
})

describe('new books of a Croatian d.o.o.', () => {
  it('start with the Croatian set and the state rules of the day they are saved on, with no problem to read', () => {
    const { workbook } = read(newBooks())

    expect(workbook.categories.map((category) => category.slug)).toEqual(STARTING_CATEGORIES.map((category) => category.slug))
    expect(workbook.categories.find((category) => category.slug === 'car-costs')).toMatchObject({ roles: ['personal-transport'], vat: 'car-50', bucket: 'operating' })
    expect(workbook.rules.map((rule) => rule.id)).toEqual(startingRules(civil('2026-10-26')).map((rule) => rule.id))
    expect(workbook.problems).toEqual([])
  })

  it('start with no state rules on a day before the ruleset has a Naputak', () => {
    const { workbook } = read(newBooksDocument({}, '2025-06-01T09:00:00.000Z'))
    expect(workbook.rules).toEqual([])
  })
})

describe('getting set up', () => {
  const keysOf = (document: WorkbookDocument) => gettingSetUp(read(document).workbook).map((line) => line.key)

  it('lists what new books lack, asks a Croatian d.o.o. for nothing more, and each line goes once it is done', () => {
    const syncing = withRows(newBooks(), { statements_sync: true })
    expect(keysOf(syncing)).toEqual(['first-statement', 'statements-folder', 'categories'])

    const croatian = withRows(syncing, { owner_pay_module: true })
    expect(keysOf(croatian)).toEqual(['first-statement', 'statements-folder', 'categories'])

    const named = withRows(croatian, { statements_folder: 'finance/statements' })
    expect(keysOf(named)).toEqual(['first-statement', 'categories'])

    const recategorised = { ...named, records: { ...named.records, category: [...(named.records.category ?? []), { category: 'hosting', family: 'operating', bucket: 'operating' }] } }
    expect(keysOf(recategorised)).toEqual(['first-statement'])
  })

  it('stops asking about the categories once someone says they look right', () => {
    expect(gettingSetUp(read(newBooks()).workbook, true).map((line) => line.key)).toEqual(['first-statement'])
  })

  it('leaves the statements folder alone for statements by hand, and links each line to its screen', () => {
    expect(gettingSetUp(read(newBooks()).workbook)).toEqual([
      { key: 'first-statement', text: 'Import your first bank statement', link: { label: 'Import', to: { path: '/company/transactions', query: { tab: 'import' } } } },
      {
        key: 'categories',
        text: 'Check the categories Kuna starts with',
        link: { label: 'Categories', to: { path: '/company/settings', query: { tab: 'categories' } } },
      },
    ])
  })

  it('offers delivery only after the first statement, only while offered, and never to books that already take statements on their own', () => {
    const { workbook } = read(newBooks())
    const withRow = { ...workbook, transactions: [{} as (typeof workbook.transactions)[number]] }
    const delivery = (books: typeof workbook, offered: boolean) => gettingSetUp(books, true, offered).some((line) => line.key === 'statement-delivery')

    expect(delivery(workbook, true)).toBe(false)
    expect(delivery(withRow, true)).toBe(true)
    expect(delivery(withRow, false)).toBe(false)
    expect(delivery({ ...withRow, settings: { ...withRow.settings, statementsFolder: ['work', 'dss', 'statements'] } }, true)).toBe(false)
    expect(delivery({ ...withRow, settings: { ...withRow.settings, statementsMailFrom: ['a@example.com'] } }, true)).toBe(false)
    expect(delivery({ ...withRow, settings: { ...withRow.settings, statementsSync: true } }, true)).toBe(false)
  })
})
