import { describe, expect, it } from 'vitest'

import { gettingSetUp } from '../src/apps/company/onboarding/presentation/gettingSetUp'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { newBooksDocument } from '../src/apps/company/workbook/presentation/workbookFiles'
import { statementSettingsOf } from '../src/apps/company/onboarding/domain/statementsChoice'
import type { StatementMail, StatementsSource } from '../src/apps/company/onboarding/domain/onboardingSteps'
import type { CivilDate } from '../src/shared/calendar/civilDate'

const SAVED = '2026-10-26T09:00:00.000Z'

const ERSTE: StatementMail = { bank: 'erste', from: '', subject: '', since: null }

/** New books as onboarding makes them for a statements choice. */
function newBooks(source: StatementsSource): WorkbookDocument {
  return newBooksDocument(statementSettingsOf(source, ERSTE, '2026-10-26' as CivilDate), SAVED)
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
    const document = newBooks('hand')
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

  it('switch filing on sync on for statements from a Drive folder, which the statement step names', () => {
    const rows = rowsOf(newBooks('folder'))
    expect(rows).toMatchObject({ statements_sync: 'true', statements_folder: '', statements_mail_from: '', statements_mail_subject: '', mail_since: '' })
  })

  it('name the bank’s mail, mail since and the statements folder beside the books file for statements from mail, and never the accountant’s mail', () => {
    const document = newBooks('mail')
    expect(rowsOf(document)).toMatchObject({
      statements_sync: 'true',
      statements_folder: './statements',
      statements_mail_from: 'netbanking.support@erstebank.hr',
      statements_mail_subject: 'ERSTE Izvadak',
      mail_since: '2026-01-01',
      hr_accountant_mail_from: '',
      hr_payroll_mail_subject: '',
    })
    const { workbook } = read(document)
    expect(workbook.settings).toMatchObject({ statementsSync: true, statementsFolder: ['.', 'statements'], statementsMailFrom: ['netbanking.support@erstebank.hr'], mailSince: '2026-01-01' })
    expect(workbook.problems).toEqual([])
    expect(gettingSetUp(workbook).map((line) => line.key)).toEqual(['first-statement', 'categories'])
  })
})

describe('getting set up', () => {
  const keysOf = (document: WorkbookDocument) => gettingSetUp(read(document).workbook).map((line) => line.key)

  it('lists what new books lack, asks a Croatian d.o.o. for nothing more, and each line goes once it is done', () => {
    const fresh = newBooks('folder')
    expect(keysOf(fresh)).toEqual(['first-statement', 'statements-folder', 'categories'])

    const croatian = withRows(fresh, { owner_pay_module: true })
    expect(keysOf(croatian)).toEqual(['first-statement', 'statements-folder', 'categories'])

    const named = withRows(croatian, { statements_folder: 'finance/statements' })
    expect(keysOf(named)).toEqual(['first-statement', 'categories'])

    const recategorised = { ...named, records: { ...named.records, category: [...(named.records.category ?? []), { category: 'hosting', family: 'operating', bucket: 'operating' }] } }
    expect(keysOf(recategorised)).toEqual(['first-statement'])
  })

  it('leaves the statements folder alone for statements by hand, and links each line to its screen', () => {
    expect(gettingSetUp(read(newBooks('hand')).workbook)).toEqual([
      { key: 'first-statement', text: 'Import your first bank statement', link: { label: 'Import', to: { path: '/company/transactions', query: { tab: 'import' } } } },
      { key: 'categories', text: 'Look over the categories, which are still the ones new books start with', link: { label: 'Categories', to: { path: '/settings', query: { tab: 'categories' } } } },
    ])
  })
})
