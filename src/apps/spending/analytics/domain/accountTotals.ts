import { partTotals } from './partTotals'
import type { KeepsPart, PartTotals } from './partTotals'
import type { CountedRow } from './countedRow'
import type { Category } from '../../workbook/domain/category'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the rows of one account count, every part kept, so a transfer lists among its rows and counts nowhere. */
export interface AccountTotals extends PartTotals {
  /** Null for the rows that sit on no account. */
  readonly account: RecordId | null
}

const EVERY_PART: KeepsPart = () => true

/** Each account with a row, in the order of its first row, so the accounts' figures add up to all of the rows'. */
export function accountTotals(rows: readonly CountedRow[], categories: readonly Category[]): readonly AccountTotals[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const byAccount = new Map<RecordId | null, CountedRow[]>()
  for (const row of rows) {
    const held = byAccount.get(row.account)
    if (held === undefined) byAccount.set(row.account, [row])
    else held.push(row)
  }
  return [...byAccount].map(([account, held]) => ({ account, ...partTotals(held, byId, EVERY_PART) }))
}
