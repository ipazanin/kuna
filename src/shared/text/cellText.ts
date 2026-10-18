/** The text a spreadsheet cell compares by. A checkbox and a typed TRUE are the same cell. */
export function cellText(cell: string | number | boolean | undefined | null): string {
  if (typeof cell === 'boolean') {
    return cell ? 'TRUE' : 'FALSE'
  }
  return cell === undefined || cell === null ? '' : String(cell).trim()
}
