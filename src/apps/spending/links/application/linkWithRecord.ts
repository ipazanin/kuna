import { addLoansMovement } from './loanTargets'
import type { NewMovement, ShownTarget } from './loanTargets'
import type { LinkPlace } from '../domain/instalmentSplit'
import type { InformalLoanTarget, MovementTarget } from '../domain/linkTarget'
import { linkEntry } from '../../entries/application/entryWrites'
import type { SpendingBooks } from '../../workbook/domain/spendingBooks'
import type { Transaction } from '../../workbook/domain/transaction'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import { sessionWrite } from '../../../../shared/storage/application/sessionWrite'

/** The titles of the two writes, as each file's own list of writes shows them. */
export interface LinkTitles {
  readonly inLoans: string
  readonly linked: string
}

/**
 * What adding a movement in Loans and linking the row to it came to: both done, with one Undo for both, nothing done since
 * Loans refused the movement, or the movement added and the row not linked, with Undo for the movement alone. Either way the
 * movement added is named.
 */
export type MovementLinked =
  | { readonly outcome: 'linked'; readonly movement: MovementTarget; readonly undo: () => Promise<UndoneInLoans> }
  | { readonly outcome: 'not-added'; readonly failure: unknown }
  | { readonly outcome: 'not-linked'; readonly movement: MovementTarget; readonly failure: unknown; readonly undoInLoans: () => Promise<void> }

/** After Undo took the link off, whether Loans took the movement back too, or why it keeps it. */
export type UndoneInLoans = { readonly kept: false } | { readonly kept: true; readonly failure: unknown }

/**
 * Adds the movement to the informal loan in Loans, then links the row to it as `linkEntry` does, filing it under Loan principal.
 * Loans writes first, so a link never names a movement that is not there. When the link fails, the movement stays in Loans,
 * where it can be seen and deleted. Undo takes the link off first and the movement after.
 */
export async function addMovementAndLink(
  store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'write' | 'undo'>,
  row: Transaction,
  loan: ShownTarget & InformalLoanTarget,
  movement: NewMovement,
  place: LinkPlace,
  titles: LinkTitles,
): Promise<MovementLinked> {
  let added: Awaited<ReturnType<typeof addLoansMovement>>
  try {
    added = await addLoansMovement(loan, movement, titles.inLoans)
  } catch (failure) {
    return { outcome: 'not-added', failure }
  }
  try {
    const records = store.state.records
    if (records === null) throw new Error('The Spending file is not open.')
    const linked = await sessionWrite(store, titles.linked, (unit) => void linkEntry(unit, records, row, added.target, place), 'link')
    return {
      outcome: 'linked',
      movement: added.target,
      undo: async () => {
        if (linked !== null) await store.undo(linked)
        try {
          await added.undo()
          return { kept: false }
        } catch (failure) {
          return { kept: true, failure }
        }
      },
    }
  } catch (failure) {
    return { outcome: 'not-linked', movement: added.target, failure, undoInLoans: () => added.undo() }
  }
}
