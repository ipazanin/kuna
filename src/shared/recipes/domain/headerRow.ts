/** A cell of a table file as a sheet reader gives it. */
type HeaderCell = string | number | boolean | undefined

/** How far down a file the header row is looked for, past a bank's title and account lines. */
export const HEADER_SEARCH_ROWS = 40

/** A column's name as headers are compared: spaces collapsed and case ignored. */
export function headerKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** The first of the first rows that holds every one of the columns, 0-based, or null. */
export function headerRowOf(grid: readonly (readonly HeaderCell[])[], columns: readonly string[]): number | null {
  const wanted = columns.map(headerKey)
  const index = grid.slice(0, HEADER_SEARCH_ROWS).findIndex((row) => {
    const headers = new Set(row.map((cell) => headerKey(cell === undefined ? '' : String(cell))))
    return wanted.every((column) => headers.has(column))
  })
  return index < 0 ? null : index
}

/** The likeliest header row of a file whose columns no recipe names yet, 0-based: the first of the first rows that fills the most cells, or null for a file with no filled cell. */
export function likeliestHeaderRow(grid: readonly (readonly string[])[]): number | null {
  const filled = grid.slice(0, HEADER_SEARCH_ROWS).map((row) => row.filter((cell) => cell.trim() !== '').length)
  const most = Math.max(0, ...filled)
  return most === 0 ? null : filled.indexOf(most)
}
