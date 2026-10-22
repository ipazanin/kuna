import { amountOf } from '../../../shared/money/money'
import type { RecordId } from '../../workbook/domain/recordId'
import type { LedgerSplit, SplitPart } from '../../workbook/domain/splits'
import type { WorkbookProblem } from '../../workbook/domain/workbook'

/** The splits the screens count, and why they leave out any the tab holds. */
export interface CountedSplits {
  readonly splits: readonly LedgerSplit[]
  readonly problems: readonly WorkbookProblem[]
}

/**
 * The splits of the `splits` tab less those of a row kept whole, such as one an asset claims as
 * its whole payment. `rowsKeptWhole` names what claims each such row, by the row.
 */
export function countedSplits(splits: readonly LedgerSplit[], rowsKeptWhole: ReadonlyMap<RecordId, readonly string[]>): CountedSplits {
  const problems: WorkbookProblem[] = []
  const counted = splits.filter((split) => {
    const claimedBy = rowsKeptWhole.get(split.row.id)
    if (claimedBy === undefined) {
      return true
    }
    const reason = `${claimedBy.map((name) => `"${name}"`).join(' and ')} on the assets tab ${claimedBy.length === 1 ? 'claims' : 'claim'} the ${split.row.account} row of ${split.row.date} as payment, so the row counts whole`
    problems.push(...split.parts.map((part) => ({ tab: 'splits' as const, id: part.id, label: partLabel(split, part), reason })))
    return false
  })
  return { splits: counted, problems }
}

/** A part as the splits tab names it: its category, amount and day. */
function partLabel(split: LedgerSplit, part: SplitPart): string {
  return [part.category, String(amountOf(part.amount)), split.row.date].join(', ')
}
