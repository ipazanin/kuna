import { HEADER_SEARCH_ROWS, headerKey, headerRowOf } from './headerRow'
import { sectionColumns } from './recipe'
import type { NumberCells, Recipe, RecipeMisfit, RecipeSection, SourceRow, TableFile } from './recipe'

/** A table file's first sheet from A1: each cell as text, and for each row the columns, from 0, whose cells the sheet holds as numbers. A csv holds none. */
export interface TableCells {
  readonly texts: readonly (readonly string[])[]
  readonly numbers: readonly (readonly number[])[]
}

/** A table file's rows under its header, by the recipe's one section, with the line of the file each row sits on, from 1. */
export type TableReading =
  | { readonly kind: 'read'; readonly rows: ReadonlyMap<string, readonly SourceRow[]>; readonly numbers: NumberCells; readonly lines: readonly number[] }
  | { readonly kind: 'misfit'; readonly misfit: RecipeMisfit }

/** The first column the section reads that the likeliest header row lacks: the row of the first ones that names the most of them. */
function missingColumn(cells: readonly (readonly string[])[], columns: readonly string[]): string {
  const lacking = cells.slice(0, HEADER_SEARCH_ROWS).map((row) => {
    const headers = new Set(row.map(headerKey))
    return columns.filter((column) => !headers.has(headerKey(column)))
  })
  const fewest = lacking.reduce<readonly string[]>((best, next) => (next.length < best.length ? next : best), columns)
  return fewest[0] ?? columns[0] ?? ''
}

/** A row by the columns the section reads or shows, each under the recipe's own spelling of its name. */
function rowOf(cells: readonly string[], places: readonly (readonly [column: string, at: number])[]): SourceRow {
  return new Map(places.map(([column, at]) => [column, (cells[at] ?? '').trim()]))
}

function sectionRows(section: RecipeSection, { texts, numbers }: TableCells): TableReading {
  const columns = sectionColumns(section)
  const headerAt = headerRowOf(texts, columns)
  if (headerAt === null) return { kind: 'misfit', misfit: { kind: 'no-column', section: section.name, column: missingColumn(texts, columns) } }
  const header = texts[headerAt]!.map(headerKey)
  const places = [...new Set([...columns, ...section.shown])].flatMap((column) => {
    const at = header.indexOf(headerKey(column))
    return at < 0 ? [] : [[column, at] as const]
  })
  const rows: SourceRow[] = []
  const rowNumbers: ReadonlySet<string>[] = []
  const lines: number[] = []
  texts.slice(headerAt + 1).forEach((row, offset) => {
    if (row.every((cell) => cell.trim() === '')) return
    const numberColumns = numbers[headerAt + 1 + offset] ?? []
    rows.push(rowOf(row, places))
    rowNumbers.push(new Set(places.flatMap(([column, at]) => (numberColumns.includes(at) ? [column] : []))))
    lines.push(headerAt + offset + 2)
  })
  return { kind: 'read', rows: new Map([[section.name, rows]]), numbers: new Map([[section.name, rowNumbers]]), lines }
}

/**
 * The rows of a table file's first sheet for a recipe: the header is the first of the first 40 rows that names every column
 * the recipe's section reads, ignoring case and spacing, and every row below it that is not blank is a row of the section.
 * No such header makes the file a misfit naming the first column it lacks.
 */
export function tableRows(recipe: Recipe<TableFile>, cells: TableCells): TableReading {
  const [section] = recipe.sections
  return section === undefined ? { kind: 'read', rows: new Map(), numbers: new Map(), lines: [] } : sectionRows(section, cells)
}
