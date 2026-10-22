/** A link that opens the Google Sheet where it was last left. */
export function spreadsheetLink(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`
}
