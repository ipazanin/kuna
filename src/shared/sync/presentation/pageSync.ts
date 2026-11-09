import { computed, ref, watch } from 'vue'
import type { Component, ComputedRef, Ref } from 'vue'

import type { AppContribution } from '../../app/appContribution'
import { currentToken, googleAccess, needScopes, requestAccess, signsInByRedirect } from '../../google/googleAuth'
import type { GoogleScope } from '../../google/googleScopes'
import { canUndo } from '../../storage/application/createWorkbookStore'
import type { BooksRead, SessionWrite, WorkbookStore } from '../../storage/application/createWorkbookStore'
import { SECRETS_STEP } from '../application/syncSteps'
import { createSync } from '../application/sync'
import type { SyncAsking, SyncGroup, SyncStep } from '../application/sync'
import { BOOKS_STEP, oldestRead, pageAccessOf, syncControlOf, withBooksFailure } from '../application/syncRun'
import type { AccessNeed, StepLink, SyncControl, SyncRun } from '../application/syncRun'
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
  /** The route of the app's file card, where a file in the bin or gone is found again or replaced. */
  readonly fileCard: string
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
  /** Whether some app's file is on Drive. */
  readonly someOnDrive: ComputedRef<boolean>
  /** Whether an app with a file on Drive lists the Keys step, so a sync carries the keys. Loans and Assets keep no key and list none. */
  readonly keysSync: ComputedRef<boolean>
  /** Every group of the apps with a file on Drive, as `Sync.sync` says. Call it from a click handler. */
  sync(asking?: SyncAsking): Promise<void>
  /** Whether a sync is under way, as `Sync.running` says. */
  running(): boolean
  /** Resolves once no sync is under way, as `Sync.settled` says. */
  settled(): Promise<void>
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

/** The way on from a read that found the app's file in the bin or gone. */
function missingLink(group: PageSyncGroup): StepLink | null {
  return group.store.state.missing ? { label: syncWords.settings, to: group.fileCard } : null
}

/** Reads the app's file on Drive again, the first step of its group. */
function booksStep(group: PageSyncGroup): SyncStep {
  const { store } = group
  return {
    ...BOOKS_STEP,
    scopes: () => BOOKS_STEP.scopes,
    startLine: syncWords.reading,
    on: () => true,
    async run() {
      await store.sync()
      return store.state.status === 'error'
        ? { kind: 'failed', line: store.state.error ?? syncWords.notRead, link: missingLink(group) }
        : { kind: 'done', line: syncWords.upToDate, writeId: null, link: null }
    },
  }
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
    groups: (): SyncGroup[] => driveGroups().map((group) => ({ app: group.app, name: group.name, books: booksStep(group), steps: () => group.steps() })),
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
      return withBooksFailure(shown, group, error ?? syncWords.notRead, syncedAt ?? new Date().toISOString(), missingLink(group))
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
    someOnDrive: computed(() => driveGroups().length > 0),
    keysSync: computed(() => driveGroups().some((group) => group.steps().some((step) => step.id === SECRETS_STEP))),
    sync: (asking) => (driveGroups().length > 0 ? sync.sync(asking) : Promise.resolve()),
    running: sync.running,
    settled: sync.settled,
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
