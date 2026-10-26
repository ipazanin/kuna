/** A Google permission a sync step needs, by the scope name Google gives it. */
export type SyncScope = 'drive.file' | 'drive.readonly'

/** A link a step line offers, such as Import for the statements a sync held. */
export interface StepLink {
  readonly label: string
  /** A route path with its query, such as `/transactions?tab=import`. */
  readonly to: string
}

/**
 * Where one step of a sync stands. `writeId` is the session write the step made, which Undo puts
 * back, or null. A step waits for you when it left something for a person, such as a statement it
 * held. It needs access when the page holds no token for its scope, and it is skipped when the
 * books could not be read.
 */
export type StepState =
  | { readonly kind: 'off' }
  | { readonly kind: 'queued' }
  | { readonly kind: 'running'; readonly line: string }
  | { readonly kind: 'done'; readonly line: string; readonly writeId: number | null; readonly link: StepLink | null }
  | { readonly kind: 'waits'; readonly line: string; readonly writeId: number | null; readonly link: StepLink | null }
  | { readonly kind: 'needs-access'; readonly scope: SyncScope; readonly line: string }
  | { readonly kind: 'failed'; readonly line: string }
  | { readonly kind: 'skipped'; readonly line: string }

/** What a step's own run ends in. Access and skipping are the run's to decide. */
export type StepResult = Extract<StepState, { readonly kind: 'done' | 'waits' | 'failed' }>

export interface RunStep {
  readonly id: string
  /** The step's name in the control and the step list, such as Statements. */
  readonly label: string
  readonly scope: SyncScope
  readonly state: StepState
}

/** One sync of this page, held in memory and never stored. The books step comes first. */
export interface SyncRun {
  readonly steps: readonly RunStep[]
  /** ISO timestamps. `finishedAt` is null while the run is under way. */
  readonly startedAt: string
  readonly finishedAt: string | null
}

/** The books step, which every sync of a file on Drive runs first. */
export const BOOKS_STEP: Pick<RunStep, 'id' | 'label' | 'scope'> = { id: 'books', label: 'Books', scope: 'drive.file' }

/** A step as a run starts it: on or off, as the settings say. */
export interface PlannedStep {
  readonly id: string
  readonly label: string
  readonly scope: SyncScope
  readonly on: boolean
}

/** A run with every step that is on queued, in the order given. */
export function startedRun(steps: readonly PlannedStep[], at: string): SyncRun {
  return { steps: steps.map(({ id, label, scope, on }) => ({ id, label, scope, state: on ? { kind: 'queued' } : { kind: 'off' } })), startedAt: at, finishedAt: null }
}

export function withStep(run: SyncRun, id: string, state: StepState): SyncRun {
  return { ...run, steps: run.steps.map((step) => (step.id === id ? { ...step, state } : step)) }
}

/** The queued steps on or off again, as the books just read say. */
export function replanned(run: SyncRun, on: (id: string) => boolean): SyncRun {
  return {
    ...run,
    steps: run.steps.map((step) => (step.state.kind === 'queued' || step.state.kind === 'off' ? { ...step, state: on(step.id) ? { kind: 'queued' } : { kind: 'off' } } : step)),
  }
}

export function finishedRun(run: SyncRun, at: string): SyncRun {
  return { ...run, finishedAt: at }
}

const ACCESS_LINES: Readonly<Record<SyncScope, string>> = {
  'drive.file': 'Waits for you to sign in to Google',
  'drive.readonly': 'Waits for your Drive read access',
}

/** A step that needs its scope, said the usual way or with why Google gave no token. */
export function needsAccess(scope: SyncScope, line: string = ACCESS_LINES[scope]): StepState {
  return { kind: 'needs-access', scope, line }
}

/** After Google turned a step's token away mid-step: that step and every later queued step of the same scope need access. */
export function accessLostFrom(run: SyncRun, id: string): SyncRun {
  const from = run.steps.findIndex((step) => step.id === id)
  const scope = run.steps[from]?.scope
  return {
    ...run,
    steps: run.steps.map((step, index) =>
      index === from || (index > from && step.scope === scope && step.state.kind === 'queued') ? { ...step, state: needsAccess(step.scope) } : step,
    ),
  }
}

/** After the books failed: every later step that was to run is skipped. */
export function skippedAfter(run: SyncRun, id: string): SyncRun {
  const from = run.steps.findIndex((step) => step.id === id)
  return {
    ...run,
    steps: run.steps.map((step, index) => (index > from && step.state.kind === 'queued' ? { ...step, state: { kind: 'skipped', line: 'Skipped, since the books could not be read' } } : step)),
  }
}

/** The steps whose permission is missing, as the run left them. */
export function stepsNeedingAccess(run: SyncRun | null): readonly RunStep[] {
  return run?.steps.filter((step) => step.state.kind === 'needs-access') ?? []
}

/** The steps that failed or wait for a person, which the control counts as problems. */
export function problemsOf(run: SyncRun | null): readonly RunStep[] {
  return run?.steps.filter((step) => step.state.kind === 'failed' || step.state.kind === 'waits') ?? []
}

/** Every step that needs access gets this line, such as why Google gave no token. */
export function withAccessLine(run: SyncRun, line: string): SyncRun {
  return { ...run, steps: run.steps.map((step) => (step.state.kind === 'needs-access' ? { ...step, state: needsAccess(step.state.scope, line) } : step)) }
}

/**
 * What the sync control shows: find the file while none is chosen, the step running with its place
 * among the steps that are on, Allow access while a step lacks its permission, the problems of the
 * last run, or else ready with the time of the last read.
 */
export type SyncControl =
  | { readonly kind: 'find' }
  | { readonly kind: 'running'; readonly label: string; readonly position: number; readonly of: number; readonly line: string }
  | { readonly kind: 'allow-access'; readonly scopes: readonly SyncScope[]; readonly labels: readonly string[] }
  | { readonly kind: 'problems'; readonly count: number; readonly labels: readonly string[] }
  | { readonly kind: 'ready'; readonly syncedAt: string | null }

/** How the books stand in the workbook store, which reads them outside a run too, such as when the file is found. */
export interface BooksStanding {
  /** A file on Drive is chosen. */
  readonly chosen: boolean
  readonly reading: boolean
  readonly syncedAt: string | null
}

export function syncControlOf(run: SyncRun | null, books: BooksStanding): SyncControl {
  if (!books.chosen) {
    return { kind: 'find' }
  }
  if (run !== null && run.finishedAt === null) {
    const counted = run.steps.filter((step) => step.state.kind !== 'off')
    const at = Math.max(
      0,
      counted.findIndex((step) => step.state.kind === 'running' || step.state.kind === 'queued'),
    )
    const step = counted[at]
    if (step !== undefined) {
      return { kind: 'running', label: step.label, position: at + 1, of: counted.length, line: step.state.kind === 'running' ? step.state.line : 'Waiting to start' }
    }
  }
  if (books.reading) {
    return { kind: 'running', label: BOOKS_STEP.label, position: 1, of: 1, line: 'Reading the file' }
  }
  const lacking = stepsNeedingAccess(run)
  if (lacking.length > 0) {
    return { kind: 'allow-access', scopes: [...new Set(lacking.map((step) => step.scope))], labels: lacking.map((step) => step.label) }
  }
  const problems = problemsOf(run)
  if (problems.length > 0) {
    return { kind: 'problems', count: problems.length, labels: problems.map((step) => step.label) }
  }
  return { kind: 'ready', syncedAt: books.syncedAt }
}

/** A run with the books failed, for a read of the file that failed outside a run, such as when it was found. */
export function withBooksFailure(run: SyncRun | null, line: string, at: string): SyncRun {
  const base = run ?? { steps: [{ ...BOOKS_STEP, state: { kind: 'queued' } }], startedAt: at, finishedAt: at }
  return withStep(base, BOOKS_STEP.id, { kind: 'failed', line })
}
