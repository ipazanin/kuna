import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'
import { useLoansBooks } from '../../workbook/application/loansStore'
import LocalLoansStatus from '../../workbook/presentation/LocalLoansStatus.vue'
import { useFindLoansFile } from '../../workbook/presentation/useFindLoansFile'

/** The Loans part of the page's sync: its file alone, with no steps of its own yet. */
export function loansSyncGroup(): AppSyncGroup {
  const store = useLoansBooks()
  const findLoansFile = useFindLoansFile()
  return {
    store,
    steps: () => [],
    needs: () => BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
    undo: (write) => store.undo(write),
    async findDriveFile() {
      await findLoansFile('find')
    },
    exportControl: LocalLoansStatus,
  }
}
