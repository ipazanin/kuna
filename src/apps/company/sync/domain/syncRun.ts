import { listInWords } from '../../../../shared/text/listInWords'

/** A Google permission a sync step or a setting needs, by the scope name Google gives it. */
export type SyncScope = 'drive.file' | 'drive.readonly' | 'gmail.readonly' | 'gmail.compose'

/** A link a step line offers, such as Import for the statements a sync held. */
export interface StepLink {
  readonly label: string
  /** A route path with its query, such as `/company/transactions?tab=import`. */
  readonly to: string
}

/**
 * Where one step of a sync stands. `writeId` is the session write the step made, which Undo puts
 * back, or null. A step waits for you when it left something for a person, such as a statement it
 * held. It needs access when the page's token lacks one of its scopes, which `scopes` lists, and it
 * is skipped when the books could not be read.
 */
export type StepState =
  | { readonly kind: 'off' }
  | { readonly kind: 'queued' }
  | { readonly kind: 'running'; readonly line: string }
  | { readonly kind: 'done'; readonly line: string; readonly writeId: number | null; readonly link: StepLink | null }
  | { readonly kind: 'waits'; readonly line: string; readonly writeId: number | null; readonly link: StepLink | null }
  | { readonly kind: 'needs-access'; readonly scopes: readonly SyncScope[]; readonly line: string }
  | { readonly kind: 'failed'; readonly line: string; readonly link: StepLink | null }
  | { readonly kind: 'skipped'; readonly line: string }

/** What a step's own run ends in. Access and skipping are the run's to decide. */
export type StepResult = Extract<StepState, { readonly kind: 'done' | 'waits' | 'failed' }>

export interface RunStep {
  readonly id: string
  /** The step's name in the control and the step list, such as Statements. */
  readonly label: string
  readonly scopes: readonly SyncScope[]
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
export const BOOKS_STEP: Pick<RunStep, 'id' | 'label' | 'scopes'> = { id: 'books', label: 'Books', scopes: ['drive.file'] }

/** A step as a run starts it: on or off, as the settings say. */
export interface PlannedStep {
  readonly id: string
  readonly label: string
  readonly scopes: readonly SyncScope[]
  readonly on: boolean
}

/** A run with every step that is on queued, in the order given. */
export function startedRun(steps: readonly PlannedStep[], at: string): SyncRun {
  return { steps: steps.map(({ id, label, scopes, on }) => ({ id, label, scopes, state: on ? { kind: 'queued' } : { kind: 'off' } })), startedAt: at, finishedAt: null }
}

export function withStep(run: SyncRun, id: string, state: StepState): SyncRun {
  return { ...run, steps: run.steps.map((step) => (step.id === id ? { ...step, state } : step)) }
}

/** The queued and off steps on or off again with their scopes, as the books just read plan them. A step the plan leaves out stays as it was. */
export function replanned(run: SyncRun, plan: readonly PlannedStep[]): SyncRun {
  return {
    ...run,
    steps: run.steps.map((step) => {
      const planned = plan.find((candidate) => candidate.id === step.id)
      return planned === undefined || (step.state.kind !== 'queued' && step.state.kind !== 'off') ? step : { ...step, scopes: planned.scopes, state: planned.on ? { kind: 'queued' } : { kind: 'off' } }
    }),
  }
}

export function finishedRun(run: SyncRun, at: string): SyncRun {
  return { ...run, finishedAt: at }
}

/** What the person grants for each scope, as a line or a sentence names it. */
export const SCOPE_WORDS: Readonly<Record<SyncScope, string>> = {
  'drive.file': 'a Google sign-in',
  'drive.readonly': 'your Drive read access',
  'gmail.readonly': 'your Gmail read access',
  'gmail.compose': 'your Gmail drafts access',
}

/** A step that needs these scopes, whose line says "Waits for your Gmail read access", or for a sign-in when the books file is among them. */
export function needsAccess(scopes: readonly SyncScope[]): StepState {
  const line = scopes.includes('drive.file') ? 'Waits for you to sign in to Google' : `Waits for ${listInWords(scopes.map((scope) => SCOPE_WORDS[scope]))}`
  return { kind: 'needs-access', scopes, line }
}

/** After Google turned a step's token away mid-step: that step and every later queued step that shares a scope with it need access. */
export function accessLostFrom(run: SyncRun, id: string): SyncRun {
  const from = run.steps.findIndex((step) => step.id === id)
  const lost = run.steps[from]?.scopes ?? []
  return {
    ...run,
    steps: run.steps.map((step, index) =>
      index === from || (index > from && step.scopes.some((scope) => lost.includes(scope)) && step.state.kind === 'queued') ? { ...step, state: needsAccess(step.scopes) } : step,
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

/**
 * What the sync control shows: find the file while none is chosen, the step running with its place
 * among the steps that are on, Sign in to Google when Google asks for that first, Allow access while
 * a step or a setting lacks its permission, the problems of the last run, or else ready with the time
 * of the last read. `failure` says why the last tap's ask to Google gave no token, such as a closed
 * popup, or is null.
 */
export type SyncControl =
  | { readonly kind: 'find' }
  | { readonly kind: 'running'; readonly label: string; readonly position: number; readonly of: number; readonly line: string }
  | { readonly kind: 'sign-in'; readonly failure: string | null }
  | { readonly kind: 'allow-access'; readonly scopes: readonly SyncScope[]; readonly labels: readonly string[]; readonly failure: string | null }
  | { readonly kind: 'problems'; readonly count: number; readonly labels: readonly string[] }
  | { readonly kind: 'ready'; readonly syncedAt: string | null }

/** How the books stand in the workbook store, which reads them outside a run too, such as when the file is found. */
export interface BooksStanding {
  /** A file on Drive is chosen. */
  readonly chosen: boolean
  readonly reading: boolean
  readonly syncedAt: string | null
}

/** A permission the books' steps or this device's settings need, with the name of what needs it, such as Statements. */
export interface AccessNeed {
  readonly scope: SyncScope
  readonly label: string
}

/**
 * How the page's Google token stands against what the settings need: enough, or nothing asked yet,
 * so a sync asks in its tap. Google asked for a sign-in first, or the token lacks these needs, or
 * the page holds none since Google turned its ask down.
 */
export type PageAccess = { readonly kind: 'enough' } | { readonly kind: 'sign-in' } | { readonly kind: 'lacking'; readonly needs: readonly AccessNeed[] }

/** Google's error when the person is not signed in to Google in this browser. */
const LOGIN_REQUIRED = 'login_required'

/**
 * How the page stands: `granted` is the scopes of the page's token, or null while it holds none,
 * and `refusal` Google's error for the page's last ask or this device's silent trip.
 */
export function pageAccessOf(needs: readonly AccessNeed[], granted: readonly SyncScope[] | null, refusal: string | null): PageAccess {
  if (granted === null) {
    if (refusal === null) return { kind: 'enough' }
    return refusal === LOGIN_REQUIRED ? { kind: 'sign-in' } : { kind: 'lacking', needs }
  }
  const lacking = needs.filter((need) => !granted.includes(need.scope))
  return lacking.length === 0 ? { kind: 'enough' } : { kind: 'lacking', needs: lacking }
}

/** `failure` is why the last tap's ask to Google gave no token, or null. */
export function syncControlOf(run: SyncRun | null, books: BooksStanding, access: PageAccess, failure: string | null): SyncControl {
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
  if (access.kind === 'sign-in') {
    return { kind: 'sign-in', failure }
  }
  const lacking = [
    ...stepsNeedingAccess(run).flatMap((step) => (step.state.kind === 'needs-access' ? step.state.scopes : []).map((scope) => ({ scope, label: step.label }))),
    ...(access.kind === 'lacking' ? access.needs : []),
  ]
  if (lacking.length > 0) {
    return { kind: 'allow-access', scopes: [...new Set(lacking.map((need) => need.scope))], labels: [...new Set(lacking.map((need) => need.label))], failure }
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
  return withStep(base, BOOKS_STEP.id, { kind: 'failed', line, link: null })
}
