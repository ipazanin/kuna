import { SPLIT_ROWS, splitCellsOf } from '../../../features/transactions/application/splitRows'
import { OWNER_ADVANCE_ROWS } from '../../../features/workbook/application/ownerAdvanceRows'
import { rowCellsOf } from '../../../features/workbook/application/tabRowWrites'
import type { WorkbookStore } from '../../../features/workbook/application/workbookStore'
import { WorkbookWriteRefused } from '../../../features/workbook/application/workbookWriter'
import type { Category, PrivateShareToMove, Transaction } from '../../../features/workbook/domain/workbook'
import { privateShareSplit } from '../domain/countedSplits'

/**
 * Moves a private share from the owner-advances tab to the splits tab: first the split of the
 * bank row it came off, then the deletion of its advance row, each through the row write path.
 * When the deletion fails, the split rows are taken back, so the share is never counted twice.
 * With `addSplitsTab`, which the person must have agreed to, a Google Sheet without the splits
 * tab gets it first.
 */
export async function moveShareToSplits(
  store: WorkbookStore,
  share: PrivateShareToMove,
  row: Transaction,
  privateCategory: Category,
  addSplitsTab: boolean,
): Promise<void> {
  const advance = store.state.snapshot?.['owner-advances'].find((candidate) => candidate.sheetRow === share.sheetRow)
  if (advance === undefined) {
    throw new WorkbookWriteRefused('The private share is no longer on the owner-advances tab as the app read it. Sync and look again. Nothing was written.')
  }
  const advanceCells = rowCellsOf(advance, OWNER_ADVANCE_ROWS.columns)
  const { parts } = privateShareSplit(share, row, privateCategory)
  const receipt = await store.changeRows(SPLIT_ROWS, { added: parts.map((part) => splitCellsOf(row, part)), changed: [], removed: [] }, addSplitsTab)
  const splitWrite = store.state.writes.find((write) => write.kind === 'rows' && write.receipt === receipt)
  try {
    await store.changeRows(OWNER_ADVANCE_ROWS, { added: [], changed: [], removed: [{ sheetRow: share.sheetRow, cells: advanceCells }] })
  } catch (failure) {
    const reason = failure instanceof Error ? failure.message : String(failure)
    if (splitWrite === undefined) {
      throw failure
    }
    try {
      await store.undo(splitWrite)
    } catch (undoFailure) {
      const undoReason = undoFailure instanceof Error ? undoFailure.message : String(undoFailure)
      throw new Error(`The split was written, but the advance row was not deleted: ${reason} Taking the split back failed too: ${undoReason} Delete the split on Transactions.`)
    }
    throw new WorkbookWriteRefused(`The advance row was not deleted, so the split was taken back and nothing changed. ${reason}`)
  }
}
