import type { SelectedWorkbook } from '../infrastructure/selectedWorkbook'
import type { WorkbookSnapshot } from '../infrastructure/workbookSnapshot'

/** What a sync needs from Google and from this browser. */
export interface GoogleWorkbookPorts {
  /** A token that has not expired yet, or null. */
  liveAccessToken(): string | null
  /** Asks Google for a token with `prompt: ''`. Needs a user gesture, so it runs first in a sync. */
  requestAccessToken(): Promise<string>
  selectedWorkbook(): SelectedWorkbook | null
  rememberWorkbook(workbook: SelectedWorkbook): void
  /** Opens the Picker. Null when the user cancels. */
  pickSpreadsheet(accessToken: string): Promise<SelectedWorkbook | null>
  /** Reads the `ledger`, `categories` and `accounts` tabs in one call. Never writes. */
  readSnapshot(accessToken: string, workbook: SelectedWorkbook): Promise<WorkbookSnapshot>
}

/**
 * Reads the chosen workbook from Google, or null when the user cancels the Picker. The token comes
 * first: Firefox opens Google's popup only while the click that started the sync is recent.
 */
export async function readFromGoogle(ports: GoogleWorkbookPorts): Promise<WorkbookSnapshot | null> {
  const accessToken = ports.liveAccessToken() ?? (await ports.requestAccessToken())
  let workbook = ports.selectedWorkbook()
  if (workbook === null) {
    workbook = await ports.pickSpreadsheet(accessToken)
    if (workbook === null) {
      return null
    }
    ports.rememberWorkbook(workbook)
  }
  return ports.readSnapshot(accessToken, workbook)
}
