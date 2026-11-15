import { withGoogleAccess } from '../../google/withGoogleAccess'
import type { BooksRead, SessionWrite, WorkbookStore } from './createWorkbookStore'
import type { UnitOfWork } from './repository'

/**
 * Writes what the work does through the store, asking Google again when the page's access lapsed, and gives the session's
 * record of it for an Undo that the caller offers, or null when nothing changed. Throws as the store's write does, with no toast.
 * It is for a write that another file's write goes with, under one Undo.
 */
export async function sessionWrite(store: Pick<WorkbookStore<BooksRead>, 'state' | 'write'>, title: string, work: (unit: UnitOfWork) => void, key: string): Promise<SessionWrite | null> {
  const receipt = await withGoogleAccess([], () => store.write(title, work, { key, shownAtOnce: false }))
  return receipt === null ? null : (store.state.writes.find((written) => written.receipt === receipt) ?? null)
}
