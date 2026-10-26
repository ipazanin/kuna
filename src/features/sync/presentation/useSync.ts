import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { driveReadAccess, requestDriveReadToken } from '../../../shared/google/googleAuth'
import { noteDriveReadRefused } from '../../../shared/google/googleRedirect'
import { useStatementSync } from '../../imports/presentation/useStatementSync'
import { installedPack, shownPack } from '../../packs/packContribution'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { createSync } from '../application/sync'
import type { Sync, SyncStep } from '../application/sync'
import { BOOKS_STEP, syncControlOf, withBooksFailure } from '../domain/syncRun'
import type { SyncControl, SyncRun, SyncScope } from '../domain/syncRun'

/** Whether the page holds a token for the scope. The books ask for their own sign-in, and the fake build reads its folders unless this tab noted a refusal. */
function granted(scope: SyncScope): boolean {
  if (scope === 'drive.file') {
    return true
  }
  const access = driveReadAccess()
  return import.meta.env.VITE_FAKE_WORKBOOK === 'true' ? access !== 'needs-consent' : access === 'held'
}

/** Asks for the Drive read token with Google's consent screen when it needs one. The fake build only forgets the refusal. */
async function askForAccess(scopes: readonly SyncScope[]): Promise<void> {
  if (!scopes.includes('drive.readonly')) {
    return
  }
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    noteDriveReadRefused(false)
    return
  }
  await requestDriveReadToken()
}

function createPageSync(): Sync {
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
  return createSync({
    books,
    steps: () => [statements.step, ...packSteps],
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
}

let pageSync: Sync | null = null

export interface PageSync {
  /** The last run of this page, with a failed read of the books outside a run, such as a find, shown as its books step. */
  readonly run: ComputedRef<SyncRun | null>
  readonly control: ComputedRef<SyncControl>
  /** Every step that is on, in order, as `Sync.sync` says, for a file on Drive. Call it from a click handler. */
  sync(): Promise<void>
  /** Asks Google for what the steps lack, then syncs. Call it first in a click handler. */
  allowAccess(): Promise<void>
}

/** The one sync of the page: the books, then statements, then the pack's steps, and the control that shows it. */
export function useSync(): PageSync {
  pageSync ??= createPageSync()
  const { state, sync, allowAccess } = pageSync
  const store = useWorkbook()
  const run = computed(() => {
    const books = state.run?.steps[0]
    if (store.state.status !== 'error' || books?.state.kind === 'failed') {
      return state.run
    }
    return withBooksFailure(state.run, store.state.error ?? 'The file on Drive could not be read.', store.state.syncedAt ?? new Date().toISOString())
  })
  const control = computed(() =>
    syncControlOf(run.value, {
      chosen: store.state.choice?.source === 'drive',
      reading: store.state.status === 'syncing',
      syncedAt: store.state.syncedAt,
    }),
  )
  return { run, control, sync: () => (store.state.choice?.source === 'drive' ? sync() : Promise.resolve()), allowAccess }
}
