const APP_NAME = 'Kuna'

let screenTitle: string | null = null
let tabLabel: string | null = null

function show(): void {
  const page = [screenTitle, tabLabel].filter((part) => part !== null).join(', ')
  document.title = page === '' ? APP_NAME : `${page} – ${APP_NAME}`
}

/** The browser tab names the screen, such as "Settings – Kuna". Null for a path no screen has. */
export function nameScreen(title: string | null): void {
  screenTitle = title
  show()
}

/** A screen with inner tabs adds the open one, such as "Settings, Ruleset – Kuna". Null once the tabs are gone. */
export function nameTab(label: string | null): void {
  tabLabel = label
  show()
}
