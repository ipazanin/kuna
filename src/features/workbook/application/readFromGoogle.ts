import type { WorkbookSnapshot } from '../infrastructure/workbookSnapshot'

/** A spreadsheet in the user's Drive, as the Picker returns it. */
export interface GoogleSheet {
  readonly id: string
  readonly name: string
}

/** What a sync needs from Google. */
export interface GoogleWorkbookPorts {
  /** A token that has not expired yet, or null. */
  liveAccessToken(): string | null
  /** Asks Google for a token with `prompt: ''`. Needs a user gesture, so it runs first in a sync. */
  requestAccessToken(): Promise<string>
  /** Opens the Picker. Null when the user cancels. */
  pickSpreadsheet(accessToken: string): Promise<GoogleSheet | null>
  /** Reads the workbook tabs the Sheet has in one call. Never writes. */
  readSnapshot(accessToken: string, sheet: GoogleSheet): Promise<WorkbookSnapshot>
}

/**
 * Reads a Sheet from Google: the one given, or one the user picks when none is given. Null when the
 * user cancels the Picker. The token comes first: Firefox opens Google's popup only while the click
 * that started the sync is recent.
 */
export async function readFromGoogle(ports: GoogleWorkbookPorts, sheet: GoogleSheet | null): Promise<WorkbookSnapshot | null> {
  const accessToken = ports.liveAccessToken() ?? (await ports.requestAccessToken())
  const chosen = sheet ?? (await ports.pickSpreadsheet(accessToken))
  return chosen === null ? null : ports.readSnapshot(accessToken, chosen)
}
