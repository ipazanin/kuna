import { describe, expect, it } from 'vitest'

import { presentedWorkbook } from '../src/features/transactions/application/presentedWorkbook'
import { fakeWorkbookSnapshot } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { accountantDocumentsOf, readAccountantDocuments } from '../src/packs/hr-doo/application/accountantDocuments'
import { DEFAULT_PAYROLL_FOLDER, DEFAULT_VAT_RETURNS_FOLDER } from '../src/packs/hr-doo/domain/companyFacts'
import { hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'
import { fakeAccountantFolders } from '../src/packs/hr-doo/infrastructure/fake/fakeAccountantFolders'
import { payrollRows, vatReturnRows } from '../src/packs/hr-doo/presentation/taxes/accountantView'

const workbook = hrDooWorkbook(presentedWorkbook(readSnapshot(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z')).workbook))
const linkOf = () => null

async function fakeDocuments() {
  const read = await readAccountantDocuments(fakeAccountantFolders(), { vatReturns: DEFAULT_VAT_RETURNS_FOLDER, payroll: DEFAULT_PAYROLL_FOLDER }, null, '2026-10-16T08:00:00.000Z')
  return { read, documents: accountantDocumentsOf(read) }
}

describe('the fake accountant folders', () => {
  it('hold workbooks the readers take, but for the one of each kind made to fail', async () => {
    const { read, documents } = await fakeDocuments()

    expect(read.folderProblems).toEqual({ vatReturns: null, payroll: null })
    expect(documents.vatReturns.map((vatReturn) => vatReturn.period)).toEqual(['2026-04', '2026-06', '2026-07', '2026-09'])
    expect(documents.salaries.map((salary) => salary.workedMonth)).toEqual(['2026-06', '2026-07'])
    expect(documents.unread.map((unread) => [unread.name, unread.refusal])).toEqual([
      ['2026-08-pdv.xlsx', { tab: 'Lokalni U', row: 5, reason: 'the lines do not add up to the total row' }],
      ['2026-08-salary.xlsx', { tab: 'Obračun plaće_Alex Example', row: 1, reason: 'the title names 2026-07, the file 2026-08' }],
    ])
  })

  it('show every state of the VAT returns card against the fake ledger on 2026', async () => {
    const { documents } = await fakeDocuments()

    expect(vatReturnRows(workbook, documents, 2026, linkOf).map((row) => [row.key, row.kind, row.badges.map((badge) => badge.label)])).toEqual([
      ['2026-09', 'filed', ['Carry ok', 'Sales differ']],
      ['2026-08', 'unread', ['Could not read']],
      ['2026-07', 'filed', ['Carry differs', 'Sales ok']],
      ['2026-06', 'filed', ['Carry ok', 'Sales ok']],
      ['2026-05', 'not-filed', []],
      ['2026-04', 'filed', ['Carry ok', 'Sales ok']],
    ])
  })

  it('show every state of the payroll card against the fake ledger on 2026', async () => {
    const { documents } = await fakeDocuments()
    const rows = payrollRows(workbook, documents, 2026, linkOf)

    expect(rows.map((row) => [row.key, row.kind, row.badges.map((badge) => badge.label)])).toEqual([
      ['2026-08', 'unread', ['Could not read']],
      ['2026-07', 'read', ['Bank differs', 'Rules ok']],
      ['2026-06', 'read', ['Bank ok', 'Rules differ']],
    ])
    expect(rows.find((row) => row.key === '2026-06')?.ruleLines.map((line) => line.label)).toEqual(['Income tax', 'Net salary', 'To the state', 'To the employee'])
  })
})
