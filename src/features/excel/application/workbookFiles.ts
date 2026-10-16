import { downloadFile } from '../../../shared/files/downloadFile'
import { fold } from '../../../shared/text/fold'
import type { WorkbookStore } from '../../workbook/application/workbookStore'
import type { Workbook } from '../../workbook/domain/workbook'
import { XLSX_MIME_TYPE, readWorkbookFile, writeWorkbookFile } from '../../workbook/infrastructure/workbookFile'
import { readWorkbook } from '../../workbook/infrastructure/workbookReader'
import type { WorkbookTabs } from '../../workbook/infrastructure/workbookSnapshot'
import { emptyWorkbookTabs } from '../../workbook/infrastructure/workbookTemplate'
import { importSummary } from '../domain/importSummary'
import type { ImportSummary } from '../domain/importSummary'

export const TEMPLATE_FILE_NAME = 'ledgerboard-template.xlsx'

/** A file read and checked, ready to replace the workbook in this browser once the user agrees. */
export interface ImportPreview {
  readonly fileName: string
  readonly title: string
  readonly tabs: WorkbookTabs
  readonly summary: ImportSummary
}

/** The workbook a file holds, read by the same reader as a Google Sheet. Nothing is stored yet. */
export async function previewImport(file: File): Promise<ImportPreview> {
  let contents
  try {
    contents = await readWorkbookFile(await file.arrayBuffer())
  } catch {
    throw new Error(`${file.name} could not be read as an Excel workbook. Save it as .xlsx and try again.`)
  }
  const workbook = workbookOf(contents.tabs, file.name)
  return {
    fileName: file.name,
    title: workbook.settings.companyName || withoutExtension(file.name),
    tabs: contents.tabs,
    summary: importSummary(workbook, contents.missingTabs),
  }
}

/** The blank template: every tab with its headers and notes, the default categories and settings. */
export async function downloadTemplate(): Promise<void> {
  const tabs = emptyWorkbookTabs()
  downloadFile(await writeWorkbookFile(tabs, workbookOf(tabs, 'template')), TEMPLATE_FILE_NAME, XLSX_MIME_TYPE)
}

/** The tabs of a new, empty workbook kept in this browser. */
export function emptyLocalWorkbook(): { readonly tabs: WorkbookTabs; readonly title: string } {
  return { tabs: emptyWorkbookTabs(), title: 'New workbook' }
}

/** Writes the workbook on screen in the template format, hands it to the browser, and notes the export. */
export async function exportWorkbook(store: WorkbookStore): Promise<string> {
  const { snapshot, workbook } = store.state
  if (snapshot === null || workbook === null) {
    throw new Error('There is no workbook to export yet.')
  }
  const fileName = exportFileName(workbook, new Date())
  downloadFile(await writeWorkbookFile(snapshot, workbook), fileName, XLSX_MIME_TYPE)
  await store.recordExport()
  return fileName
}

/** `ledgerboard-<company or sheet name>-<yyyy-mm-dd>.xlsx`, in plain ASCII. */
export function exportFileName(workbook: Pick<Workbook, 'title' | 'settings'>, day: Date): string {
  const name = fold(workbook.settings.companyName || workbook.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  return `ledgerboard-${name || 'workbook'}-${date}.xlsx`
}

function workbookOf(tabs: WorkbookTabs, title: string): Workbook {
  return readWorkbook({
    meta: { id: 'preview', source: 'excel', title, syncedAt: new Date().toISOString(), ledgerSheetId: null, lastExportedAt: null, unexportedSince: null },
    ...tabs,
  })
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}
