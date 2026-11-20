import type { MailSource, SyncStep } from './sync'
import type { RunStep, SyncRun } from './syncRun'

/** Where one mail source stands: off by its app's switch, on with no line in this page's run yet, or its step as the run left it. */
export type MailSourceStanding = { readonly kind: 'off' } | { readonly kind: 'not-run' } | { readonly kind: 'ran'; readonly step: RunStep }

/** One step that reads Gmail, under its app. */
export interface MailSourceRow {
  readonly id: string
  /** The step's name, such as Statement mail. */
  readonly label: string
  readonly source: MailSource
  readonly standing: MailSourceStanding
}

/** An app's mail sources, which Kuna settings lists under the app's name. */
export interface AppMailSources {
  readonly app: string
  readonly name: string
  readonly sources: readonly MailSourceRow[]
}

/** An app's part of a sync as Kuna settings reads it: its id, its name and its steps after the books. */
export interface MailGroup {
  readonly app: string
  readonly name: string
  readonly steps: readonly SyncStep[]
}

function standingOf(app: string, step: SyncStep, run: SyncRun | null): MailSourceStanding {
  if (!step.on()) return { kind: 'off' }
  const ran = run?.groups.find((group) => group.app === app)?.steps.find((candidate) => candidate.id === step.id)
  return ran === undefined || ran.state.kind === 'off' ? { kind: 'not-run' } : { kind: 'ran', step: ran }
}

/** Every step that reads Gmail, grouped by app in the order given, off ones included. An app with none is left out. Nothing is stored, so a row shows this page's run. */
export function mailSourcesOf(groups: readonly MailGroup[], run: SyncRun | null): readonly AppMailSources[] {
  return groups.flatMap((group) => {
    const sources = group.steps.flatMap((step): MailSourceRow[] =>
      step.readsMail === undefined ? [] : [{ id: step.id, label: step.label, source: step.readsMail, standing: standingOf(group.app, step, run) }],
    )
    return sources.length === 0 ? [] : [{ app: group.app, name: group.name, sources }]
  })
}

/** The sources that read mail now, which stopping all mail turns off. */
export function sourcesOn(apps: readonly AppMailSources[]): readonly (MailSourceRow & { readonly app: string; readonly name: string })[] {
  return apps.flatMap((app) => app.sources.filter((row) => row.standing.kind !== 'off').map((row) => ({ ...row, app: app.app, name: app.name })))
}
