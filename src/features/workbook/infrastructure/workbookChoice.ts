import type { WorkbookChoice } from '../application/workbookPorts'

/** A choice of a Google Sheet, kept under the key before, is not read, so a device that showed the Sheet starts at the first-run choices. */
const WORKBOOK_CHOICE_KEY = 'ledgerboard.workbook-file'

export function loadWorkbookChoice(): WorkbookChoice | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WORKBOOK_CHOICE_KEY) ?? 'null')
    return choiceOf(stored)
  } catch {
    return null
  }
}

/** Null forgets the choice, so the next start goes to onboarding. */
export function saveWorkbookChoice(choice: WorkbookChoice | null): void {
  try {
    if (choice === null) {
      localStorage.removeItem(WORKBOOK_CHOICE_KEY)
    } else {
      localStorage.setItem(WORKBOOK_CHOICE_KEY, JSON.stringify(choice))
    }
  } catch {
    // Storage can be denied in a private window, and then the choice is not remembered.
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
