/** The spreadsheet this browser last picked. Only the id and name are kept, never data. */
export interface SelectedWorkbook {
  readonly id: string
  readonly name: string
}

const SELECTED_WORKBOOK_KEY = 'ledgerboard.workbook'

export function loadSelectedWorkbook(): SelectedWorkbook | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SELECTED_WORKBOOK_KEY) ?? 'null')
    return isSelectedWorkbook(stored) ? stored : null
  } catch {
    return null
  }
}

export function saveSelectedWorkbook(workbook: SelectedWorkbook): void {
  try {
    localStorage.setItem(SELECTED_WORKBOOK_KEY, JSON.stringify(workbook))
  } catch {
    // Storage can be denied in a private window, and then the choice is not remembered.
  }
}

function isSelectedWorkbook(candidate: unknown): candidate is SelectedWorkbook {
  if (typeof candidate !== 'object' || candidate === null) {
    return false
  }
  const { id, name } = candidate as Record<string, unknown>
  return typeof id === 'string' && id !== '' && typeof name === 'string'
}
