import { currentToken } from '../../../../shared/google/googleAuth'
import { scopesOf } from '../../../../shared/google/googleScopes'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AccessNeed } from '../../../../shared/sync/application/syncRun'
import { usePageSync } from '../../../../shared/sync/presentation/pageSync'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'
import { statementNeeds, useStatementSync } from '../../imports/presentation/useStatementSync'
import { mailDraftsOn } from '../../invoicing/infrastructure/mailDraftSwitch'
import { mailNeeds, useMailSync } from '../../mail/presentation/useMailSync'
import LocalWorkbookStatus from '../../workbook-files/presentation/LocalWorkbookStatus.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Workbook } from '../../workbook/domain/workbook'
import { useFindDriveFile } from '../../workbook/presentation/useFindDriveFile'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'

/** The Google permissions books on Drive and this device's settings need, by what needs each: the books, each step their settings turn on, and Gmail while invoice drafts are on. */
function needsOfBooks(workbook: Workbook | null): AccessNeed[] {
  return [
    ...BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
    ...(workbook === null ? [] : [...mailNeeds(workbook), ...statementNeeds(workbook)]),
    ...(mailDraftsOn.value ? [{ scope: 'gmail.compose' as const, label: 'Invoicing' }] : []),
  ]
}

/** The company's part of the page's sync: its books, then mail, then statements. */
export function companySyncGroup(): AppSyncGroup {
  const store = useWorkbook()
  const writes = useRecordWrites()
  const { findDriveFile } = useFindDriveFile()
  const steps = [useMailSync().step, useStatementSync().step]
  return {
    store,
    steps: () => steps,
    needs: () => needsOfBooks(store.state.workbook),
    undo: writes.undo,
    async findDriveFile() {
      await findDriveFile('find')
    },
    exportControl: LocalWorkbookStatus,
  }
}

export interface CompanySync {
  /** The scopes these books need once they are on Drive, such as books kept in this browser that are about to move there. */
  scopesNeededBy(workbook: Workbook): GoogleScope[]
  /**
   * Saves settings, asking Google in the same tap for what the books as saved need that the books
   * on screen did not and the page's token lacks, then syncs. `after` is the books as the save
   * leaves them. Call it first in a click handler.
   */
  saveAllowing(after: Workbook, save: () => Promise<boolean>): Promise<void>
}

/** What the company's books need of the page's sync, worked out for books not on screen too. */
export function useSync(): CompanySync {
  const store = useWorkbook()
  const page = usePageSync()
  return {
    scopesNeededBy: (workbook) => scopesOf(needsOfBooks(workbook).map((need) => need.scope)),
    saveAllowing(after, save) {
      if (store.state.choice?.source !== 'drive') {
        return page.saveAllowing([], save)
      }
      const before = new Set(needsOfBooks(store.state.workbook).map((need) => need.scope))
      const added = scopesOf(needsOfBooks(after).map((need) => need.scope)).filter((scope) => !before.has(scope) && currentToken(scope) === null)
      return page.saveAllowing(added, save)
    },
  }
}
