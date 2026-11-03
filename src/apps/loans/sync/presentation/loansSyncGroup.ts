import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'
import { LOANS_SETTINGS_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import LocalLoansStatus from '../../workbook/presentation/LocalLoansStatus.vue'

/** The Loans part of the page's sync: its file alone, with no steps of its own yet. */
export function loansSyncGroup(): AppSyncGroup {
  const store = useLoansBooks()
  return {
    store,
    steps: () => [],
    needs: () => BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
    undo: (write) => store.undo(write),
    exportControl: LocalLoansStatus,
    fileCard: LOANS_SETTINGS_ROUTE,
  }
}
