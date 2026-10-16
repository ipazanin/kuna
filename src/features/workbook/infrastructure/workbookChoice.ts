import type { WorkbookSource } from '../domain/workbook'

/** The workbook this browser shows: a picked Google Sheet, or one kept here in Excel mode. Never data. */
export interface WorkbookChoice {
  readonly source: WorkbookSource
  readonly id: string
  readonly name: string
}

const WORKBOOK_CHOICE_KEY = 'ledgerboard.workbook'

export function loadWorkbookChoice(): WorkbookChoice | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WORKBOOK_CHOICE_KEY) ?? 'null')
    return choiceOf(stored)
  } catch {
    return null
  }
}

/** Null forgets the choice, so the next start shows the welcome screen. */
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

/** A choice saved before Excel mode existed has no source, and was always a Google Sheet. */
function choiceOf(candidate: unknown): WorkbookChoice | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const { source = 'google', id, name } = candidate as Record<string, unknown>
  if ((source !== 'google' && source !== 'excel') || typeof id !== 'string' || id === '' || typeof name !== 'string') {
    return null
  }
  return { source, id, name }
}
