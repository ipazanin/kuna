import { companyTargets } from './companyTargets'
import { LOAN_TARGETS } from './loanTargets'
import type { ShownTarget } from './loanTargets'
import { targetsIn } from '../domain/linkTarget'
import type { AppTargets, TargetSource, TargetsOfApp } from '../domain/linkTarget'

/** An app's records a row can link to, with which kind of app it is, which the words for a link it cannot show depend on. */
export interface ShownApp extends TargetsOfApp<ShownTarget> {
  readonly source: TargetSource
}

/** Every app's records a row can link to, for a picker, each app with its own wait, failure or not set up. */
export function allTargets(): readonly ShownApp[] {
  return [{ ...LOAN_TARGETS, targets: LOAN_TARGETS.targets(), source: 'loans' }, ...companyTargets().map((app): ShownApp => ({ ...app, source: 'company' }))]
}

/** The records of the app a link names, which its state is read against. */
export function targetsOf(app: string): AppTargets<ShownTarget> {
  return targetsIn(allTargets(), app)
}

/** Which kind of app the app a link names is among the apps on the page. A link to an app none of them is names Loans, the first app rows linked to. */
export function sourceIn(apps: readonly ShownApp[], app: string): TargetSource {
  return apps.find((entry) => entry.app === app)?.source ?? 'loans'
}

/** Which kind of app the app a link names is. */
export function sourceOf(app: string): TargetSource {
  return sourceIn(allTargets(), app)
}
