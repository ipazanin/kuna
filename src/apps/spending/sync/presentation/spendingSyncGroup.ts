import { BANK_SYNC_SCOPE } from '../../bankSync/presentation/bankSyncPort'
import { BANK_SYNC_STEP } from '../../bankSync/presentation/bankSyncStep'
import { SPENDING_SETTINGS_ROUTE } from '../../overview/presentation/spendingLinks'
import { ratesNeeded } from '../../rates/domain/ratesNeeded'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { SPENDING_APP } from '../../workbook/domain/spendingBooks'
import LocalSpendingStatus from '../../workbook/presentation/LocalSpendingStatus.vue'
import { assistOn } from '../../../../shared/ai/application/assistSettings'
import { ratesStep } from '../../../../shared/rates/presentation/ratesStep'
import { secretsNeeds, secretsStep } from '../../../../shared/secrets/presentation/secretsStep'
import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'

/** The Spending part of the page's sync: its file, the ECB rates of its foreign accounts, the keys while its assistant is on, and the banks once a bank sync script is saved. Without one it asks Google for nothing more and shows no such step. */
export function spendingSyncGroup(): AppSyncGroup {
  const store = useSpendingBooks()
  const savedScript = (): boolean => (store.state.workbook?.settings.bankSyncDeployment ?? '') !== ''
  const assistWanted = (): boolean => assistOn(SPENDING_APP)
  const keysStep = secretsStep(assistWanted)
  // Before the file is first read the step counts as on, as every step does.
  const ratesOfFile = ratesStep(
    () => store.state.workbook === null || ratesNeeded(store.state.workbook).size > 0,
    () => store.state.choice?.id ?? null,
  )
  return {
    store,
    steps: () => [keysStep, ratesOfFile, ...(savedScript() ? [BANK_SYNC_STEP] : [])],
    needs: () => [
      ...BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
      ...(savedScript() ? [{ scope: BANK_SYNC_SCOPE, label: BANK_SYNC_STEP.label }] : []),
      ...(store.state.missing ? [] : secretsNeeds(assistWanted)),
    ],
    undo: (write) => store.undo(write),
    exportControl: LocalSpendingStatus,
    fileCard: SPENDING_SETTINGS_ROUTE,
  }
}
