import type { LedgerSplit } from '../../workbook/domain/splits'
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
export function countedSplits(splits: readonly LedgerSplit[], rowsKeptWhole: ReadonlyMap<number, readonly string[]>): CountedSplits {
  const problems: WorkbookProblem[] = []
  const counted = splits.filter((split) => {
    const claimedBy = rowsKeptWhole.get(split.row.sheetRow)
    if (claimedBy === undefined) {
      return true
    }
    const reason = `${claimedBy.map((name) => `"${name}"`).join(' and ')} on the assets tab ${claimedBy.length === 1 ? 'claims' : 'claim'} ledger row ${split.row.sheetRow} as payment, so the row counts whole`
    problems.push(...split.parts.map((part) => ({ tab: 'splits' as const, sheetRow: part.sheetRow, reason })))
    return false
  })
  return { splits: counted, problems }
}
