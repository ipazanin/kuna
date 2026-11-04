import type { WorkbookStatus } from '../storage/application/createWorkbookStore'

/** What an app's card on the home or its part of Kuna's Overview shows for its books: the figures once they are read, null where it has none to show, a wait while they open, or a failure. */
export function homeCardFigures<Workbook, Figures>(
  state: { readonly workbook: Workbook | null; readonly status: WorkbookStatus },
  figuresOf: (workbook: Workbook) => Figures | null,
): Figures | 'opening' | 'failed' | null {
  if (state.workbook !== null) {
    return figuresOf(state.workbook)
  }
  if (state.status === 'opening' || state.status === 'syncing') {
    return 'opening'
  }
  return state.status === 'error' ? 'failed' : null
}
