import type { RouteLocationRaw } from 'vue-router'

import { companyTargets } from './companyTargets'
import { loanApps } from './loanRecords'
import { targetsIn } from '../domain/linkTarget'
import type { AppTargets, LinkTarget, TargetSource, TargetsOfApp } from '../domain/linkTarget'

/** A record in another app as Spending shows it on a row, with its page in that app. */
export type ShownTarget = LinkTarget & { readonly to: RouteLocationRaw }

/** An app's records a row can link to, with which kind of app it is, which the words for a link it cannot show depend on. */
export interface ShownApp extends TargetsOfApp<ShownTarget> {
  readonly source: TargetSource
}

/** Every app's records a row can link to, for a picker, each app with its own wait, failure or not set up. */
export function allTargets(): readonly ShownApp[] {
  return [...loanApps().map((app): ShownApp => ({ ...app, source: 'loans' })), ...companyTargets().map((app): ShownApp => ({ ...app, source: 'company' }))]
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
