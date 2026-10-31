const APP_NAME = 'Kuna'

let screenTitle: string | null = null
let tabLabel: string | null = null
let appName: string | null = null

function show(): void {
  const page = [screenTitle, tabLabel, appName].filter((part) => part !== null).join(', ')
  document.title = page === '' ? APP_NAME : `${page} – ${APP_NAME}`
}

/** The browser tab names the screen and its app, such as "Overview, Company – Kuna". Null for a path no screen has, and an app of null for Kuna's own screens. */
export function nameScreen(title: string | null, app: string | null): void {
  screenTitle = title
  appName = title === null ? null : app
  show()
}

/** A screen with inner tabs adds the open one, such as "Settings, Tax rules, Company – Kuna". Null once the tabs are gone. */
export function nameTab(label: string | null): void {
  tabLabel = label
  show()
}
