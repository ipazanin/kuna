import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A row a file brings, by its product, currency and day, with the account it goes to, or null while Kuna keeps none for it. */
export interface HeldRow {
  readonly savings: boolean
  readonly currency: string
  readonly date: CivilDate
  readonly account: RecordId | null
}

/** What a file holds of one product in one currency: how many rows, from which day to which, and the account they go to, or null for none. */
export interface FileHolding {
  readonly savings: boolean
  readonly currency: string
  readonly rows: number
  readonly first: CivilDate
  readonly last: CivilDate
  readonly account: RecordId | null
}

/** The file's rows gathered by product and currency, current before savings and then in the order the file first names each currency. */
export function fileHoldings(rows: readonly HeldRow[]): readonly FileHolding[] {
  const holdings = new Map<string, FileHolding>()
  for (const row of rows) {
    const key = `${row.savings} ${row.currency}`
    const held = holdings.get(key)
    holdings.set(
      key,
      held === undefined
        ? { savings: row.savings, currency: row.currency, rows: 1, first: row.date, last: row.date, account: row.account }
        : { ...held, rows: held.rows + 1, first: row.date < held.first ? row.date : held.first, last: row.date > held.last ? row.date : held.last },
    )
  }
  return [...holdings.values()].sort((one, other) => Number(one.savings) - Number(other.savings))
}
