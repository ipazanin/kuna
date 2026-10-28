import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { currentToken, googleAccess, needScopes, requestAccess, signsInByRedirect } from '../../../../shared/google/googleAuth'
import { scopesOf } from '../../../../shared/google/googleScopes'
import { useStatementSync } from '../../imports/presentation/useStatementSync'
import { useMailSync } from '../../mail/presentation/useMailSync'
import { mailDraftsOn } from '../../invoicing/infrastructure/mailDraftSwitch'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Workbook } from '../../workbook/domain/workbook'
import { createSync } from '../application/sync'
import type { Sync, SyncStep } from '../application/sync'
import { BOOKS_STEP, pageAccessOf, syncControlOf, withBooksFailure } from '../domain/syncRun'
import type { AccessNeed, SyncControl, SyncRun, SyncScope } from '../domain/syncRun'

/** Whether the page's token carries the scope. The books ask for their own token in the tap that syncs. */
function granted(scope: SyncScope): boolean {
  return scope === 'drive.file' || currentToken(scope) !== null
}

/** Asks Google for one token with every scope the settings need, the missing ones among them, and syncs once back on a phone. */
function askForAccess(scopes: readonly SyncScope[]): Promise<void> {
  return requestAccess(scopes, 'sync')
}

function createPageSync(): { readonly sync: Sync; readonly steps: readonly SyncStep[] } {
  const store = useWorkbook()
  const statements = useStatementSync()
  const mail = useMailSync()
  const books: SyncStep = {
    ...BOOKS_STEP,
    scopes: () => BOOKS_STEP.scopes,
    startLine: 'Reading the file',
    on: () => true,
    async run() {
      await store.sync()
      return store.state.status === 'error'
        ? { kind: 'failed', line: store.state.error ?? 'The file on Drive could not be read.', link: null }
        : { kind: 'done', line: 'Up to date', writeId: null, link: null }
    },
  }
  const steps = [mail.step, statements.step]
  // Every ask for a token carries what the books on screen and this device's settings need, and the silent trip on the next open asks for it too.
  watch(
    () => needsOf(steps),
    (needs) => {
      if (store.state.workbook !== null) needScopes(needs.map((need) => need.scope))
    },
    { immediate: true },
  )
  const sync = createSync({
    books,
    steps: () => steps,
    workbook: () => store.state.workbook,
    granted,
    askForAccess,
    asksByLeaving: signsInByRedirect,
    whenIdle: () =>
      new Promise<void>((resolve) => {
        const stop = watch(
          () => !store.state.writing && store.state.status !== 'syncing',
          (idle) => {
            if (!idle) return
            queueMicrotask(() => stop())
            resolve()
          },
          { immediate: true },
        )
      }),
    now: () => new Date().toISOString(),
  })
  return { sync, steps }
}

/** The Google permissions books on Drive and this device's settings need, by what needs each: the books, each step their settings turn on, and Gmail while invoice drafts are on. */
function needsOfBooks(steps: readonly SyncStep[], workbook: Workbook | null): AccessNeed[] {
  return [
    ...BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
    ...(workbook === null ? [] : steps.filter((step) => step.on(workbook)).flatMap((step) => step.scopes(workbook).map((scope) => ({ scope, label: step.label })))),
    ...(mailDraftsOn.value ? [{ scope: 'gmail.compose' as const, label: 'Invoicing' }] : []),
  ]
}

/** What the books on screen need, while they are a file on Drive. */
function needsOf(steps: readonly SyncStep[]): AccessNeed[] {
  const store = useWorkbook()
  return store.state.choice?.source === 'drive' ? needsOfBooks(steps, store.state.workbook) : []
}

let pageSync: { readonly sync: Sync; readonly steps: readonly SyncStep[] } | null = null

export interface PageSync {
  /** The last run of this page, with a failed read of the books outside a run, such as a find, shown as its books step. */
  readonly run: ComputedRef<SyncRun | null>
  readonly control: ComputedRef<SyncControl>
  /** Every step that is on, in order, as `Sync.sync` says, for a file on Drive. Call it from a click handler. */
  sync(): Promise<void>
  /** Asks Google for what the steps and the settings lack, then syncs. Call it first in a click handler. */
  allowAccess(): Promise<void>
  /** The scopes these books need once they are on Drive, such as books kept in this browser that are about to move there. */
  scopesNeededBy(workbook: Workbook): SyncScope[]
  /**
   * Saves settings, asking Google in the same tap for what the books as saved need that the books
   * on screen did not and the page's token lacks, then syncs. `after` is the books as the save
   * leaves them. Call it first in a click handler.
   */
  saveAllowing(after: Workbook, save: () => Promise<boolean>): Promise<void>
}

/** The one sync of the page: the books, then mail, then statements, and the control that shows it with what the page's token lacks. */
export function useSync(): PageSync {
  pageSync ??= createPageSync()
  const { state, sync, allowAccess, saveAllowing } = pageSync.sync
  const { steps } = pageSync
  const store = useWorkbook()
  const run = computed(() => {
    const books = state.run?.steps[0]
    if (store.state.status !== 'error' || books?.state.kind === 'failed') {
      return state.run
    }
    return withBooksFailure(state.run, store.state.error ?? 'The file on Drive could not be read.', store.state.syncedAt ?? new Date().toISOString())
  })
  const control = computed(() => {
    const { scopes, refusal } = googleAccess()
    return syncControlOf(
      run.value,
      {
        chosen: store.state.choice?.source === 'drive',
        reading: store.state.status === 'syncing',
        syncedAt: store.state.syncedAt,
      },
      pageAccessOf(needsOf(steps), scopes, refusal),
      state.askFailure,
    )
  })
  return {
    run,
    control,
    sync: () => (store.state.choice?.source === 'drive' ? sync() : Promise.resolve()),
    allowAccess,
    scopesNeededBy: (workbook) => scopesOf(needsOfBooks(steps, workbook).map((need) => need.scope)),
    saveAllowing(after, save) {
      const before = new Set(needsOf(steps).map((need) => need.scope))
      const added = store.state.choice?.source === 'drive' ? scopesOf(needsOfBooks(steps, after).map((need) => need.scope)).filter((scope) => !before.has(scope) && currentToken(scope) === null) : []
      return saveAllowing(added, save)
    },
  }
}
