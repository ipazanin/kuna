import { BANK_SYNC_SCOPE } from '../../../../shared/bank-sync/application/pageBankSync'
import { BANK_SYNC_STEP } from '../../bankSync/presentation/bankSyncStep'
import { SPENDING_SETTINGS_ROUTE } from '../../overview/presentation/spendingLinks'
import { ratesNeeded } from '../../rates/domain/ratesNeeded'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { bankSyncSetUp } from '../../workbook/domain/spendingSettings'
import LocalSpendingStatus from '../../workbook/presentation/LocalSpendingStatus.vue'
import { assistAllowedNow } from '../../../../shared/ai/presentation/aiProvider'
import { ratesStep } from '../../../../shared/rates/presentation/ratesStep'
import { secretsNeeds, secretsStep } from '../../../../shared/secrets/presentation/secretsStep'
import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'

/**
 * The Spending part of the page's sync: its file, the ECB rates of its foreign accounts, the keys while its assistant is on
 * or the bank sync is set up, and the banks once it is. The Keys step runs first, so a device that holds no bank key yet
 * fetches it before the banks are asked. Without bank sync it asks Google for nothing more and shows no such step.
 */
export function spendingSyncGroup(): AppSyncGroup {
  const store = useSpendingBooks()
  const bankSyncOn = (): boolean => store.state.workbook !== null && bankSyncSetUp(store.state.workbook.settings)
  const keysWanted = (): boolean => assistAllowedNow() || bankSyncOn()
  const keysStep = secretsStep(keysWanted)
  // Before the file is first read the step counts as on, as every step does.
  const ratesOfFile = ratesStep(
    () => store.state.workbook === null || ratesNeeded(store.state.workbook).size > 0,
    () => store.state.choice?.id ?? null,
  )
  return {
    store,
    steps: () => [keysStep, ratesOfFile, ...(bankSyncOn() ? [BANK_SYNC_STEP] : [])],
    needs: () => [
      ...BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
      ...(bankSyncOn() ? [{ scope: BANK_SYNC_SCOPE, label: BANK_SYNC_STEP.label }] : []),
      ...(store.state.missing ? [] : secretsNeeds(keysWanted)),
    ],
    undo: (write) => store.undo(write),
    exportControl: LocalSpendingStatus,
    fileCard: SPENDING_SETTINGS_ROUTE,
  }
}
