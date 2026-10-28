import { shallowReactive, shallowReadonly } from 'vue'

import { isUnauthorized } from '../../../../shared/google/googleApi'
import type { Workbook } from '../../workbook/domain/workbook'
import { accessLostFrom, finishedRun, needsAccess, replanned, skippedAfter, startedRun, stepsNeedingAccess, withStep } from '../domain/syncRun'
import type { PlannedStep, StepResult, SyncRun, SyncScope } from '../domain/syncRun'

/** One step of a sync, which a feature or the pack contributes. */
export interface SyncStep {
  readonly id: string
  /** Its name in the control and the step list, such as Statements. */
  readonly label: string
  /** Every scope its run needs for these books, or for books not read yet. A folder setting decides whether it reads Drive with the books file's scope or with Drive read. */
  scopes(workbook: Workbook | null): readonly SyncScope[]
  /** The line it shows as it starts. */
  readonly startLine: string
  /** Whether the settings of these books turn it on. */
  on(workbook: Workbook): boolean
  /** Runs the step and says what it did. `report` changes the line it shows while it runs. */
  run(report: (line: string) => void): Promise<StepResult>
}

export interface SyncPorts {
  /** Reads the books, the first step. A failure skips the rest. */
  readonly books: SyncStep
  /** The steps after the books, in order. */
  steps(): readonly SyncStep[]
  /** The books on screen, or null before the first copy. */
  workbook(): Workbook | null
  /** Whether the page holds a token for the scope. */
  granted(scope: SyncScope): boolean
  /** Asks Google for the scopes, with its consent screen when it needs one. Call it first in a click handler. */
  askForAccess(scopes: readonly SyncScope[]): Promise<void>
  /** Whether asking Google sends the tab away to Google and back, as on a phone, instead of opening a popup over the page. */
  asksByLeaving(): boolean
  /** Resolves once no save or other read of the books is under way. */
  whenIdle(): Promise<void>
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
   * Runs every step that is on, in order, after any save under way. A step that fails or lacks its
   * permission leaves the others running, and a failed read of the books skips the rest. A second
   * call while one runs waits on it. Call it from a click handler unless the page holds a token, since the
   * books may need a sign-in.
   */
  sync(): Promise<void>
  /** Asks Google for what the steps that need access lack, then syncs. Call it first in a click handler. */
  allowAccess(): Promise<void>
  /**
   * Saves, asking Google in the same tap for the scopes the save switches on, then syncs. The ask
   * comes first where Google's popup needs the tap, and after the save where the trip to Google
   * leaves the page, which syncs once back. Without scopes it only saves. Call it first in a click handler.
   */
  saveAllowing(scopes: readonly SyncScope[], save: () => Promise<boolean>): Promise<void>
}

export function createSync(ports: SyncPorts): Sync {
  const state = shallowReactive<{ run: SyncRun | null; askFailure: string | null }>({ run: null, askFailure: null })
  let running: Promise<void> | null = null

  function update(change: (run: SyncRun) => SyncRun): void {
    if (state.run !== null) state.run = change(state.run)
  }

  async function runStep(step: SyncStep): Promise<void> {
    const missing = step.scopes(ports.workbook()).filter((scope) => !ports.granted(scope))
    if (missing.length > 0) {
      update((run) => withStep(run, step.id, needsAccess(missing)))
      return
    }
    update((run) => withStep(run, step.id, { kind: 'running', line: step.startLine }))
    try {
      const result = await step.run((line) => update((run) => withStep(run, step.id, { kind: 'running', line })))
      update((run) => withStep(run, step.id, result))
    } catch (failure) {
      if (isUnauthorized(failure)) {
        update((run) => accessLostFrom(run, step.id))
      } else {
        update((run) => withStep(run, step.id, { kind: 'failed', line: failure instanceof Error ? failure.message : String(failure), link: null }))
      }
    }
  }

  /** A step as these books plan it. Before the first copy every step counts as on. */
  function planned(step: SyncStep, workbook: Workbook | null): PlannedStep {
    return { id: step.id, label: step.label, scopes: step.scopes(workbook), on: workbook === null || step.on(workbook) }
  }

  async function syncOnce(): Promise<void> {
    await ports.whenIdle()
    const { books } = ports
    const steps = ports.steps()
    const before = ports.workbook()
    state.run = startedRun([{ ...planned(books, before), on: true }, ...steps.map((step) => planned(step, before))], ports.now())
    await runStep(books)
    if (state.run.steps[0]?.state.kind !== 'done') {
      update((run) => skippedAfter(run, books.id))
    } else {
      const read = ports.workbook()
      update((run) => replanned(run, steps.map((step) => planned(step, read))))
      for (const step of steps) {
        if (state.run.steps.find((candidate) => candidate.id === step.id)?.state.kind === 'queued') {
          await runStep(step)
        }
      }
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
  async function ask(scopes: readonly SyncScope[]): Promise<boolean> {
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
