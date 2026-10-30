import { computed, ref, watch } from 'vue'
import type { Component, ComputedRef, Ref } from 'vue'

import type { AppContribution } from '../../app/appContribution'
import { currentToken, googleAccess, needScopes, requestAccess, signsInByRedirect } from '../../google/googleAuth'
import type { GoogleScope } from '../../google/googleScopes'
import { canUndo } from '../../storage/application/createWorkbookStore'
import type { BooksRead, SessionWrite, WorkbookStore } from '../../storage/application/createWorkbookStore'
import { createSync } from '../application/sync'
import type { SyncGroup, SyncStep } from '../application/sync'
import { BOOKS_STEP, oldestRead, pageAccessOf, syncControlOf, withBooksFailure } from '../application/syncRun'
import type { AccessNeed, SyncControl, SyncRun } from '../application/syncRun'
import { words as syncWords } from '../application/words'

/** What an app gives the page's one sync. */
export interface AppSyncGroup {
  /** The app's books, which its group reads first. */
  readonly store: Pick<WorkbookStore<BooksRead>, 'state' | 'open' | 'sync' | 'canSyncSilently'>
  /** The app's own steps after its books, in order. */
  steps(): readonly SyncStep[]
  /** The Google permissions the app's books on screen and this device's settings need while its file is on Drive, the books file's among them, by what needs each. */
  needs(): readonly AccessNeed[]
  /** Puts back what a write of this session changed, and says so. */
  undo(write: SessionWrite): Promise<void>
  /** The top bar's export control while the app's file is kept in this browser. It takes `compact`, the narrow form. */
  readonly exportControl: Component
}

/** An app's part of the page's sync, under the app's id and name. */
export interface PageSyncGroup extends AppSyncGroup {
  readonly app: string
  readonly name: string
}

export interface PageSync {
  /** Each installed app's part, in install order. */
  readonly groups: readonly PageSyncGroup[]
  /** The last run of this page, with a failed read of an app's books outside a run, such as a find, shown as its books step. */
  readonly run: ComputedRef<SyncRun | null>
  readonly control: ComputedRef<SyncControl>
  /** Every group of the apps with a file on Drive, as `Sync.sync` says. Call it from a click handler. */
  sync(): Promise<void>
  /** Asks Google for what the steps and the settings lack, then syncs. Call it first in a click handler. */
  allowAccess(): Promise<void>
  /** Saves, asking Google in the same tap for these scopes, then syncs, as `Sync.saveAllowing` says. Call it first in a click handler. */
  saveAllowing(scopes: readonly GoogleScope[], save: () => Promise<boolean>): Promise<void>
  /** The write a step of the app made, while Undo can still put it back, or null. */
  undoable(app: string, writeId: number | null): SessionWrite | null
  /** True while an Undo from the step list is under way. */
  readonly undoing: Readonly<Ref<boolean>>
  undo(app: string, write: SessionWrite): Promise<void>
}

/** Whether the page's token carries the scope. The books ask for their own token in the tap that syncs. */
function granted(scope: GoogleScope): boolean {
  return scope === 'drive.file' || currentToken(scope) !== null
}

/** Asks Google for one token with every scope the settings need, the missing ones among them, and syncs once back on a phone. */
function askForAccess(scopes: readonly GoogleScope[]): Promise<void> {
  return requestAccess(scopes, { resume: 'sync' })
}

function onDrive(group: PageSyncGroup): boolean {
  return group.store.state.choice?.source === 'drive'
}

/** Reads the app's file on Drive again, the first step of its group. */
function booksStep(store: AppSyncGroup['store']): SyncStep {
  return {
    ...BOOKS_STEP,
    scopes: () => BOOKS_STEP.scopes,
    startLine: syncWords.reading,
    on: () => true,
    async run() {
      await store.sync()
      return store.state.status === 'error' ? { kind: 'failed', line: store.state.error ?? syncWords.notRead, link: null } : { kind: 'done', line: syncWords.upToDate, writeId: null, link: null }
    },
  }
}

function whenIdle(store: AppSyncGroup['store']): Promise<void> {
  return new Promise<void>((resolve) => {
    const stop = watch(
      () => !store.state.writing && store.state.status !== 'syncing',
      (idle) => {
        if (!idle) return
        queueMicrotask(() => stop())
        resolve()
      },
      { immediate: true },
    )
  })
}

let pageSync: PageSync | null = null

/**
 * Makes the page's one sync over every installed app, which the shell starts as it mounts: a group
 * per app with its file on Drive, one after another, and the control that shows them with what the
 * page's token lacks.
 */
export function startPageSync(apps: readonly Pick<AppContribution, 'id' | 'name' | 'syncGroup'>[]): PageSync {
  const groups: readonly PageSyncGroup[] = apps.map((app) => ({ app: app.id, name: app.name, ...app.syncGroup() }))
  const driveGroups = (): readonly PageSyncGroup[] => groups.filter(onDrive)
  const needs = (): AccessNeed[] => driveGroups().flatMap((group) => group.needs())

  // Every ask for a token carries what every app with a file on Drive needs, and the silent trip on the next open asks for it too.
  // A file still opening would leave its settings out, so the join waits until each one is on screen.
  watch(
    needs,
    (joined) => {
      if (groups.some((group) => group.store.state.workbook !== null) && driveGroups().every((group) => group.store.state.workbook !== null)) {
        needScopes(joined.map((need) => need.scope))
      }
    },
    { immediate: true },
  )

  const sync = createSync({
    groups: (): SyncGroup[] => driveGroups().map((group) => ({ app: group.app, name: group.name, books: booksStep(group.store), steps: () => group.steps(), whenIdle: () => whenIdle(group.store) })),
    granted,
    askForAccess,
    asksByLeaving: signsInByRedirect,
    now: () => new Date().toISOString(),
  })

  const run = computed(() =>
    groups.reduce((shown, group) => {
      const { choice, status, error, syncedAt } = group.store.state
      const books = shown?.groups.find((candidate) => candidate.app === group.app)?.steps[0]
      if (choice?.source === 'browser' || status !== 'error' || books?.state.kind === 'failed') {
        return shown
      }
      return withBooksFailure(shown, group, error ?? syncWords.notRead, syncedAt ?? new Date().toISOString())
    }, sync.state.run),
  )

  const control = computed(() => {
    const { scopes, refusal } = googleAccess()
    const drive = driveGroups()
    return syncControlOf(
      run.value,
      {
        reading: groups.some((group) => group.store.state.status === 'syncing'),
        syncedAt: oldestRead(drive.map((group) => group.store.state.syncedAt)),
      },
      pageAccessOf(needs(), scopes, refusal),
      sync.state.askFailure,
    )
  })

  const groupOf = (app: string): PageSyncGroup | undefined => groups.find((group) => group.app === app)
  const undoing = ref(false)

  pageSync = {
    groups,
    run,
    control,
    sync: () => (driveGroups().length > 0 ? sync.sync() : Promise.resolve()),
    allowAccess: sync.allowAccess,
    saveAllowing: sync.saveAllowing,
    undoable(app, writeId) {
      const writes = groupOf(app)?.store.state.writes ?? []
      const write = writes.find((written) => written.id === writeId)
      return write !== undefined && canUndo(write, writes) ? write : null
    },
    undoing,
    async undo(app, write) {
      undoing.value = true
      try {
        await groupOf(app)?.undo(write)
      } finally {
        undoing.value = false
      }
    },
  }
  return pageSync
}

/** The page's one sync, which the shell started as it mounted. */
export function usePageSync(): PageSync {
  if (pageSync === null) {
    throw new Error('The page sync has not started. The shell starts it before any screen shows.')
  }
  return pageSync
}
