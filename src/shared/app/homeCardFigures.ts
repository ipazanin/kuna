import type { WorkbookStatus } from '../storage/application/createWorkbookStore'
import type { HomeFigures } from './appContribution'

/** What an app's card on the home shows for its books: the figures once they are read, null where it has none to show, a wait while they open, or a failure. */
export function homeCardFigures<Workbook>(
  state: { readonly workbook: Workbook | null; readonly status: WorkbookStatus },
  figuresOf: (workbook: Workbook) => HomeFigures | null,
): HomeFigures | 'opening' | 'failed' | null {
  if (state.workbook !== null) {
    return figuresOf(state.workbook)
  }
  if (state.status === 'opening' || state.status === 'syncing') {
    return 'opening'
  }
  return state.status === 'error' ? 'failed' : null
}
