import type { AskedRow } from '../../../../shared/recipes/domain/runRecipe'

/** The columns a report's recipe shows of a row it asks about, as its file writes them, which the import's Questions step and the chat both name the row by. */
export function askedColumns(row: Pick<AskedRow, 'shown'>): string {
  return row.shown.map(([column, text]) => `${column} ${text}`).join(' · ')
}
