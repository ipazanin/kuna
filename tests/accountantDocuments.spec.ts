import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { accountantDocumentsOf, readAccountantDocuments } from '../src/packs/hr-doo/application/accountantDocuments'
import type { AccountantFolderListing, AccountantFolders, AccountantRead, DriveWorkbook } from '../src/packs/hr-doo/application/accountantDocuments'
import type { DocumentTab } from '../src/packs/hr-doo/domain/accountant/accountantDocument'
import { keepDriveRead, keptDriveRead } from '../src/shared/google/driveReads'
import { forgetGoogleSignIn } from '../src/shared/google/googleAuth'
import { month, salaryTabs, vatReturnTabs, withCell } from './fixtures/accountantWorkbooks'

const PATHS = { vatReturns: ['finance', 'vat'], payroll: ['finance', 'payroll'] }

const SEPTEMBER_RETURN = vatReturnTabs({ sales: [{ number: '9-1-26', issued: '2026-09-30', amount: 7000 }], local: [{ base: 100, vat: 25 }], broughtForward: -500 })
const AUGUST_SALARY = salaryTabs({ worked: '2026-08', paid: '2026-09-10', agreed: 'director-minimum' })

function workbook(id: string, name: string, version = '1', format: DriveWorkbook['format'] = 'xlsx'): DriveWorkbook {
  return { id, name, format, version }
}

/** Folders that list the files given per path and hand out their tabs, counting each file they hand out. */
function foldersOf(listings: Readonly<Record<string, AccountantFolderListing>>, tabs: Readonly<Record<string, DocumentTab[]>>): AccountantFolders & { readonly taken: string[] } {
  const taken: string[] = []
  return {
    taken,
    async files(path) {
      return listings[path.join('/')] ?? { kind: 'refused', reason: `no folder ${path.join('/')}` }
    },
    async tabs(file) {
      taken.push(file.id)
      const found = tabs[file.id]
      if (found === undefined) throw new Error(`403 from /drive/v3/files/${file.id}`)
      return found
    },
  }
}

describe('readAccountantDocuments', () => {
  it('keeps only the workbooks of each folder’s kind, and takes again only the files whose version changed', async () => {
    const listings = {
      'finance/vat': { kind: 'listed', files: [workbook('v9', '2026-09-pdv.xlsx'), workbook('s8-stray', '2026-08-salary.xlsx'), workbook('notes', 'index')] },
      'finance/payroll': { kind: 'listed', files: [workbook('s8', '2026-08-salary', '4', 'google-sheet')] },
    } as const
    const folders = foldersOf(listings, { v9: SEPTEMBER_RETURN, s8: AUGUST_SALARY })

    const first = await readAccountantDocuments(folders, PATHS, null, '2026-10-20T08:00:00.000Z')

    expect(first.files.map((file) => [file.id, file.kind, file.period, file.format])).toEqual([
      ['v9', 'vat-return', '2026-09', 'xlsx'],
      ['s8', 'salary', '2026-08', 'google-sheet'],
    ])
    expect(folders.taken).toEqual(['v9', 's8'])

    const changed = foldersOf({ ...listings, 'finance/payroll': { kind: 'listed', files: [workbook('s8', '2026-08-salary', '5', 'google-sheet')] } }, { v9: SEPTEMBER_RETURN, s8: AUGUST_SALARY })
    const second = await readAccountantDocuments(changed, PATHS, first, '2026-10-21T08:00:00.000Z')

    expect(changed.taken).toEqual(['s8'])
    expect(second.readAt).toBe('2026-10-21T08:00:00.000Z')
    expect(accountantDocumentsOf(second).vatReturns.map((vatReturn) => vatReturn.period)).toEqual([month('2026-09')])
  })

  it('takes an unchanged file from a read of other folder paths, since Drive ids hold across folders', async () => {
    const listings = { 'finance/vat': { kind: 'listed', files: [workbook('v9', '2026-09-pdv.xlsx')] } } as const
    const before = await readAccountantDocuments(foldersOf(listings, { v9: SEPTEMBER_RETURN }), { ...PATHS, payroll: ['old', 'payroll'] }, null, '2026-10-20T08:00:00.000Z')
    const folders = foldersOf(listings, { v9: SEPTEMBER_RETURN })

    await readAccountantDocuments(folders, PATHS, before, '2026-10-20T09:00:00.000Z')

    expect(folders.taken).toEqual([])
  })

  it('keeps a file Drive did not give with why, reads it again next time, and says which folder it could not list', async () => {
    const folders = foldersOf({ 'finance/vat': { kind: 'listed', files: [workbook('v9', '2026-09-pdv.xlsx')] } }, {})

    const read = await readAccountantDocuments(folders, PATHS, null, '2026-10-20T08:00:00.000Z')
    const again = await readAccountantDocuments(folders, PATHS, read, '2026-10-20T09:00:00.000Z')

    expect(read.folderProblems).toEqual({
      vatReturns: null,
      payroll: 'no folder finance/payroll, so no salary workbooks were read. Check the payroll folder on Settings, General.',
    })
    expect(accountantDocumentsOf(read).unread).toEqual([
      { period: month('2026-09'), kind: 'vat-return', name: '2026-09-pdv.xlsx', refusal: { tab: null, row: null, reason: 'Drive did not give the file: 403 from /drive/v3/files/v9' } },
    ])
    expect(folders.taken).toEqual(['v9', 'v9'])
    expect(again.files).toHaveLength(1)
  })
})

describe('accountantDocumentsOf', () => {
  function readOf(files: AccountantRead['files']): AccountantRead {
    return { readAt: '2026-10-20T08:00:00.000Z', folders: PATHS, files, folderProblems: { vatReturns: null, payroll: null } }
  }

  it('reads the xlsx before the Google Sheet of the same period, and calls the period unread when the two differ', () => {
    const file = (id: string, name: string, format: DriveWorkbook['format'], tabs: DocumentTab[]) => ({ ...workbook(id, name, '1', format), period: month('2026-08'), kind: 'salary' as const, contents: { tabs } })
    const same = accountantDocumentsOf(readOf([file('sheet', '2026-08-salary', 'google-sheet', AUGUST_SALARY), file('xlsx', '2026-08-salary.xlsx', 'xlsx', AUGUST_SALARY)]))
    const differing = accountantDocumentsOf(
      readOf([file('sheet', '2026-08-salary', 'google-sheet', withCell(AUGUST_SALARY, 'Obračun plaće_Ana Primjer', 12, 2, 0)), file('xlsx', '2026-08-salary.xlsx', 'xlsx', AUGUST_SALARY)]),
    )

    expect(same.salaries.map((salary) => salary.workedMonth)).toEqual([month('2026-08')])
    expect(same.unread).toEqual([])
    expect(differing.salaries).toEqual([])
    expect(differing.unread).toEqual([
      { period: month('2026-08'), kind: 'salary', name: '2026-08-salary.xlsx', refusal: { tab: null, row: null, reason: '2026-08-salary in the same folder reads differently' } },
    ])
  })

  it('names the tab and row of a workbook the reader refuses, and still counts its period as filed', () => {
    const broken = withCell(SEPTEMBER_RETURN, 'Lokalni U', 2, 7, 'twenty five')
    const documents = accountantDocumentsOf(readOf([{ ...workbook('v9', '2026-09-pdv.xlsx'), period: month('2026-09'), kind: 'vat-return', contents: { tabs: broken } }]))

    expect(documents.unread.map((unread) => unread.refusal)).toEqual([{ tab: 'Lokalni U', row: 2, reason: 'PDV on the line is not a number' }])
    expect(documents.filedVatPeriods).toEqual([month('2026-09')])
  })
})

describe('the last read on this device', () => {
  it('is kept by name until sign-out forgets it', async () => {
    await keepDriveRead('hr-doo.accountant', { readAt: '2026-10-20T08:00:00.000Z' }, Date.now())
    expect(await keptDriveRead('hr-doo.accountant')).toEqual({ readAt: '2026-10-20T08:00:00.000Z' })

    forgetGoogleSignIn()

    expect(await keptDriveRead('hr-doo.accountant')).toBeNull()
  })

  it('is not kept when sign-out came while it was read', async () => {
    const startedAt = Date.now()

    forgetGoogleSignIn()
    await keepDriveRead('hr-doo.accountant', { readAt: new Date(startedAt).toISOString() }, startedAt)

    expect(await keptDriveRead('hr-doo.accountant')).toBeNull()
  })
})
