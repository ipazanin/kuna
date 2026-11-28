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
  readonly store: Pick<WorkbookStore<BooksRead>, 'state' | 'open' | 'sync' | 'canSyncSilently' | 'savedByNewerApp'>
  /** The app's own steps after its books, in order. For books kept in this browser, the page's sync runs only those that need no Drive. */
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
  /** The parts a sync runs, in install order: each app with its file on Drive, and each app with books kept in this browser that turn on a step needing no Drive. */
  syncedGroups(): readonly PageSyncGroup[]
  /** The last run of this page, with a failed read of an app's books outside a run, such as a find, shown as its books step. */
  readonly run: ComputedRef<SyncRun | null>
  readonly control: ComputedRef<SyncControl>
  /** Whether a sync runs some app's part. */
  readonly syncs: ComputedRef<boolean>
  /** Whether an app with a file on Drive lists the Keys step, so a sync carries the keys. Loans and Assets keep no key and list none, and books kept in this browser run no Keys step. */
  readonly keysSync: ComputedRef<boolean>
  /** Every group a sync runs, as `Sync.sync` says. Call it from a click handler. */
  sync(asking?: SyncAsking): Promise<void>
  /** Whether a sync now would open no popup and lack no access: some group on Drive holds a live token, or some group kept in this browser has every scope its steps need. */
  canSyncSilently(): boolean
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

/** The steps a sync runs after the group's books: every one for a file on Drive, and only those that need no Drive for books kept in this browser. */
function stepsOf(group: PageSyncGroup): readonly SyncStep[] {
  const steps = group.steps()
  return onDrive(group) ? steps : steps.filter((step) => step.needsNoDrive === true)
}

/** Whether a sync runs the group: a file on Drive, or books kept in this browser, once on screen, that turn on a step needing no Drive. */
function synced(group: PageSyncGroup): boolean {
  const { choice, workbook } = group.store.state
  return choice?.source === 'drive' || (choice?.source === 'browser' && workbook !== null && stepsOf(group).some((step) => step.on()))
}

/** What the group needs of Google: the app's own needs for a file on Drive, and only the scopes of the steps it runs for books kept in this browser, so no Drive scope. */
function needsOf(group: PageSyncGroup): AccessNeed[] {
  return onDrive(group) ? [...group.needs()] : stepsOf(group).flatMap((step) => step.scopes().map((scope) => ({ scope, label: step.label })))
}

/** The way on from a read that found the app's file in the bin or gone. */
function missingLink(group: PageSyncGroup): StepLink | null {
  return group.store.state.missing ? { label: syncWords.settings, to: group.fileCard } : null
}

/** The first step of a group whose books are kept in this browser, which has no file to read. */
const KEPT_BOOKS_STEP: SyncStep = {
  ...BOOKS_STEP,
  scopes: () => [],
  startLine: syncWords.reading,
  on: () => true,
  run: async () => ({ kind: 'done', line: syncWords.keptHere, writeId: null, link: null }),
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
 * per app it runs, one after another, and the control that shows them with what the page's token lacks.
 */
export function startPageSync(apps: readonly Pick<AppContribution, 'id' | 'name' | 'syncGroup'>[]): PageSync {
  const groups: readonly PageSyncGroup[] = apps.map((app) => ({ app: app.id, name: app.name, ...app.syncGroup() }))
  const syncedGroups = (): readonly PageSyncGroup[] => groups.filter(synced)
  const needs = (): AccessNeed[] => syncedGroups().flatMap(needsOf)

  // Every ask for a token carries what every group a sync runs needs, and the silent trip on the next open asks for it too.
  // A file still opening would leave its settings out, so the join waits until each one is on screen.
  watch(
    needs,
    (joined) => {
      if (groups.some((group) => group.store.state.workbook !== null) && syncedGroups().every((group) => group.store.state.workbook !== null)) {
        needScopes(joined.map((need) => need.scope))
      }
    },
    { immediate: true },
  )

  const sync = createSync({
    groups: (): SyncGroup[] => syncedGroups().map((group) => ({ app: group.app, name: group.name, books: onDrive(group) ? booksStep(group) : KEPT_BOOKS_STEP, steps: () => stepsOf(group) })),
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
    const drive = groups.filter(onDrive)
    return syncControlOf(
      run.value,
      {
        reading: groups.some((group) => group.store.state.status === 'syncing'),
        // Books kept in this browser are never read, so with no file on Drive the last finished run says when the mail was.
        syncedAt: drive.length > 0 ? oldestRead(drive.map((group) => group.store.state.syncedAt)) : (run.value?.finishedAt ?? null),
      },
      pageAccessOf(needs(), scopes, refusal),
      sync.state.askFailure,
    )
  })

  const groupOf = (app: string): PageSyncGroup | undefined => groups.find((group) => group.app === app)
  const undoing = ref(false)

  pageSync = {
    groups,
    syncedGroups,
    run,
    control,
    syncs: computed(() => syncedGroups().length > 0),
    keysSync: computed(() => syncedGroups().some((group) => stepsOf(group).some((step) => step.id === SECRETS_STEP))),
    sync: (asking) => (syncedGroups().length > 0 ? sync.sync(asking) : Promise.resolve()),
    canSyncSilently: () => syncedGroups().some((group) => (onDrive(group) ? group.store.canSyncSilently() : needsOf(group).every((need) => currentToken(need.scope) !== null))),
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
