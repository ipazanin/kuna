import type { AppContribution } from '../../shared/app/appContribution'

const installed: AppContribution[] = []

/** Called by main.ts for each app, before the router is made. The home lists the apps in this order. */
export async function installApp(app: AppContribution): Promise<void> {
  await app.install()
  installed.push(app)
}

export function installedApps(): readonly AppContribution[] {
  return installed
}

/** Whether the address is one of the app's: its id, or a path under it. */
export function ownsPath(app: AppContribution, path: string): boolean {
  return path === `/${app.id}` || path.startsWith(`/${app.id}/`)
}

/** The app whose first run takes the page at this address: that of the app the address is under, or null when it has something to show or no app owns the address. */
export function firstRunAt(apps: readonly AppContribution[], path: string): AppContribution | null {
  return apps.find((app) => ownsPath(app, path) && app.firstRun()) ?? null
}

/** Where the app's card on the home and its row in the home's menu lead: its first run while it has nothing to show, else its first screen. */
export function entryPath(app: AppContribution): string {
  return app.firstRun() ? app.startPath : (app.screens[0]?.path ?? app.startPath)
}
