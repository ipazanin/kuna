import fixture from './fakeWorkbook.json'
import { saveSelectedWorkbook } from '../selectedWorkbook'
import { openWorkbookCache } from '../workbookCache'
import { sheetRowsFromValues } from '../workbookSnapshot'

/**
 * Fills the cache from the synthetic workbook, as a successful sync would, and selects it.
 * Only main.ts imports this, behind an inline VITE_FAKE_WORKBOOK comparison, so the module and
 * its fixture never reach a production chunk.
 */
export async function seedFakeWorkbook(): Promise<void> {
  const cache = openWorkbookCache(fixture.spreadsheetId)
  try {
    await cache.replace({
      meta: { spreadsheetId: fixture.spreadsheetId, title: fixture.title, syncedAt: new Date().toISOString() },
      ledger: sheetRowsFromValues(fixture.valueRanges.ledger),
      categories: sheetRowsFromValues(fixture.valueRanges.categories),
      accounts: sheetRowsFromValues(fixture.valueRanges.accounts),
    })
  } finally {
    cache.close()
  }
  saveSelectedWorkbook({ id: fixture.spreadsheetId, name: fixture.title })
}
