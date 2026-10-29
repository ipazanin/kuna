import { FOLDER_MIME_TYPE } from '../../google/driveClient'
import type { RedirectResume } from '../../google/googleRedirect'
import { BooksAlreadyOnDrive } from '../application/booksAlreadyOnDrive'
import type { BooksRead, WorkbookStorePorts } from '../application/createWorkbookStore'
import type { DocumentHome } from '../application/documentHome'
import type { CopyMeta, PickedFolder } from '../application/workbookPorts'
import type { CodecOfKind } from '../domain/recordCodec'
import { sameRecord } from '../domain/recordsRead'
import { browserDocumentHome, deleteBrowserDocument, replaceBrowserDocument } from './browserDocument'
import { decodeDocument, encodeDocument } from './documentFormat'
import type { WorkbookDocument } from './documentFormat'
import { documentRecordStorage } from './documentRecordStorage'
import type { DocumentCopy } from './documentRecordStorage'
import { createDriveDocument, documentName, driveDocumentHome, findDriveDocument, placeOfDriveDocument, refuseBackup } from './driveDocument'
import type { DocumentDrive } from './driveDocument'
import { openWorkbookCache } from './workbookCache'

/** What an app's document holds: the schema version each contributor writes, the codec of each kind, and the books its records make. */
export interface AppDocument<Books extends BooksRead> {
  schema(): WorkbookDocument['schema']
  readonly codecOf: CodecOfKind
  read(copy: DocumentCopy): Books
}

/** What the store needs from Google to keep the document on Drive. */
export interface DriveAccess {
  readonly drive: DocumentDrive
  /**
   * Asks Google for a token when the page holds none, which needs a click. On a phone the tab goes
   * to Google, and `then` is what the app does once back. With no `then`, as for a write, a phone
   * fails instead of leaving, since what was tapped could not run again.
   */
  signIn(then: RedirectResume | null): Promise<void>
  /** Whether the page holds a token, so a request to Drive needs no click. */
  signedIn(): boolean
  /** The folder the person picks in the Picker opened at My Drive, or null when cancelled. */
  pickFolder(title: string): Promise<{ readonly id: string; readonly name: string } | null>
  /** The names of the folders from My Drive down to this one, or null while the page cannot read the whole Drive. */
  folderPath(folderId: string): Promise<readonly string[] | null>
  /** The file the person picks, or null when cancelled. */
  pickFile(): Promise<string | null>
}

export type DocumentStorePorts<Books extends BooksRead> = Pick<
  WorkbookStorePorts<Books, DocumentCopy, WorkbookDocument>,
  | 'openCache'
  | 'readDriveFile'
  | 'findDriveFile'
  | 'pickBooksFolder'
  | 'pickDriveFolder'
  | 'createDriveFile'
  | 'driveFilePlace'
  | 'trashDriveFile'
  | 'read'
  | 'keepInBrowser'
  | 'forgetBrowserWorkbook'
  | 'openStorage'
>

/**
 * The store's ports for an app's workbook as one document, in a Drive file or in this browser. Each
 * file keeps one home for as long as the page lives, so the home remembers the day's backup.
 */
export function documentStorePorts<Books extends BooksRead>(
  app: string,
  { schema, codecOf, read }: AppDocument<Books>,
  driveAccess: () => Promise<DriveAccess>,
  now: () => string,
): DocumentStorePorts<Books> {
  const driveHomes = new Map<string, DocumentHome>()

  async function driveHome(fileId: string): Promise<DocumentHome> {
    const home = driveHomes.get(fileId) ?? driveDocumentHome((await driveAccess()).drive, fileId, app)
    driveHomes.set(fileId, home)
    return home
  }

  async function pickDriveFolder(title: string): Promise<PickedFolder | null> {
    const access = await driveAccess()
    const picked = await access.pickFolder(title)
    return picked === null ? null : { ...picked, path: await access.folderPath(picked.id) }
  }

  async function refuseSecondFile(drive: DocumentDrive): Promise<void> {
    if ((await findDriveDocument(drive, app)) !== null) {
      throw new BooksAlreadyOnDrive(documentName(app))
    }
  }

  function driveMeta(fileId: string, title: string): CopyMeta {
    return { id: fileId, source: 'drive', title, syncedAt: now(), lastExportedAt: null, unexportedSince: null }
  }

  /** The file as it is now, refused when it holds another app's books. */
  async function readFile(fileId: string, held: DocumentCopy | null, title: string): Promise<DocumentCopy> {
    const cached = held === null ? null : { revision: held.revision, text: encodeDocument(held.document) }
    const stored = await (await driveHome(fileId)).read(cached)
    const meta = { ...(held?.meta ?? driveMeta(fileId, title)), syncedAt: now() }
    if (stored === cached && held !== null) {
      return { ...held, meta }
    }
    const document = decodeDocument(stored.text)
    if (document.app !== app) {
      throw new Error(`${title} holds the books of another Kuna app, ${document.app}. Choose ${documentName(app)}.`)
    }
    return { meta, revision: stored.revision, document }
  }

  return {
    openCache: openWorkbookCache,

    async readDriveFile(choice, held) {
      await (await driveAccess()).signIn({ resume: 'sync' })
      return readFile(choice.id, held, choice.name)
    },

    async findDriveFile(lookup) {
      const access = await driveAccess()
      await access.signIn({ resume: lookup, app })
      const found = lookup === 'find' ? await findDriveDocument(access.drive, app) : null
      if (found !== null) {
        return readFile(found, null, documentName(app))
      }
      const picked = await access.pickFile()
      if (picked === null) {
        return null
      }
      const name = await access.drive.nameOf(picked)
      refuseBackup(name, app)
      return readFile(picked, null, name)
    },

    async pickBooksFolder() {
      await refuseSecondFile((await driveAccess()).drive)
      return pickDriveFolder('Choose the folder for your books')
    },

    pickDriveFolder,

    async createDriveFile(folderId, contents, folders) {
      const access = await driveAccess()
      await refuseSecondFile(access.drive)
      const inside = folders.length === 0 ? [] : await access.drive.children(folderId)
      for (const name of folders) {
        if (!inside.some((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === name)) {
          await access.drive.createFolder(folderId, name)
        }
      }
      const document = { ...contents, savedAt: now() }
      const { fileId } = await createDriveDocument(access.drive, folderId, app, encodeDocument(document))
      const created = await readFile(fileId, null, documentName(app))
      if (!sameRecord(created.document.records, contents.records)) {
        throw new Error(`${documentName(app)} on Drive does not read back with the records it was given, so the app does not use it. Trash the new file in Drive and try again.`)
      }
      return created
    },

    async driveFilePlace(fileId) {
      const access = await driveAccess()
      return access.signedIn() ? placeOfDriveDocument(access.drive, fileId, app) : null
    },

    async trashDriveFile(fileId) {
      const access = await driveAccess()
      await access.signIn(null)
      await access.drive.trash(fileId)
      driveHomes.delete(fileId)
    },

    read,

    async keepInBrowser(meta, document) {
      const stored = await replaceBrowserDocument(meta.id, encodeDocument(document))
      return { meta, revision: stored.revision, document }
    },

    forgetBrowserWorkbook: deleteBrowserDocument,

    async openStorage(copy) {
      if (copy.meta.source === 'drive') {
        await (await driveAccess()).signIn(null)
        return documentRecordStorage(await driveHome(copy.meta.id), copy, schema(), codecOf, now)
      }
      return documentRecordStorage(browserDocumentHome(copy.meta.id), copy, schema(), codecOf, now)
    },
  }
}
