/**
 * A link that opens the Google Sheet on one row of the `ledger` tab. Without the tab's id the Sheet
 * would open on its first tab, so there is no link then.
 */
export function sheetRowLink(spreadsheetId: string, ledgerSheetId: number | null, sheetRow: number): string | null {
  if (ledgerSheetId === null) {
    return null
  }
  return `${spreadsheetLink(spreadsheetId)}#gid=${ledgerSheetId}&range=A${sheetRow}`
}

/** A link that opens the Google Sheet where it was last left. */
export function spreadsheetLink(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`
}
