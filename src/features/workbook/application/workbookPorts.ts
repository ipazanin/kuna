import type { WorkbookSource } from '../domain/workbook'
import type { RecordStorage } from './recordStorage'

/** The workbook this browser shows: a picked Google Sheet, or one kept here in Excel mode. Never data. */
export interface WorkbookChoice {
  readonly source: WorkbookSource
  readonly id: string
  readonly name: string
}

/** What names a workbook's copy, and when it was read, changed and exported. */
export interface CopyMeta {
  /** The Google spreadsheet id, or the id of the workbook kept in this browser. */
  readonly id: string
  readonly source: WorkbookSource
  readonly title: string
  /** ISO timestamp of the read that produced this copy, or of the last change kept in this browser. */
  readonly syncedAt: string
  /** ISO timestamp of the last export to a file, or null. */
  readonly lastExportedAt: string | null
  /** When the oldest change not yet in an exported file was made. Null when every change is exported. */
  readonly unexportedSince: string | null
}

/** The copy of a workbook this browser keeps, in the format of the storage it came from. The store reads only what names it. */
export interface WorkbookCopy {
  readonly meta: CopyMeta
}

/**
 * One workbook in this browser: a copy of a Google Sheet, or in Excel mode the workbook itself.
 * Every write replaces it whole, since the workbook is small.
 */
export interface WorkbookCache<Copy extends WorkbookCopy> {
  replace(copy: Copy): Promise<void>
  read(): Promise<Copy | null>
  delete(): Promise<void>
  close(): void
}

/** The storage one write goes through: the records of the copy's workbook, and the copy as the write leaves it. */
export interface CopyStorage<Copy extends WorkbookCopy> extends RecordStorage {
  /** The copy with what the storage last read in place of what it held, so the screen shows what the workbook holds now. */
  readBack(copy: Copy): Copy
  /** Reads again what it read last, as a write that failed part way may still have changed it. */
  readAgain(): Promise<void>
}
