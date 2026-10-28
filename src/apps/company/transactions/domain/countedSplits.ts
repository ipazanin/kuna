import { amountOf } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { LedgerSplit, SplitPart } from '../../workbook/domain/splits'
import type { WorkbookProblem } from '../../workbook/domain/workbook'

/** The splits the screens count, and why they leave out any the tab holds. */
export interface CountedSplits {
  readonly splits: readonly LedgerSplit[]
  readonly problems: readonly WorkbookProblem[]
}

/** The splits of the `splits` tab less those of a row a pack keeps whole. `rowsKeptWhole` says why it keeps each such row, by the row. */
export function countedSplits(splits: readonly LedgerSplit[], rowsKeptWhole: ReadonlyMap<RecordId, string>): CountedSplits {
  const problems: WorkbookProblem[] = []
  const counted = splits.filter((split) => {
    const why = rowsKeptWhole.get(split.row.id)
    if (why === undefined) {
      return true
    }
    const reason = `the ${split.row.account} row of ${split.row.date} stays whole, since ${why}`
    problems.push(...split.parts.map((part) => ({ tab: 'splits' as const, id: part.id, label: partLabel(split, part), reason })))
    return false
  })
  return { splits: counted, problems }
}

/** A part as the splits tab names it: its category, amount and day. */
function partLabel(split: LedgerSplit, part: SplitPart): string {
  return [part.category, String(amountOf(part.amount)), split.row.date].join(', ')
}
