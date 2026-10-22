import { installedPack } from '../../packs/packContribution'
import { presentedTransactions } from '../../settings/domain/profitAndLossLabels'
import { splitLedger } from '../../workbook/domain/splits'
import type { Workbook } from '../../workbook/domain/workbook'
import { countedSplits } from '../domain/countedSplits'

/**
 * The workbook as the figure screens count it: each split row replaced by its parts, and the rows
 * as the settings present them. Its splits are the ones counted, and its problems add the splits
 * left out. The ledger, the review queue, the rules and the writes keep the workbook as read.
 */
export function presentedWorkbook(workbook: Workbook): Workbook {
  const counted = countedSplits(workbook.splits, installedPack().rowsKeptWhole(workbook))
  return {
    ...workbook,
    transactions: presentedTransactions(splitLedger(workbook.transactions, counted.splits), workbook.settings),
    splits: counted.splits,
    problems: [...workbook.problems, ...counted.problems],
  }
}
