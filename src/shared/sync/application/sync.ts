import { shallowReactive, shallowReadonly } from 'vue'

import { isUnauthorized } from '../../google/googleApi'
import type { GoogleScope } from '../../google/googleScopes'
import { accessLostFrom, finishedRun, needsAccess, replanned, skippedAfter, startedRun, stepsNeedingAccess, withStep } from './syncRun'
import type { PlannedStep, StepResult, SyncRun } from './syncRun'

/** One step of a sync, which an app contributes. It reads its own app's books on screen for its scopes and its switch. */
export interface SyncStep {
  readonly id: string
  /** Its name in the control and the step list, such as Statements. */
  readonly label: string
  /** Every scope its run needs for the books on screen, or for books not read yet. */
  scopes(): readonly GoogleScope[]
  /** The line it shows as it starts. */
  readonly startLine: string
  /** Whether the settings of the books on screen turn it on. Before the first copy it counts as on. */
  on(): boolean
  /** Runs the step and says what it did. `report` changes the line it shows while it runs. */
  run(report: (line: string) => void): Promise<StepResult>
}

/** One app's part of a sync: its books step, whose failure skips the rest of the group, then its own steps. */
export interface SyncGroup {
  /** The app's id. */
  readonly app: string
  readonly name: string
  readonly books: SyncStep
  /** The steps after the books, in order. */
  steps(): readonly SyncStep[]
  /** Resolves once no save or other read of the app's books is under way. */
  whenIdle(): Promise<void>
}

export interface SyncPorts {
  /** The groups a sync runs, in order, one for each app with its file on Drive. */
  groups(): readonly SyncGroup[]
  /** Whether the page holds a token for the scope. */
  granted(scope: GoogleScope): boolean
  /** Asks Google for the scopes, with its consent screen when it needs one. Call it first in a click handler. */
  askForAccess(scopes: readonly GoogleScope[]): Promise<void>
  /** Whether asking Google sends the tab away to Google and back, as on a phone, instead of opening a popup over the page. */
  asksByLeaving(): boolean
  now(): string
}

export interface SyncState {
  /** The last run of this page, or the one under way, or null before any. */
  readonly run: SyncRun | null
  /** Why the last tap's ask to Google gave no token, such as a popup the person closed, or null. */
  readonly askFailure: string | null
}

export interface Sync {
  readonly state: Readonly<SyncState>
  /**
   * Runs each group in turn, after any save under way, and in each group every step that is on. A
   * step that fails or lacks its permission leaves the others running, and a failed read of an
   * app's books skips the rest of its group only. A second call while one runs waits on it. Call it
   * from a click handler unless the page holds a token, since the books may need a sign-in.
   */
  sync(): Promise<void>
  /** Asks Google for what the steps that need access lack, then syncs. Call it first in a click handler. */
  allowAccess(): Promise<void>
  /**
   * Saves, asking Google in the same tap for the scopes the save switches on, then syncs. The ask
   * comes first where Google's popup needs the tap, and after the save where the trip to Google
   * leaves the page, which syncs once back. Without scopes it only saves. Call it first in a click handler.
   */
  saveAllowing(scopes: readonly GoogleScope[], save: () => Promise<boolean>): Promise<void>
}

/** A step as the books on screen plan it. */
function planned(step: SyncStep): PlannedStep {
  return { id: step.id, label: step.label, scopes: step.scopes(), on: step.on() }
}

export function createSync(ports: SyncPorts): Sync {
  const state = shallowReactive<{ run: SyncRun | null; askFailure: string | null }>({ run: null, askFailure: null })
  let running: Promise<void> | null = null

  function update(change: (run: SyncRun) => SyncRun): void {
    if (state.run !== null) state.run = change(state.run)
  }

  function stateOf(app: string, id: string): string | undefined {
    return state.run?.groups.find((group) => group.app === app)?.steps.find((step) => step.id === id)?.state.kind
  }

  async function runStep(app: string, step: SyncStep): Promise<void> {
    const missing = step.scopes().filter((scope) => !ports.granted(scope))
    if (missing.length > 0) {
      update((run) => withStep(run, app, step.id, needsAccess(missing)))
      return
    }
    update((run) => withStep(run, app, step.id, { kind: 'running', line: step.startLine }))
    try {
      const result = await step.run((line) => update((run) => withStep(run, app, step.id, { kind: 'running', line })))
      update((run) => withStep(run, app, step.id, result))
    } catch (failure) {
      if (isUnauthorized(failure)) {
        update((run) => accessLostFrom(run, app, step.id))
      } else {
        update((run) => withStep(run, app, step.id, { kind: 'failed', line: failure instanceof Error ? failure.message : String(failure), link: null }))
      }
    }
  }

  async function runGroup(group: SyncGroup, steps: readonly SyncStep[]): Promise<void> {
    await runStep(group.app, group.books)
    if (stateOf(group.app, group.books.id) !== 'done') {
      update((run) => skippedAfter(run, group.app, group.books.id))
      return
    }
    update((run) => replanned(run, group.app, steps.map(planned)))
    for (const step of steps) {
      if (stateOf(group.app, step.id) === 'queued') {
        await runStep(group.app, step)
      }
    }
  }

  async function syncOnce(): Promise<void> {
    const groups = ports.groups().map((group) => ({ group, steps: group.steps() }))
    for (const { group } of groups) {
      await group.whenIdle()
    }
    state.run = startedRun(
      groups.map(({ group, steps }) => ({ app: group.app, name: group.name, steps: [group.books, ...steps].map(planned) })),
      ports.now(),
    )
    // One group after another, so the page never asks Google for two tokens at once.
    for (const { group, steps } of groups) {
      await runGroup(group, steps)
    }
    update((run) => finishedRun(run, ports.now()))
  }

  function sync(): Promise<void> {
    running ??= syncOnce().finally(() => {
      running = null
    })
    return running
  }

  /** Asks Google and resolves to whether a token came, keeping why not for the control. */
  async function ask(scopes: readonly GoogleScope[]): Promise<boolean> {
    state.askFailure = null
    try {
      await ports.askForAccess(scopes)
      return true
    } catch (failure) {
      state.askFailure = failure instanceof Error ? failure.message : String(failure)
      return false
    }
  }

  return {
    state: shallowReadonly(state),
    sync,
    async allowAccess() {
      const scopes = [...new Set(stepsNeedingAccess(state.run).flatMap((step) => (step.state.kind === 'needs-access' ? step.state.scopes : [])))]
      if (await ask(scopes)) await sync()
    },
    async saveAllowing(scopes, save) {
      if (scopes.length === 0) {
        await save()
      } else if (ports.asksByLeaving()) {
        // The tab leaves for Google and syncs once back, so only an ask that stays on the page, such as the fake build's, syncs here.
        if ((await save()) && (await ask(scopes))) await sync()
      } else {
        const allowed = await ask(scopes)
        if ((await save()) && allowed) await sync()
      }
    },
  }
}
