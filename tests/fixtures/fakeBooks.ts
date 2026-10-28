import type { WorkbookSource } from '../../src/shared/storage/domain/recordsRead'
import { FAKE_WORKBOOK_ID, fakeWorkbookDocument } from '../../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { tabsOfDocument } from '../../src/apps/company/workbook/infrastructure/spreadsheetDocument'
import type { WorkbookSnapshot } from '../../src/apps/company/workbook/infrastructure/workbookSnapshot'

/** The fake workbook as the tabs of its xlsx export, as a spec that reads or writes an xlsx file takes it. */
export function fakeWorkbookSnapshot(syncedAt: string, source: WorkbookSource = 'drive'): WorkbookSnapshot {
  return {
    meta: { id: FAKE_WORKBOOK_ID, source, title: 'Fake workbook', syncedAt, lastExportedAt: null, unexportedSince: null },
    ...tabsOfDocument(fakeWorkbookDocument(syncedAt, source)),
  }
}
