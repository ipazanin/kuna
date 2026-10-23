/** A spreadsheet in the user's Drive, as the Picker returns it. */
export interface GoogleSheet {
  readonly id: string
  readonly name: string
}

/** What a sync needs from Google, which reads a Sheet into a copy of this type. */
export interface GoogleWorkbookPorts<Copy> {
  /** A token that has not expired yet, or null. */
  liveAccessToken(): string | null
  /**
   * Asks Google for a token with `prompt: ''`. Needs a user gesture, so it runs first in a sync. On a
   * phone the tab goes to Google and back instead, and `then` is what the app does once back.
   */
  requestAccessToken(then: 'sync' | 'pick'): Promise<string>
  /** Opens the Picker. Null when the user cancels. */
  pickSpreadsheet(accessToken: string): Promise<GoogleSheet | null>
  /** Reads the workbook tabs the Sheet has in one call. Never writes. */
  readSnapshot(accessToken: string, sheet: GoogleSheet): Promise<Copy>
}

/**
 * Reads a Sheet from Google: the one given, or one the user picks when none is given. Null when the
 * user cancels the Picker. The token comes first: Firefox opens Google's popup only while the click
 * that started the sync is recent.
 */
export async function readFromGoogle<Copy>(ports: GoogleWorkbookPorts<Copy>, sheet: GoogleSheet | null): Promise<Copy | null> {
  const accessToken = ports.liveAccessToken() ?? (await ports.requestAccessToken(sheet === null ? 'pick' : 'sync'))
  const chosen = sheet ?? (await ports.pickSpreadsheet(accessToken))
  return chosen === null ? null : ports.readSnapshot(accessToken, chosen)
}
