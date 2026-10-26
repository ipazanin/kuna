import type { MonthKey } from '../../../shared/calendar/monthKey'
import type { DocumentReading, DocumentRefusal, DocumentTab } from '../domain/accountant/accountantDocument'
import { accountantFileNameOf, filingsByPeriod, sameReading } from '../domain/accountant/accountantFile'
import type { AccountantDocumentKind, AccountantFile, AccountantFileFormat } from '../domain/accountant/accountantFile'
import type { SalaryWorkbook } from '../domain/accountant/salaryWorkbook'
import { readSalaryWorkbook } from '../domain/accountant/salaryWorkbookReading'
import type { VatReturn } from '../domain/accountant/vatReturn'
import { readVatReturn } from '../domain/accountant/vatReturnReading'

/** A spreadsheet in one of the accountant's folders, with the version Drive gives it, which goes up with every change. */
export interface DriveWorkbook {
  readonly id: string
  readonly name: string
  readonly format: AccountantFileFormat
  readonly version: string
}

export type AccountantFolderListing = { readonly kind: 'listed'; readonly files: readonly DriveWorkbook[] } | { readonly kind: 'refused'; readonly reason: string }

/** The accountant's folders in Drive, read only. */
export interface AccountantFolders {
  /** The spreadsheets in the folder at the path from My Drive and in every folder inside it, or why the path leads to no single folder. */
  files(path: readonly string[]): Promise<AccountantFolderListing>
  /** A spreadsheet's tabs: an xlsx as filed, a Google Sheet exported as xlsx. */
  tabs(file: DriveWorkbook): Promise<DocumentTab[]>
}

export interface AccountantFolderPaths {
  readonly vatReturns: readonly string[]
  readonly payroll: readonly string[]
}

/** A workbook file as a read found it, with its tabs, or why Drive gave none. */
type ReadWorkbookFile = AccountantFile &
  DriveWorkbook & { readonly contents: { readonly tabs: readonly DocumentTab[] } | { readonly failure: string } }

/** What one read of the two folders found, which this device keeps until the next read. */
export interface AccountantRead {
  /** ISO timestamp of the read. */
  readonly readAt: string
  readonly folders: AccountantFolderPaths
  readonly files: readonly ReadWorkbookFile[]
  /** Why each folder could not be listed, or null for a folder that was. */
  readonly folderProblems: { readonly vatReturns: string | null; readonly payroll: string | null }
}

/** A period's workbook that could not be read, with the tab, row and reason when the reader has them. */
export interface UnreadWorkbook {
  readonly period: MonthKey
  readonly kind: AccountantDocumentKind
  readonly name: string
  readonly refusal: DocumentRefusal
}

/** The returns a read holds, one per period, the salaries, one per employee and period, and the periods whose workbook could not be read. */
export interface AccountantDocuments {
  readonly vatReturns: readonly VatReturn[]
  readonly salaries: readonly SalaryWorkbook[]
  readonly unread: readonly UnreadWorkbook[]
  /** Every period with a VAT return filed, read or not. */
  readonly filedVatPeriods: readonly MonthKey[]
}

/**
 * Lists the two folders and takes each workbook's tabs: from the previous read when Drive gives the
 * file the same id and version, otherwise from Drive. A file Drive does not give is kept with why,
 * so one failed download leaves the other periods read.
 */
export async function readAccountantDocuments(folders: AccountantFolders, paths: AccountantFolderPaths, previous: AccountantRead | null, readAt: string): Promise<AccountantRead> {
  const [vatReturns, payroll] = await Promise.all([listed(folders, paths.vatReturns, 'vat-return'), listed(folders, paths.payroll, 'salary')])
  const kept = new Map((previous?.files ?? []).filter((file) => 'tabs' in file.contents).map((file) => [`${file.id} ${file.version}`, file.contents] as const))
  const files = await Promise.all(
    [...vatReturns.files, ...payroll.files].map(async (file): Promise<ReadWorkbookFile> => ({ ...file, contents: kept.get(`${file.id} ${file.version}`) ?? (await tabsOf(folders, file)) })),
  )
  return { readAt, folders: paths, files, folderProblems: { vatReturns: vatReturns.problem, payroll: payroll.problem } }
}

async function listed(
  folders: AccountantFolders,
  path: readonly string[],
  kind: AccountantDocumentKind,
): Promise<{ readonly files: (AccountantFile & DriveWorkbook)[]; readonly problem: string | null }> {
  const listing = await folders.files(path)
  if (listing.kind === 'refused') {
    const [documents, folder] = kind === 'vat-return' ? ['VAT returns', 'VAT returns folder'] : ['salary workbooks', 'payroll folder']
    return { files: [], problem: `${listing.reason}, so no ${documents} were read. Check the ${folder} on Settings, General.` }
  }
  const files = listing.files.flatMap((file) => {
    const fileName = accountantFileNameOf(file.name)
    return fileName?.kind === kind ? [{ ...file, ...fileName }] : []
  })
  return { files, problem: null }
}

async function tabsOf(folders: AccountantFolders, file: DriveWorkbook): Promise<ReadWorkbookFile['contents']> {
  try {
    return { tabs: await folders.tabs(file) }
  } catch (failure) {
    return { failure: failure instanceof Error ? failure.message : String(failure) }
  }
}

/**
 * Each period's workbook read. The mailed xlsx is read before a Google Sheet converted from it, and a
 * period whose other file reads differently, or whose file could not be read, is unread with why.
 */
export function accountantDocumentsOf(read: AccountantRead): AccountantDocuments {
  const vatFiles = read.files.filter((file) => file.kind === 'vat-return')
  const vat = periodsRead(vatFiles, readVatReturn)
  const salary = periodsRead(read.files.filter((file) => file.kind === 'salary'), readSalaryWorkbook)
  return {
    vatReturns: vat.documents,
    salaries: salary.documents.flat(),
    unread: [...vat.unread, ...salary.unread],
    filedVatPeriods: [...new Set(vatFiles.map((file) => file.period))].sort(),
  }
}

function periodsRead<Document>(
  files: readonly ReadWorkbookFile[],
  reader: (period: MonthKey, tabs: readonly DocumentTab[]) => DocumentReading<Document>,
): { readonly documents: Document[]; readonly unread: UnreadWorkbook[] } {
  const readingOf = (file: ReadWorkbookFile): DocumentReading<Document> =>
    'failure' in file.contents ? { refusal: { tab: null, row: null, reason: `Drive did not give the file: ${file.contents.failure}` } } : reader(file.period, file.contents.tabs)
  const documents: Document[] = []
  const unread: UnreadWorkbook[] = []
  for (const { file, alsoFiled } of filingsByPeriod(files)) {
    const unreadAs = (refusal: DocumentRefusal) => unread.push({ period: file.period, kind: file.kind, name: file.name, refusal })
    const reading = readingOf(file)
    if ('refusal' in reading) {
      unreadAs(reading.refusal)
      continue
    }
    const differing = alsoFiled.find((other) => !sameReading(reading, readingOf(other)))
    if (differing !== undefined) {
      unreadAs({ tab: null, row: null, reason: `${differing.name} in the same folder reads differently` })
      continue
    }
    documents.push(reading.document)
  }
  return { documents, unread }
}
