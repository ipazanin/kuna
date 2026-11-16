import { TEXT, found, inputOf } from '../../../../shared/app/operationInput'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Entries a step changes, each whole or with one of its parts alone. */
export const ENTRIES: StrictSchema = {
  type: 'array',
  items: inputOf({ entry: TEXT, part: { type: ['string', 'null'], description: "One of the entry's parts to change alone, such as one line of a receipt, or null for all of its parts." } }),
}

/** The rows a step names and the parts it names alone, each part refused unless it is one of its entry's own. */
export function picked(
  book: SpendingBook,
  given: readonly { readonly entry: string; readonly part: string | null }[],
  idOf: (value: unknown) => string,
): { readonly rows: readonly Transaction[]; readonly parts: ReadonlySet<RecordId> } {
  const itemsOf = rowItemsOf(book)
  const rows = new Map<RecordId, Transaction>()
  const parts = new Set<RecordId>()
  for (const { entry, part } of given) {
    const row = found(book.transactions, idOf(entry), 'entry')
    rows.set(row.id, row)
    if (part === null) continue
    const named = itemsOf(row).find((item) => item.id === idOf(part))
    if (named === undefined) throw new StepRefused("A part is one of its entry's own parts, as get_record of the entry lists them.")
    parts.add(named.id)
  }
  return { rows: [...rows.values()], parts }
}
