import type { AddedInLoans } from './loanTargets'
import type { ShownTarget } from './linkTargets'
import type { LinkPlace } from '../domain/instalmentSplit'
import type { LinkTarget } from '../domain/linkTarget'
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
 * What adding a record in Loans and linking the row to it came to: both done, with one Undo for both, nothing done since
 * Loans refused the record, or the record added and the row not linked, with Undo for the record alone. Either way the
 * record added is named.
 */
export type RecordLinked<Target extends LinkTarget> =
  | { readonly outcome: 'linked'; readonly record: ShownTarget & Target; readonly undo: () => Promise<UndoneInLoans> }
  | { readonly outcome: 'not-added'; readonly failure: unknown }
  | { readonly outcome: 'not-linked'; readonly record: ShownTarget & Target; readonly failure: unknown; readonly undoInLoans: () => Promise<void> }

/** After Undo took the link off, whether Loans took the record back too, or why it keeps it. */
export type UndoneInLoans = { readonly kept: false } | { readonly kept: true; readonly failure: unknown }

/**
 * Adds the record in Loans, such as a movement of an informal loan or an extra payment of a bank loan, then links the row to it
 * as `linkEntry` does, filing it under Loan principal. Loans writes first, so a link never names a record that is not there.
 * When the link fails, the record stays in Loans, where it can be seen and deleted. Undo takes the link off first and the record after.
 */
export async function addAndLink<Target extends LinkTarget>(
  store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'write' | 'undo'>,
  row: Transaction,
  addInLoans: () => Promise<AddedInLoans<Target>>,
  place: LinkPlace,
  titles: LinkTitles,
): Promise<RecordLinked<Target>> {
  let added: AddedInLoans<Target>
  try {
    added = await addInLoans()
  } catch (failure) {
    return { outcome: 'not-added', failure }
  }
  try {
    const records = store.state.records
    if (records === null) throw new Error('The Spending file is not open.')
    const linked = await sessionWrite(store, titles.linked, (unit) => void linkEntry(unit, records, row, added.target, place), 'link')
    return {
      outcome: 'linked',
      record: added.target,
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
    return { outcome: 'not-linked', record: added.target, failure, undoInLoans: () => added.undo() }
  }
}
