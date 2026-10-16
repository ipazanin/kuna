/**
 * Finds the figures a purple analysis tab shows, by the text of their labels and headers rather
 * than by cell address, so a layout change on the tab does not point the parity check at the wrong
 * cell. A grid is a tab's cells as rows of values, with null for an empty cell.
 */

/** @typedef {(string | number | boolean | null)[][]} Grid */

/** A blank cell, as an export writes it: missing, null, or an empty string from a formula. */
export function isBlank(cell) {
  return cell === null || cell === undefined || cell === ''
}

/**
 * The value under a tile's label, as the dashboard's tiles lay it out.
 * @param {Grid} grid
 * @param {string} label
 */
export function tileValue(grid, label) {
  const at = find(grid, label)
  return at === null ? undefined : cellAt(grid, at.row + 1, at.column)
}

/**
 * The value to the right of a label, as the year picker lays it out.
 * @param {Grid} grid
 * @param {string} label
 */
export function valueBeside(grid, label) {
  const at = find(grid, label)
  return at === null ? undefined : cellAt(grid, at.row, at.column + 1)
}

/**
 * The table whose header row starts with exactly these headers, side by side. Its body runs down to
 * the first row that is blank across the table's width. `width` widens a table whose last header
 * spans several columns.
 * @param {Grid} grid
 * @param {string[]} headers
 * @param {number} [width]
 * @returns {{ headers: string[], rows: (string | number | boolean | null)[][] } | null}
 */
export function findTable(grid, headers, width = headers.length) {
  for (let row = 0; row < grid.length; row += 1) {
    const cells = grid[row] ?? []
    for (let column = 0; column < cells.length; column += 1) {
      if (headers.every((header, offset) => cells[column + offset] === header)) {
        const rows = []
        for (let below = row + 1; below < grid.length; below += 1) {
          const body = Array.from({ length: width }, (_, offset) => cellAt(grid, below, column + offset))
          if (body.every(isBlank)) {
            break
          }
          rows.push(body)
        }
        return { headers, rows }
      }
    }
  }
  return null
}

/**
 * The body row of a table whose first cell is this label.
 * @param {{ rows: (string | number | boolean | null)[][] } | null} table
 * @param {string} label
 */
export function rowLabelled(table, label) {
  return table?.rows.find((row) => row[0] === label) ?? null
}

function find(grid, text) {
  for (let row = 0; row < grid.length; row += 1) {
    const column = (grid[row] ?? []).indexOf(text)
    if (column !== -1) {
      return { row, column }
    }
  }
  return null
}

function cellAt(grid, row, column) {
  const cell = grid[row]?.[column]
  return cell === undefined ? null : cell
}
