import type { ShownTarget } from './linkTargets'
import type { LinkPlace } from '../domain/linkFiling'
import type { LinkTarget } from '../domain/linkTarget'
import { linkEntry } from '../../entries/application/entryWrites'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { SpendingBooks } from '../../workbook/domain/spendingBooks'
import type { Transaction } from '../../workbook/domain/transaction'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import { sessionWrite } from '../../../../shared/storage/application/sessionWrite'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** A record added in another app from a row, as Spending links to it, with the Undo of that app's write. */
export interface AddedInApp<Target extends LinkTarget> {
  readonly target: ShownTarget & Target
  undo(): Promise<void>
}

/** The titles of the two writes, as each file's own list of writes shows them. */
export interface LinkTitles {
  /** The write in the other app. */
  readonly added: string
  readonly linked: string
}

/** How the row is linked to the record the other app added, in the one write Undo takes back. */
export type LinkStep<Target extends LinkTarget> = (unit: UnitOfWork, records: SpendingRecords, row: Transaction, added: Target, place: LinkPlace) => unknown

/**
 * What adding a record in another app and linking the row to it came to: both done, with one Undo for both, nothing done since
 * the app refused the record, or the record added and the row not linked, with Undo for the record alone. Either way the
 * record added is named.
 */
export type RecordLinked<Target extends LinkTarget> =
  | { readonly outcome: 'linked'; readonly record: ShownTarget & Target; readonly undo: () => Promise<UndoneInApp> }
  | { readonly outcome: 'not-added'; readonly failure: unknown }
  | { readonly outcome: 'not-linked'; readonly record: ShownTarget & Target; readonly failure: unknown; readonly undoAdded: () => Promise<void> }

/** After Undo took the link off, whether the other app took the record back too, or why it keeps it. */
export type UndoneInApp = { readonly kept: false } | { readonly kept: true; readonly failure: unknown }

/**
 * Adds the record in the other app, such as a movement of an informal loan in Loans or a cost you paid in Company, then links
 * the row to it as `link` does, `linkEntry` unless given. The other app writes first, so a link never names a record that is not there. When the
 * link fails, the record stays in that app, where it can be seen and deleted. Undo takes the link off first and the record after.
 */
export async function addAndLink<Target extends LinkTarget>(
  store: Pick<WorkbookStore<SpendingBooks>, 'state' | 'write' | 'undo'>,
  row: Transaction,
  addInApp: () => Promise<AddedInApp<Target>>,
  place: LinkPlace,
  titles: LinkTitles,
  link: LinkStep<Target> = linkEntry,
): Promise<RecordLinked<Target>> {
  let added: AddedInApp<Target>
  try {
    added = await addInApp()
  } catch (failure) {
    return { outcome: 'not-added', failure }
  }
  try {
    const records = store.state.records
    if (records === null) throw new Error('The Spending file is not open.')
    const linked = await sessionWrite(store, titles.linked, (unit) => void link(unit, records, row, added.target, place), 'link')
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
    return { outcome: 'not-linked', record: added.target, failure, undoAdded: () => added.undo() }
  }
}
