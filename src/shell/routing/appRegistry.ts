import type { AppContribution } from '../../shared/app/appContribution'
import type { AppLinkedRows } from '../../shared/app/rowLinks'

const installed: AppContribution[] = []

/** The order every list of apps shows them in: the sidebar, the rail, the drawer, the home, Net worth, Quick jump and the chat. */
export const APP_ORDER: readonly string[] = ['spending', 'company', 'investments', 'loans', 'assets']

/** The apps in Kuna's order, whatever order they were installed in. An app the order does not name comes last. */
export function inAppOrder<App extends { readonly id: string }>(apps: readonly App[]): App[] {
  const placeOf = (app: App): number => {
    const place = APP_ORDER.indexOf(app.id)
    return place === -1 ? APP_ORDER.length : place
  }
  return [...apps].sort((left, right) => placeOf(left) - placeOf(right))
}

/** Called by main.ts for each app, before the router is made. */
export async function installApp(app: AppContribution): Promise<void> {
  await app.install({ linkedRows })
  installed.splice(0, installed.length, ...inAppOrder([...installed, app]))
}

export function installedApps(): readonly AppContribution[] {
  return installed
}

/** The rows each installed app has linked to records in other apps, by app, which each app reads through the `ShellReads` it installed with. */
function linkedRows(): readonly AppLinkedRows[] {
  return installed.flatMap((app) => (app.rowLinks === undefined ? [] : [{ app: app.id, links: app.rowLinks() }]))
}

/** Whether the address is one of the app's: its id, or a path under it. */
export function ownsPath(app: AppContribution, path: string): boolean {
  return path === `/${app.id}` || path.startsWith(`/${app.id}/`)
}

/** The app that owns the address, or null on the home and Kuna's own screens. */
export function appAt(apps: readonly AppContribution[], path: string): AppContribution | null {
  return apps.find((app) => ownsPath(app, path)) ?? null
}

/** The app whose first run takes the page at this address: that of the app the address is under, or null when it has something to show or no app owns the address. */
export function firstRunAt(apps: readonly AppContribution[], path: string): AppContribution | null {
  return apps.find((app) => ownsPath(app, path) && app.firstRun()) ?? null
}

/** Where the app's card on the home and its row in the menu lead: its first run while it has nothing to show, else its first screen. */
export function entryPath(app: AppContribution): string {
  return app.firstRun() ? app.startPath : (app.screens[0]?.path ?? app.startPath)
}

/** What waits across the app's menu, for its row in the menu while its pages are closed. */
export function waitingIn(app: AppContribution): number {
  return app.menu().reduce((total, screen) => total + (app.menuCount?.(screen)?.count ?? 0), 0)
}
