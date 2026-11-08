import type { RouteLocationRaw } from 'vue-router'

import type { AppContribution } from '../../shared/app/appContribution'

/** The apps that name an assistant, by their switches. An app in its first run has nothing to send yet. */
export function assistLines(apps: readonly AppContribution[]): readonly { readonly id: string; readonly name: string; readonly to: RouteLocationRaw }[] {
  return apps.flatMap((app) => (app.assist === undefined || app.firstRun() ? [] : [{ id: app.id, name: app.name, to: app.assist.settings }]))
}
