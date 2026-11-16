import { LOAN_TARGETS } from './loanTargets'
import type { ShownTarget } from './loanTargets'
import { targetsIn } from '../domain/linkTarget'
import type { AppTargets, TargetsOfApp } from '../domain/linkTarget'

/** Each app whose records a row can link to, with how Spending reads them. */
const TARGET_APPS: readonly { readonly app: string; targets(): AppTargets<ShownTarget> }[] = [LOAN_TARGETS]

/** Every app's records a row can link to, for a picker, each app with its own wait, failure or not set up. */
export function allTargets(): readonly TargetsOfApp<ShownTarget>[] {
  return TARGET_APPS.map(({ app, targets }) => ({ app, targets: targets() }))
}

/** The records of the app a link names, which its state is read against. */
export function targetsOf(app: string): AppTargets<ShownTarget> {
  return targetsIn(allTargets(), app)
}
