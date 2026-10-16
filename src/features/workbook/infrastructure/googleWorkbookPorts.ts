import type { GoogleWorkbookPorts } from '../application/readFromGoogle'
import { currentAccessToken, requestToken } from './googleAuth'
import { pickFromDrive } from './picker'
import { loadSelectedWorkbook, saveSelectedWorkbook } from './selectedWorkbook'
import { batchGetValues, getSheetIds } from './sheetsClient'
import { CACHED_TABS, sheetRowsFromValues } from './workbookSnapshot'

/** The real Google side of a sync: GIS for the token, the Picker, and one Sheets batchGet. */
export const googleWorkbookPorts: GoogleWorkbookPorts = {
  liveAccessToken: () => currentAccessToken()?.value ?? null,
  requestAccessToken: async () => (await requestToken('')).value,
  selectedWorkbook: loadSelectedWorkbook,
  rememberWorkbook: saveSelectedWorkbook,
  async pickSpreadsheet(accessToken) {
    const [picked] = await pickFromDrive('spreadsheet', accessToken)
    return picked === undefined ? null : { id: picked.id, name: picked.name }
  },
  async readSnapshot(accessToken, workbook) {
    const syncedAt = new Date().toISOString()
    const [[ledger, categories, accounts], sheetIds] = await Promise.all([
      batchGetValues(accessToken, workbook.id, CACHED_TABS),
      getSheetIds(accessToken, workbook.id),
    ])
    return {
      meta: { spreadsheetId: workbook.id, title: workbook.name, syncedAt, ledgerSheetId: sheetIds.get('ledger') ?? null },
      ledger: sheetRowsFromValues(ledger?.values ?? []),
      categories: sheetRowsFromValues(categories?.values ?? []),
      accounts: sheetRowsFromValues(accounts?.values ?? []),
    }
  },
}
