import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { currentToken, googleAccess, needScopes, requestAccess } from '../../../shared/google/googleAuth'
import { useStatementSync } from '../../imports/presentation/useStatementSync'
import { mailDraftsOn } from '../../invoicing/infrastructure/mailDraftSwitch'
import { installedPack, shownPack } from '../../packs/packContribution'
import { useWorkbook } from '../../workbook/application/workbookStore'
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
  const books: SyncStep = {
    ...BOOKS_STEP,
    startLine: 'Reading the file',
    on: () => true,
    async run() {
      await store.sync()
      return store.state.status === 'error'
        ? { kind: 'failed', line: store.state.error ?? 'The file on Drive could not be read.' }
        : { kind: 'done', line: 'Up to date', writeId: null, link: null }
    },
  }
  const packSteps = installedPack().syncSteps.map((step): SyncStep => ({ ...step, on: (workbook) => shownPack(workbook.settings).syncSteps.includes(step) && step.on(workbook) }))
  const steps = [statements.step, ...packSteps]
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

/** The Google permissions the books on Drive and this device's settings need, by what needs each: the books, each step that is on, and Gmail while invoice drafts are on. */
function needsOf(steps: readonly SyncStep[]): AccessNeed[] {
  const store = useWorkbook()
  const workbook = store.state.workbook
  if (store.state.choice?.source !== 'drive') {
    return []
  }
  return [
    { scope: BOOKS_STEP.scope, label: BOOKS_STEP.label },
    ...(workbook === null ? [] : steps.filter((step) => step.on(workbook)).map((step) => ({ scope: step.scope, label: step.label }))),
    ...(mailDraftsOn.value ? [{ scope: 'gmail.compose' as const, label: 'Invoicing' }] : []),
  ]
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
}

/** The one sync of the page: the books, then statements, then the pack's steps, and the control that shows it with what the page's token lacks. */
export function useSync(): PageSync {
  pageSync ??= createPageSync()
  const { state, sync, allowAccess } = pageSync.sync
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
    )
  })
  return { run, control, sync: () => (store.state.choice?.source === 'drive' ? sync() : Promise.resolve()), allowAccess }
}
