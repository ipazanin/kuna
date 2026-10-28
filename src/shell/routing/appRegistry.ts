import type { AppContribution } from '../../shared/app/appContribution'

const installed: AppContribution[] = []

/** Called by main.ts for each app, before the router is made. The first app installed is the home app. */
export async function installApp(app: AppContribution): Promise<void> {
  await app.install()
  installed.push(app)
}

export function installedApps(): readonly AppContribution[] {
  return installed
}

/** The app `#/` opens, whose first run, top-bar subtitle and sync control the shell shows. */
export function homeApp(): AppContribution {
  const home = installed[0]
  if (home === undefined) {
    throw new Error('No app is installed. main.ts installs each app before it mounts the shell.')
  }
  return home
}
