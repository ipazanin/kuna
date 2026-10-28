import type { AppContribution, AppScreen } from '../../shared/app/appContribution'

const installed: AppContribution[] = []

/** Called by main.ts for each app, before the router is made. The first app installed is the home app. */
export async function installApp(app: AppContribution): Promise<void> {
  await app.install()
  installed.push(app)
}

export function installedApps(): readonly AppContribution[] {
  return installed
}

/** The app `#/` opens, whose first run takes every address on a fresh device. */
export function homeApp(): AppContribution {
  const home = installed[0]
  if (home === undefined) {
    throw new Error('No app is installed. main.ts installs each app before it mounts the shell.')
  }
  return home
}

/** Whether the address is one of the app's: its id, or a path under it. */
export function ownsPath(app: AppContribution, path: string): boolean {
  return path === `/${app.id}` || path.startsWith(`/${app.id}/`)
}

/** What the browser tab and the phone top bar call an app's screen: its title, with the app's name for an app other than the home app, such as "Overview, Loans". */
export function screenName(app: AppContribution, screen: AppScreen): string {
  return app === homeApp() ? screen.title : `${screen.title}, ${app.name}`
}

/**
 * The app whose first run takes the page at this address: the home app's on a fresh device,
 * whatever the address, or else that of the app the address is under. Null when neither is in its
 * first run. `apps` are the installed apps, the home app first.
 */
export function firstRunAt(apps: readonly AppContribution[], path: string): AppContribution | null {
  const [home] = apps
  if (home?.firstRun()) {
    return home
  }
  return apps.find((app) => ownsPath(app, path) && app.firstRun()) ?? null
}
