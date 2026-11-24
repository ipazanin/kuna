import { describe, expect, it } from 'vitest'

import { gettingSetUp } from '../src/apps/company/onboarding/presentation/gettingSetUp'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { Account } from '../src/apps/company/workbook/domain/workbook'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { newBooksDocument, newCompanyBooks } from '../src/apps/company/workbook/presentation/workbookFiles'
import { STATEMENTS_BY_HAND } from '../src/apps/company/onboarding/domain/statementsChoice'
import { COMPANY_FACT_SETTINGS } from '../src/apps/company/packs/hr-doo/domain/companyFacts'
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
  it('hold an explicit row for every choice, and no account, row or folder, so statements come in by hand', () => {
    const document = newBooks()
    const rows = rowsOf(document)

    expect(rows).toMatchObject({
      owner_pay_module: 'false',
      statements_mail_from: '',
      currency: 'EUR',
    })
    expect(rows).not.toHaveProperty('statements_folder')
    expect(Object.keys(rows).filter((key) => COMPANY_FACT_SETTINGS.retired.includes(key))).toEqual([])
    const { workbook } = read(document)
    expect(workbook.settings).toMatchObject({ ownerPayModule: false, statementsMailFrom: [] })
    expect(workbook.accounts).toEqual([])
    expect(workbook.transactions).toEqual([])
    expect(workbook.problems).toEqual([])
  })
})

describe('placing client payments', () => {
  it('starts on new books, which have no earlier payment to place, and not on the template, which a person fills in by hand', () => {
    expect(read(newCompanyBooks().contents).workbook.paidInvoices).toEqual(new Map())
    expect(read(newBooksDocument({}, SAVED)).workbook.paidInvoices).toBeUndefined()
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
  /** An account the bank's statements fill from 1 November. */
  const BY_MAIL: Account = { slug: 'main', iban: 'HR1210010051863000160', currency: '', bank: '', sources: [{ source: 'mail', from: civil('2026-11-01') }] }
  const keysOf = (document: WorkbookDocument) => gettingSetUp({ ...read(document).workbook, accounts: [BY_MAIL] }).map((line) => line.key)

  it("lists what new books lack once an account takes the bank's statements, asks a Croatian d.o.o. for nothing more, and each line goes once it is done", () => {
    const syncing = newBooks()
    expect(keysOf(syncing)).toEqual(['first-statement', 'statements-mail', 'categories'])

    const croatian = withRows(syncing, { owner_pay_module: true })
    expect(keysOf(croatian)).toEqual(['first-statement', 'statements-mail', 'categories'])

    const named = withRows(croatian, { statements_mail_from: 'statements@bank.example.com', statements_mail_subject: 'Izvadak' })
    expect(keysOf(named)).toEqual(['first-statement', 'categories'])

    const recategorised = { ...named, records: { ...named.records, category: [...(named.records.category ?? []), { category: 'hosting', family: 'operating', bucket: 'operating' }] } }
    expect(keysOf(recategorised)).toEqual(['first-statement'])
  })

  it('stops asking about the categories once someone says they look right', () => {
    expect(gettingSetUp(read(newBooks()).workbook, true).map((line) => line.key)).toEqual(['first-statement'])
  })

  it('leaves the bank’s mail alone for statements by hand, and links each line to its screen', () => {
    expect(gettingSetUp(read(newBooks()).workbook)).toEqual([
      { key: 'first-statement', text: 'Import your first bank statement', whileEmpty: true, link: { label: 'Import', to: { path: '/company/transactions', query: { tab: 'import' } } } },
      {
        key: 'categories',
        text: 'Check the categories Kuna starts with',
        link: { label: 'Categories', to: { path: '/company/sorting', hash: '#categories' } },
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
    expect(delivery({ ...withRow, settings: { ...withRow.settings, statementsMailFrom: ['a@example.com'] } }, true)).toBe(false)
    expect(delivery({ ...withRow, accounts: [BY_MAIL] }, true)).toBe(false)
  })
})
