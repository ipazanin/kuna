import type { RouteLocationRaw } from 'vue-router'

import type { AppContribution } from '../../shared/app/appContribution'

/** The apps whose assistant can do something here. An app in its first run has nothing to send, and one with no tasks has nothing to say. */
export function assistLines(apps: readonly AppContribution[]): readonly { readonly id: string; readonly name: string; readonly to: RouteLocationRaw }[] {
  return apps.flatMap((app) => (app.assist === undefined || app.firstRun() || app.assist.tasks().length === 0 ? [] : [{ id: app.id, name: app.name, to: app.assist.settings }]))
}
