import { readDocument } from '../../src/features/workbook/infrastructure/documentRecordStorage'
import { fakeWorkbookDocument } from '../../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { accountantDocumentsOf, readAccountantDocuments } from '../../src/packs/hr-doo/application/accountantDocuments'
import { FAKE_FOLDERS } from '../../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { hrDooWorkbook } from '../../src/packs/hr-doo/domain/hrDooPart'
import { fakeAccountantFolders } from '../../src/packs/hr-doo/infrastructure/fake/fakeAccountantFolders'
import { fakeStaffOf } from '../../src/packs/hr-doo/infrastructure/fake/fakeStaff'

const SYNCED = '2026-10-16T08:00:00.000Z'

/** A fake variant's books as the fake build opens them on Drive, with its accountant folders as a sync reads them. */
export async function fakeStaffBooks(variant: 'one-employee' | 'five-employees') {
  const read = readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, 'drive', fakeStaffOf(variant)))
  const folders = await readAccountantDocuments(fakeAccountantFolders(variant), { vatReturns: FAKE_FOLDERS.vatReturns, payroll: FAKE_FOLDERS.payroll }, null, SYNCED)
  return { workbook: hrDooWorkbook(read.workbook), documents: accountantDocumentsOf(folders) }
}
