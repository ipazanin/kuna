import type { CivilDate } from '../../calendar/civilDate'
import type { WorkbookSource } from '../domain/recordsRead'
import type { RecordStorage } from './recordStorage'

/** The workbook this browser shows: a file on Drive, or one kept in this browser. Never data. */
export interface WorkbookChoice {
  readonly source: WorkbookSource
  readonly id: string
  readonly name: string
}

/** What names a workbook's copy, and when it was read, changed and exported. */
export interface CopyMeta {
  /** The Drive file's id, or the id of the workbook kept in this browser. */
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

/** The copy of a workbook this browser keeps. The store reads only what names it. */
export interface WorkbookCopy {
  readonly meta: CopyMeta
}

/** The copy of one workbook in this browser, which a read or a write replaces whole, since the workbook is small. */
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

/** How the person chooses the books on Drive: `find` opens the file the app marked, or the Picker when there is none, and `pick` always opens the Picker. */
export type DriveFileLookup = 'find' | 'pick'

/** Where a Drive file sits, and the day of its newest backup, null before the first. */
export interface DriveFilePlace {
  readonly folderId: string
  /** Null for a folder the app was never given, which it can name no more than read. */
  readonly folderName: string | null
  readonly lastBackup: CivilDate | null
  /** Whether it sits in the app's subfolder of the Kuna folder. */
  readonly inKunaFolder: boolean
  /** Whether the file went ahead of what goes with it, and a press still has to bring the rest. */
  readonly moveUnfinished: boolean
}

/** A folder whose files Kuna made may go along. The folder itself never moves, since it may hold what Kuna did not make. */
export interface KunaFilesFolder {
  /** The folder's name, beside the file or, with `fromPath`, in the app's subfolder of the Kuna folder. */
  readonly name: string
  /** Where a setting names it from My Drive, for one that is not beside the file. */
  readonly fromPath?: readonly string[]
  /** The mail source that files into it, whose files are the only ones that go, or null for every file the app made. */
  readonly mailSource: string | null
}

/** What goes along when an app's file moves into the Kuna folder: only what Kuna made. */
export interface DriveFileBeside {
  readonly files: readonly string[]
  readonly folders: readonly KunaFilesFolder[]
  /** Words for what a setting reaches elsewhere and stays, by a path from My Drive or an id. */
  readonly stays: readonly string[]
}

/** How many files of one folder go, and how many stay because Kuna cannot say it made them. */
export interface KunaFilesInFolder {
  readonly name: string
  readonly kuna: number
  readonly others: number
  /** Where a setting names it from My Drive, which Kuna stops reading once the file has moved. */
  readonly fromPath?: readonly string[]
}

/** What a move into the Kuna folder would take and leave. */
export interface DriveMovePlan {
  readonly files: readonly string[]
  readonly folders: readonly KunaFilesInFolder[]
  /** How many of this app's backups go with it. */
  readonly backups: number
  readonly stays: readonly string[]
}

/** A Drive folder the person picked, with the names of the folders from My Drive down to it, or null where the app cannot see them. */
export interface PickedFolder {
  readonly id: string
  readonly name: string
  /** The folder's own name last. Null without Drive read access, since `drive.file` cannot read a picked folder's parent. */
  readonly path: readonly string[] | null
}
