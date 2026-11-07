import { FOLDER_MIME_TYPE } from '../../google/driveClient'
import { GoogleApiError, isRateLimited } from '../../google/googleApi'
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
import { documentRecordStorage, documentRecords } from './documentRecordStorage'
import type { DocumentCopy } from './documentRecordStorage'
import { backupsOfDocument, findKunaFolder, finishDriveMove, isKunaFolderOfApp, kunaFolderOfApp, moveDriveDocument, planDriveMove, unfinishedMoveOf } from './kunaFolder'
import { APP_PROPERTY, createDriveDocument, documentName, driveDocumentHome, findDriveDocument, placeOfDriveDocument, refuseBackup } from './driveDocument'
import type { DocumentDrive } from './driveDocument'
import { openWorkbookCache } from './workbookCache'
import { words } from './words'

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
  | 'pickDriveFolder'
  | 'driveHomeOfApp'
  | 'folderBesideFile'
  | 'hasKunaFolder'
  | 'createDriveFile'
  | 'planMoveIntoKuna'
  | 'moveIntoKuna'
  | 'finishMoveIntoKuna'
  | 'driveFilePlace'
  | 'trashDriveFile'
  | 'countBackups'
  | 'trashBackups'
  | 'read'
  | 'withChanges'
  | 'viewOf'
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
  const markChecked = new Set<string>()

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

  /**
   * Gives a file the person opened the app's mark, once a page, so another device's search can find it and never makes an empty twin. The mark is a
   * private property, so the file's content and revisions stay as they are. It waits when another file holds the mark, since a search must find one.
   * It is an extra: a failure here leaves the file working, and the next page tries again.
   */
  async function markOpenedFile(drive: DocumentDrive, fileId: string): Promise<void> {
    if (markChecked.has(fileId)) return
    markChecked.add(fileId)
    try {
      if ((await drive.appPropertyOf(fileId, APP_PROPERTY)) === null && (await drive.findByAppProperty(APP_PROPERTY, app)).length === 0) {
        await drive.setAppProperty(fileId, APP_PROPERTY, app)
      }
    } catch {
      markChecked.delete(fileId)
    }
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
      throw new Error(words.otherApp(title, document.app, documentName(app)))
    }
    return { meta, revision: stored.revision, document }
  }

  return {
    openCache: openWorkbookCache,

    async readDriveFile(choice, held) {
      const access = await driveAccess()
      await access.signIn({ resume: 'sync' })
      const copy = await readFile(choice.id, held, choice.name)
      await markOpenedFile(access.drive, choice.id)
      return copy
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
      const copy = await readFile(picked, null, name)
      await markOpenedFile(access.drive, picked)
      return copy
    },

    pickDriveFolder,

    async driveHomeOfApp(parentId) {
      const { drive } = await driveAccess()
      await refuseSecondFile(drive)
      return kunaFolderOfApp(drive, app, parentId)
    },

    async hasKunaFolder() {
      const access = await driveAccess()
      return access.signedIn() ? (await findKunaFolder(access.drive)) !== null : null
    },

    async folderBesideFile(fileId, name) {
      const { drive } = await driveAccess()
      const parentId = await drive.parentOf(fileId)
      const inside = await drive.children(parentId)
      if (!inside.some((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === name)) {
        await drive.createFolder(parentId, name)
      }
    },

    async planMoveIntoKuna(fileId, beside) {
      return planDriveMove((await driveAccess()).drive, fileId, app, beside)
    },

    async moveIntoKuna(fileId, beside, parentId) {
      const access = await driveAccess()
      await access.signIn(null)
      return moveDriveDocument(access.drive, fileId, app, beside, parentId)
    },

    async finishMoveIntoKuna(fileId) {
      return finishDriveMove((await driveAccess()).drive, fileId)
    },

    async createDriveFile(folderId, contents) {
      const access = await driveAccess()
      await refuseSecondFile(access.drive)
      const document = { ...contents, savedAt: now() }
      const { fileId } = await createDriveDocument(access.drive, folderId, app, encodeDocument(document))
      const created = await readFile(fileId, null, documentName(app))
      if (!sameRecord(created.document.records, contents.records)) {
        throw new Error(words.notReadBack(documentName(app)))
      }
      return created
    },

    async driveFilePlace(fileId) {
      const access = await driveAccess()
      if (!access.signedIn()) return null
      const place = await placeOfDriveDocument(access.drive, fileId, app)
      return { ...place, inKunaFolder: await isKunaFolderOfApp(access.drive, app, place.folderId), moveUnfinished: (await unfinishedMoveOf(access.drive, fileId)) !== null }
    },

    async trashDriveFile(fileId) {
      const access = await driveAccess()
      await access.signIn(null)
      try {
        await access.drive.trash(fileId)
      } catch (refused) {
        if (refused instanceof GoogleApiError && (refused.status === 404 || (refused.status === 403 && !isRateLimited(refused)))) throw new Error(words.trashRefused)
        throw refused
      }
      driveHomes.delete(fileId)
    },

    async countBackups(fileId) {
      const access = await driveAccess()
      return access.signedIn() ? (await backupsOfDocument(access.drive, fileId, app)).length : null
    },

    async trashBackups(fileId) {
      const access = await driveAccess()
      await access.signIn(null)
      const failed: { readonly name: string; readonly failure: unknown }[] = []
      for (const backup of await backupsOfDocument(access.drive, fileId, app)) {
        await access.drive.trash(backup.id).catch((failure: unknown) => failed.push({ name: backup.name, failure }))
      }
      const first = failed[0]
      if (first !== undefined) {
        const refused = first.failure instanceof GoogleApiError && first.failure.status === 403 && !isRateLimited(first.failure)
        const reason = refused ? words.onlyOwnerBins : first.failure instanceof Error ? first.failure.message : String(first.failure)
        throw new Error(words.backupsNotBinned(failed.map(({ name }) => name).join(', '), reason))
      }
    },

    read,

    withChanges(copy, changes) {
      return { ...copy, document: documentRecords(copy.document, schema(), codecOf, now).changed(changes) }
    },

    viewOf(copy) {
      return documentRecords(copy.document, schema(), codecOf, now)
    },

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
