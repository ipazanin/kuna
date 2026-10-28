import type { GoogleScope } from '../../google/googleScopes'
import { listInWords } from '../../text/listInWords'

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
 * is skipped when its app's books could not be read.
 */
export type StepState =
  | { readonly kind: 'off' }
  | { readonly kind: 'queued' }
  | { readonly kind: 'running'; readonly line: string }
  | { readonly kind: 'done'; readonly line: string; readonly writeId: number | null; readonly link: StepLink | null }
  | { readonly kind: 'waits'; readonly line: string; readonly writeId: number | null; readonly link: StepLink | null }
  | { readonly kind: 'needs-access'; readonly scopes: readonly GoogleScope[]; readonly line: string }
  | { readonly kind: 'failed'; readonly line: string; readonly link: StepLink | null }
  | { readonly kind: 'skipped'; readonly line: string }

/** What a step's own run ends in. Access and skipping are the run's to decide. */
export type StepResult = Extract<StepState, { readonly kind: 'done' | 'waits' | 'failed' }>

export interface RunStep {
  readonly id: string
  /** The step's name in the control and the step list, such as Statements. */
  readonly label: string
  readonly scopes: readonly GoogleScope[]
  readonly state: StepState
}

/** One app's part of a run: its books step first, then the app's own steps. */
export interface RunGroup {
  /** The id of the app whose books and steps these are. */
  readonly app: string
  /** The app's name, which the step list shows over the group while a run holds more than one. */
  readonly name: string
  readonly steps: readonly RunStep[]
}

/** One sync of this page, held in memory and never stored: a group for each app with its file on Drive, run one after another. */
export interface SyncRun {
  readonly groups: readonly RunGroup[]
  /** ISO timestamps. `finishedAt` is null while the run is under way. */
  readonly startedAt: string
  readonly finishedAt: string | null
}

/** The books step, which every group of a sync runs first. */
export const BOOKS_STEP: Pick<RunStep, 'id' | 'label' | 'scopes'> = { id: 'books', label: 'Books', scopes: ['drive.file'] }

/** A step as a run starts it: on or off, as the settings say. */
export interface PlannedStep {
  readonly id: string
  readonly label: string
  readonly scopes: readonly GoogleScope[]
  readonly on: boolean
}

/** An app's group as a run starts it, its books step first. */
export interface PlannedGroup {
  readonly app: string
  readonly name: string
  readonly steps: readonly PlannedStep[]
}

/** Every step of the run, group after group. */
export function stepsOf(run: SyncRun | null): readonly RunStep[] {
  return run?.groups.flatMap((group) => group.steps) ?? []
}

/** A run with every step that is on queued, in the order given. */
export function startedRun(groups: readonly PlannedGroup[], at: string): SyncRun {
  return {
    groups: groups.map(({ app, name, steps }) => ({ app, name, steps: steps.map(({ id, label, scopes, on }) => ({ id, label, scopes, state: on ? { kind: 'queued' } : { kind: 'off' } })) })),
    startedAt: at,
    finishedAt: null,
  }
}

function withGroupSteps(run: SyncRun, app: string, change: (steps: readonly RunStep[]) => readonly RunStep[]): SyncRun {
  return { ...run, groups: run.groups.map((group) => (group.app === app ? { ...group, steps: change(group.steps) } : group)) }
}

export function withStep(run: SyncRun, app: string, id: string, state: StepState): SyncRun {
  return withGroupSteps(run, app, (steps) => steps.map((step) => (step.id === id ? { ...step, state } : step)))
}

/** The queued and off steps of the app's group on or off again with their scopes, as its books just read plan them. A step the plan leaves out stays as it was. */
export function replanned(run: SyncRun, app: string, plan: readonly PlannedStep[]): SyncRun {
  return withGroupSteps(run, app, (steps) =>
    steps.map((step) => {
      const planned = plan.find((candidate) => candidate.id === step.id)
      return planned === undefined || (step.state.kind !== 'queued' && step.state.kind !== 'off') ? step : { ...step, scopes: planned.scopes, state: planned.on ? { kind: 'queued' } : { kind: 'off' } }
    }),
  )
}

export function finishedRun(run: SyncRun, at: string): SyncRun {
  return { ...run, finishedAt: at }
}

/** What the person grants for each scope, as a line or a sentence names it. */
export const SCOPE_WORDS: Readonly<Record<GoogleScope, string>> = {
  'drive.file': 'a Google sign-in',
  'drive.readonly': 'your Drive read access',
  'gmail.readonly': 'your Gmail read access',
  'gmail.compose': 'your Gmail drafts access',
}

/** A step that needs these scopes, whose line says "Waits for your Gmail read access", or for a sign-in when the books file is among them. */
export function needsAccess(scopes: readonly GoogleScope[]): StepState {
  const line = scopes.includes('drive.file') ? 'Waits for you to sign in to Google' : `Waits for ${listInWords(scopes.map((scope) => SCOPE_WORDS[scope]))}`
  return { kind: 'needs-access', scopes, line }
}

/**
 * After Google turned a step's token away mid-step: that step and every later queued step that
 * shares a scope with it need access, in its own group and in the groups after it, since the page
 * holds one token.
 */
export function accessLostFrom(run: SyncRun, app: string, id: string): SyncRun {
  const lost = run.groups.find((group) => group.app === app)?.steps.find((step) => step.id === id)?.scopes ?? []
  let reached = false
  return {
    ...run,
    groups: run.groups.map((group) => ({
      ...group,
      steps: group.steps.map((step) => {
        if (group.app === app && step.id === id) {
          reached = true
          return { ...step, state: needsAccess(step.scopes) }
        }
        return reached && step.state.kind === 'queued' && step.scopes.some((scope) => lost.includes(scope)) ? { ...step, state: needsAccess(step.scopes) } : step
      }),
    })),
  }
}

/** After an app's books failed: every later step of its group that was to run is skipped. The other groups run as planned. */
export function skippedAfter(run: SyncRun, app: string, id: string): SyncRun {
  return withGroupSteps(run, app, (steps) => {
    const from = steps.findIndex((step) => step.id === id)
    return steps.map((step, index) => (index > from && step.state.kind === 'queued' ? { ...step, state: { kind: 'skipped', line: 'Skipped, since the books could not be read' } } : step))
  })
}

/** The steps whose permission is missing, as the run left them. */
export function stepsNeedingAccess(run: SyncRun | null): readonly RunStep[] {
  return stepsOf(run).filter((step) => step.state.kind === 'needs-access')
}

/** The steps that failed or wait for a person, which the control counts as problems. */
export function problemsOf(run: SyncRun | null): readonly RunStep[] {
  return stepsOf(run).filter((step) => step.state.kind === 'failed' || step.state.kind === 'waits')
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
  | { readonly kind: 'allow-access'; readonly scopes: readonly GoogleScope[]; readonly labels: readonly string[]; readonly failure: string | null }
  | { readonly kind: 'problems'; readonly count: number; readonly labels: readonly string[] }
  | { readonly kind: 'ready'; readonly syncedAt: string | null }

/** How the books on Drive stand in their stores, which read them outside a run too, such as when a file is found. */
export interface BooksStanding {
  /** Some app's file on Drive is chosen. */
  readonly chosen: boolean
  /** Some app's books are being read. */
  readonly reading: boolean
  /** The oldest read among the files on Drive, or null while one has none. */
  readonly syncedAt: string | null
}

/** The oldest of these reads, or null while one is missing. ISO timestamps sort as text. */
export function oldestRead(reads: readonly (string | null)[]): string | null {
  return reads.reduce<string | null>((oldest, read) => (oldest === null || read === null ? null : read < oldest ? read : oldest), reads[0] ?? null)
}

/** A permission the books' steps or this device's settings need, with the name of what needs it, such as Statements. */
export interface AccessNeed {
  readonly scope: GoogleScope
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
export function pageAccessOf(needs: readonly AccessNeed[], granted: readonly GoogleScope[] | null, refusal: string | null): PageAccess {
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
    const counted = stepsOf(run).filter((step) => step.state.kind !== 'off')
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

/** A run with an app's books failed, for a read of its file that failed outside a run, such as when it was found. A run without the app's group gains one. */
export function withBooksFailure(run: SyncRun | null, group: Pick<RunGroup, 'app' | 'name'>, line: string, at: string): SyncRun {
  const failed: StepState = { kind: 'failed', line, link: null }
  const base = run ?? { groups: [], startedAt: at, finishedAt: at }
  return base.groups.some((candidate) => candidate.app === group.app)
    ? withStep(base, group.app, BOOKS_STEP.id, failed)
    : { ...base, groups: [...base.groups, { app: group.app, name: group.name, steps: [{ ...BOOKS_STEP, state: failed }] }] }
}
