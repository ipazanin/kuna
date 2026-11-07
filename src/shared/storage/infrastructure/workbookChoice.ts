import type { WorkbookChoice } from '../application/workbookPorts'

/** Each app remembers its own workbook on this device, under one key per app. */
const KEY_PREFIX = 'kuna.workbook-file.'

export function loadWorkbookChoice(app: string): WorkbookChoice | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(`${KEY_PREFIX}${app}`) ?? 'null')
    return choiceOf(stored)
  } catch {
    return null
  }
}

/** Null forgets the choice, so the next start goes to onboarding. */
export function saveWorkbookChoice(app: string, choice: WorkbookChoice | null): void {
  try {
    if (choice === null) {
      localStorage.removeItem(`${KEY_PREFIX}${app}`)
    } else {
      localStorage.setItem(`${KEY_PREFIX}${app}`, JSON.stringify(choice))
    }
  } catch {
    // Storage can be denied in a private window, and then the choice is not remembered.
  }
}

/** Tells the page when another tab forgot the app's choice, or cleared this site's storage. */
export function onChoiceForgottenElsewhere(app: string, forgotten: () => void): void {
  if (typeof window === 'undefined') return
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage) return
    if (event.key === null || (event.key === `${KEY_PREFIX}${app}` && event.newValue === null)) forgotten()
  })
}

/** Whether some app keeps its workbook on Drive on this device. */
export function someWorkbookOnDrive(): boolean {
  try {
    return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? '').some(
      (key) => key.startsWith(KEY_PREFIX) && loadWorkbookChoice(key.slice(KEY_PREFIX.length))?.source === 'drive',
    )
  } catch {
    return false
  }
}

function choiceOf(candidate: unknown): WorkbookChoice | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const { source, id, name } = candidate as Record<string, unknown>
  if ((source !== 'drive' && source !== 'browser') || typeof id !== 'string' || id === '' || typeof name !== 'string') {
    return null
  }
  return { source, id, name }
}
