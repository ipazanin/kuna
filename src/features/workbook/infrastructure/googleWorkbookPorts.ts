import type { GoogleWorkbookPorts } from '../application/readFromGoogle'
import { currentAccessToken, requestToken } from './googleAuth'
import { pickFromDrive } from './picker'
import { batchGetValues, getSheetIds } from './sheetsClient'
import { EMPTY_TABS, WORKBOOK_TABS, sheetRowsFromValues } from './workbookSnapshot'
import type { WorkbookTab } from './workbookSnapshot'

/** The real Google side of a sync: GIS for the token, the Picker, and one Sheets batchGet. */
export const googleWorkbookPorts: GoogleWorkbookPorts = {
  liveAccessToken: () => currentAccessToken()?.value ?? null,
  requestAccessToken: async () => (await requestToken()).value,
  async pickSpreadsheet(accessToken) {
    const [picked] = await pickFromDrive('spreadsheet', accessToken)
    return picked === undefined ? null : { id: picked.id, name: picked.name }
  },
  async readSnapshot(accessToken, sheet) {
    const syncedAt = new Date().toISOString()
    // A batchGet fails whole on a tab that does not exist, so it asks only for the tabs the Sheet has.
    const sheetIds = await getSheetIds(accessToken, sheet.id)
    if (!sheetIds.has('ledger')) {
      throw new Error(`${sheet.name} has no tab called "ledger", so it is not a Ledgerboard workbook.`)
    }
    const present: WorkbookTab[] = WORKBOOK_TABS.filter((tab) => sheetIds.has(tab))
    const ranges = await batchGetValues(accessToken, sheet.id, present)
    const tabs = Object.fromEntries(present.map((tab, index) => [tab, sheetRowsFromValues(ranges[index]?.values ?? [])]))
    return {
      meta: {
        id: sheet.id,
        source: 'google',
        title: sheet.name,
        syncedAt,
        ledgerSheetId: sheetIds.get('ledger') ?? null,
        lastExportedAt: null,
        unexportedSince: null,
      },
      ...EMPTY_TABS,
      ...tabs,
    }
  },
}
