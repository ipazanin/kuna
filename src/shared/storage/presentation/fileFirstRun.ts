import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { DriveFileLookup } from '../application/workbookPorts'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'

/** The words of a first run that name the app's file. The rest are the same for every app. */
export interface FirstRunWords {
  readonly lead: string
  readonly footer: string
  readonly home: {
    readonly title: string
    readonly dropsTitle: string
    readonly notMade: string
  }
  readonly folder: {
    readonly title: string
    readonly savedIn: string
    readonly choose: string
    readonly onDriveTitle: string
    readonly onDriveDrops: (message: string) => string
    readonly openOnDrive: string
  }
  readonly find: {
    readonly title: string
    /** The sentence around the file's name, which shows between the two. */
    readonly before: string
    readonly after: string
  }
}

/** What an app hands the first run of its file: where the file lives, then the folder for a new one on Drive, or the find of one another device made. */
export interface FileFirstRun {
  /** What the test ids of the first run's controls start with, such as `loans-start` for `loans-start-create`. */
  readonly testId: string
  readonly appName: string
  readonly startRoute: string
  /** Where the first run ends. */
  readonly overviewRoute: string
  readonly store: Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'state' | 'pickBooksFolder' | 'keepOnDrive' | 'replaceLocalWorkbook'>
  /** The name of the file on Drive. */
  readonly fileName: string
  /** The title of a file made in this browser, which is stored with it. */
  readonly localTitle: string
  /** What a new file holds. */
  newContents(): WorkbookDocument
  /** Opens the file on Drive, found by the app's mark or picked, and resolves to whether one is on screen now. */
  findFile(lookup: DriveFileLookup): Promise<boolean>
  readonly words: FirstRunWords
}
