import type { GoogleSheet, GoogleWorkbookPorts } from '../application/readFromGoogle'
import { currentAccessToken, requestToken } from './googleAuth'
import { pickFromDrive } from './picker'
import { sheetNameInRange, sheetsValuesFor } from './sheetsClient'
import type { SheetsValues } from './sheetsClient'
import { EMPTY_TABS, WORKBOOK_TABS, sheetRowsFromValues } from './workbookSnapshot'
import type { WorkbookSnapshot, WorkbookTab } from './workbookSnapshot'

/** The real Google side of a sync: GIS for the token, the Picker, and one Sheets batchGet. */
export const googleWorkbookPorts: GoogleWorkbookPorts = {
  liveAccessToken: () => currentAccessToken()?.value ?? null,
  requestAccessToken: async (then) => (await requestToken(then)).value,
  async pickSpreadsheet(accessToken) {
    const [picked] = await pickFromDrive('spreadsheet', accessToken)
    return picked === undefined ? null : { id: picked.id, name: picked.name }
  },
  readSnapshot: (accessToken, sheet) => readSnapshotFrom(sheetsValuesFor(accessToken, sheet.id), sheet),
}

/** Reads the workbook tabs the Sheet has. Never writes. */
export async function readSnapshotFrom(sheets: SheetsValues, sheet: GoogleSheet): Promise<WorkbookSnapshot> {
  const syncedAt = new Date().toISOString()
  // A batchGet fails whole on a tab that does not exist, so it asks only for the tabs the Sheet has.
  const sheetIds = await sheets.sheetIds()
  if (!sheetIds.has('ledger')) {
    throw new Error(`${sheet.name} has no tab called "ledger", so it is not a Ledgerboard workbook.`)
  }
  const present: WorkbookTab[] = WORKBOOK_TABS.filter((tab) => sheetIds.has(tab))
  const ranges = await sheets.batchGet(present.map(sheetNameInRange))
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
      missingTabs: WORKBOOK_TABS.filter((tab) => !sheetIds.has(tab)),
    },
    ...EMPTY_TABS,
    ...tabs,
  }
}

/** The Sheets values API for the picked Sheet, with a token: the kept one, or a new one, which needs the click that asked for the write. */
export async function sheetsValuesForWriting(spreadsheetId: string): Promise<SheetsValues> {
  const accessToken = currentAccessToken()?.value ?? (await requestToken('none')).value
  return sheetsValuesFor(accessToken, spreadsheetId)
}
