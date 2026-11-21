import type { RecipeSection, SourceRow } from './recipe'
import type { AskedRow } from './runRecipe'

/** The values one column holds in the rows no kind took, each with how many rows hold it. A blank cell is an empty value. */
export interface UnclaimedColumn {
  readonly column: string
  readonly values: readonly { readonly value: string; readonly rows: number }[]
}

/**
 * What a recipe's kinds did not take, as the values of the columns they test in the rows no kind took, and nothing else of
 * those rows. That is all a recipe's writer needs to add the kind that is missing.
 */
export function unclaimedValues(section: RecipeSection, rows: readonly SourceRow[], asked: readonly AskedRow[]): readonly UnclaimedColumn[] {
  const tested = [...new Set(section.kinds.flatMap((kind) => kind.when.map((test) => test.column)))]
  const unclaimed = asked.flatMap((row) => (row.why.kind === 'no-kind' && row.place !== null && rows[row.place] !== undefined ? [rows[row.place]!] : []))
  return tested.map((column) => {
    const counts = new Map<string, number>()
    for (const row of unclaimed) {
      const value = (row.get(column) ?? '').trim()
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return { column, values: [...counts].map(([value, count]) => ({ value, rows: count })) }
  })
}
