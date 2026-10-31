import { downloadFile } from '../../../../shared/files/downloadFile'
import { fold } from '../../../../shared/text/fold'
import { JSON_MIME_TYPE } from '../../../../shared/google/driveClient'
import { XLSX_MIME_TYPE } from '../../../../shared/xlsx/sheetGrids'
import { importSummary } from '../../workbook-files/domain/importSummary'
import { DEFAULT_SETTINGS } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import type { ImportSummary } from '../../workbook-files/domain/importSummary'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../domain/readWorkbook'
import type { Category, Workbook } from '../domain/workbook'
import { NEWER_FILE, decodeDocument, savedByNewerApp } from '../../../../shared/storage/infrastructure/documentFormat'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { COMPANY_APP, installedSchema, readDocument } from '../infrastructure/companyDocument'
import { DEFAULT_CATEGORY_NAMES, emptyWorkbookTabs } from '../infrastructure/emptyWorkbook'
import { documentOfTabs, recordCountsOf, tabsOfDocument } from '../infrastructure/spreadsheetDocument'
import { readWorkbookFile, writeWorkbookFile } from '../infrastructure/workbookFile'
import { words } from './words'

/** What a file input takes for a workbook: an xlsx file, or a Kuna file such as a backup. */
export const WORKBOOK_FILE_TYPES = `.xlsx,${XLSX_MIME_TYPE},.json,${JSON_MIME_TYPE}`

/** A file read and checked, ready to be kept on Drive or in this browser once the user agrees. */
export interface ImportPreview {
  readonly fileName: string
  readonly title: string
  /** The file's records as the app's document, every ledger row with an id. */
  readonly document: WorkbookDocument
  readonly summary: ImportSummary
  /** How many records the file holds of each kind, by the tab an xlsx file keeps them on. */
  readonly counts: readonly { readonly name: string; readonly count: number }[]
  readonly recordCount: number
}

/**
 * The workbook a file holds, as the document the app would keep. Nothing is stored yet. A file
 * that cannot be read throws a message for the user, with the underlying error as its cause.
 */
export async function previewImport(file: File): Promise<ImportPreview> {
  const { document, missingTabs } = file.name.toLowerCase().endsWith('.json') ? await documentOfFile(file) : await documentOfWorkbookFile(file)
  const workbook = readDocument(previewIdentity(file.name), document).workbook
  const counts = recordCountsOf(document)
  const summary = importSummary(workbook, missingTabs)
  return {
    fileName: file.name,
    title: workbook.settings.companyName || withoutExtension(file.name),
    document,
    summary: savedByNewerApp(document, installedSchema()) ? { ...summary, refusal: NEWER_FILE } : summary,
    counts,
    recordCount: counts.reduce((sum, kind) => sum + kind.count, 0),
  }
}

async function documentOfWorkbookFile(file: File): Promise<{ readonly document: WorkbookDocument; readonly missingTabs: ImportSummary['defaultedTabs'] }> {
  let contents
  try {
    contents = await readWorkbookFile(await file.arrayBuffer())
  } catch (readFailure) {
    console.error(`Reading ${file.name} failed`, readFailure)
    throw new Error(words.reading.notExcel(file.name), { cause: readFailure })
  }
  return { document: documentOfTabs(COMPANY_APP, contents.tabs, new Date().toISOString()), missingTabs: contents.missingTabs }
}

/** A Kuna file, such as a backup from the Drive folder, holds every kind, so no tab is missing. */
async function documentOfFile(file: File): Promise<{ readonly document: WorkbookDocument; readonly missingTabs: ImportSummary['defaultedTabs'] }> {
  let document
  try {
    document = decodeDocument(await file.text())
  } catch (readFailure) {
    console.error(`Reading ${file.name} failed`, readFailure)
    throw new Error(words.reading.notKuna(file.name), { cause: readFailure })
  }
  if (document.app !== COMPANY_APP) {
    throw new Error(words.reading.otherApp(file.name, document.app))
  }
  return { document, missingTabs: [] }
}

/** What new books kept in this browser are called until the company step names the company. */
export const NEW_BOOKS_TITLE = 'New books'

/**
 * The document of new books: the default categories, no accounts or rows, and a row for every
 * setting, so the books name each choice instead of leaving it to a default a later app may change.
 * `choices` are the settings onboarding chose, such as how statements arrive, and the rest are the
 * defaults: the owner-pay module off and the pack's folders blank until the person says otherwise.
 */
export function newBooksDocument(choices: Partial<Settings>, savedAt: string): WorkbookDocument {
  return documentOfTabs(COMPANY_APP, emptyWorkbookTabs({ ...DEFAULT_SETTINGS, ...choices }), savedAt)
}

/** Whether the categories are the ones new books start with, none added, removed or renamed. */
export function categoriesAsNewBooksStart(categories: readonly Pick<Category, 'slug'>[]): boolean {
  const names = new Set(categories.map((category) => category.slug))
  return names.size === DEFAULT_CATEGORY_NAMES.length && DEFAULT_CATEGORY_NAMES.every((name) => names.has(name))
}

/** Writes the workbook on screen in the template format, hands it to the browser, and notes the export. */
export async function exportWorkbook(store: WorkbookStore<CompanyBooks, DocumentCopy, WorkbookDocument>): Promise<string> {
  const { snapshot, workbook } = store.state
  if (snapshot === null || workbook === null) {
    throw new Error(words.reading.nothingToExport)
  }
  const fileName = exportFileName(workbook, new Date())
  downloadFile(await writeWorkbookFile(tabsOfDocument(snapshot.document), workbook), fileName, XLSX_MIME_TYPE)
  await store.recordExport()
  return fileName
}

const TEMPLATE_FILE_NAME = 'kuna-template.xlsx'

/** Hands the browser new books as an xlsx file in the template format, every tab with its headers, to fill in and open again. */
export async function downloadTemplate(): Promise<void> {
  const document = newBooksDocument({}, new Date().toISOString())
  const { workbook } = readDocument(previewIdentity(TEMPLATE_FILE_NAME), document)
  downloadFile(await writeWorkbookFile(tabsOfDocument(document), workbook), TEMPLATE_FILE_NAME, XLSX_MIME_TYPE)
}

/** `kuna-<company or sheet name>-<yyyy-mm-dd>.xlsx`, in plain ASCII. */
export function exportFileName(workbook: Pick<Workbook, 'title' | 'settings'>, day: Date): string {
  const name = fold(workbook.settings.companyName || workbook.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  return `kuna-${name || 'workbook'}-${date}.xlsx`
}

function previewIdentity(title: string): Pick<Workbook, 'id' | 'source' | 'title' | 'syncedAt'> {
  return { id: 'preview', source: 'browser', title, syncedAt: new Date().toISOString() }
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}
