import { ownerShareProblems } from '../../owner-share/domain/ownerParts'
import { presentedTransactions } from '../../settings/domain/profitAndLossLabels'
import { splitLedger } from '../../workbook/domain/splits'
import type { Workbook } from '../../workbook/domain/workbook'
import { countedSplits } from '../domain/countedSplits'

/**
 * The workbook as booked, as Year and the tax figures count it: each split row replaced by its parts,
 * and the rows as the settings present them. The cash screens add the owner parts to it. Its splits
 * are the ones counted, and its problems add the splits left out and the shares that cannot count.
 * The ledger, the review queue, the rules and the writes keep the workbook as read.
 */
export function presentedWorkbook(workbook: Workbook): Workbook {
  const counted = countedSplits(workbook.splits, workbook.rowsKeptWhole)
  const presented = { ...workbook, transactions: presentedTransactions(splitLedger(workbook.transactions, counted.splits), workbook.settings), splits: counted.splits }
  return { ...presented, problems: [...workbook.problems, ...counted.problems, ...ownerShareProblems(presented)] }
}
