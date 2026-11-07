import type { WorkbookChoice } from '../storage/application/workbookPorts'
import type { WorkbookStatus } from '../storage/application/createWorkbookStore'

/** True while an app has no file: none chosen and none held, and not a file still opening. */
export function isFirstRun(state: { readonly status: WorkbookStatus; readonly choice: WorkbookChoice | null; readonly workbook: unknown }): boolean {
  return state.status !== 'opening' && state.choice === null && state.workbook === null
}
