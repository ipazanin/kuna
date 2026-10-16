import { FAKE_SPREADSHEET_ID, FAKE_WORKBOOK_TITLE, fakeWorkbookSnapshot } from './fakeWorkbook'
import { saveSelectedWorkbook } from '../selectedWorkbook'
import { openWorkbookCache } from '../workbookCache'

/**
 * Fills the cache from the synthetic workbook, as a successful sync would, and selects it.
 * Only main.ts imports this, behind an inline VITE_FAKE_WORKBOOK comparison, so the module and
 * its fixture never reach a production chunk.
 */
export async function seedFakeWorkbook(): Promise<void> {
  const cache = openWorkbookCache(FAKE_SPREADSHEET_ID)
  try {
    await cache.replace(fakeWorkbookSnapshot(new Date().toISOString()))
  } finally {
    cache.close()
  }
  saveSelectedWorkbook({ id: FAKE_SPREADSHEET_ID, name: FAKE_WORKBOOK_TITLE })
}
