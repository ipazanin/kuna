import { FOLDER_MIME_TYPE } from '../../../../shared/google/driveClient'
import type { RedirectResume } from '../../../../shared/google/googleRedirect'
import { installedPack } from '../../packs/packContribution'
import type { WorkbookStorePorts } from '../application/createWorkbookStore'
import type { DocumentHome } from '../../../../shared/storage/application/documentHome'
import { codecOfKind } from '../application/recordCodecs'
import type { CopyMeta, PickedFolder } from '../../../../shared/storage/application/workbookPorts'
import { readWorkbook, workbookRecordsOf } from '../domain/readWorkbook'
import type { WorkbookIdentity, WorkbookRecords } from '../domain/readWorkbook'
import { sameRecord } from '../../../../shared/storage/domain/recordsRead'
import type { Workbook } from '../domain/workbook'
import { browserDocumentHome, deleteBrowserDocument, replaceBrowserDocument } from '../../../../shared/storage/infrastructure/browserDocument'
import { decodeDocument, encodeDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { documentRecordStorage, recordsOfDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { createDriveDocument, documentName, driveDocumentHome, findDriveDocument, placeOfDriveDocument, refuseBackup } from '../../../../shared/storage/infrastructure/driveDocument'
import type { DocumentDrive } from '../../../../shared/storage/infrastructure/driveDocument'
import { openWorkbookCache } from '../../../../shared/storage/infrastructure/workbookCache'

/** The app of the hub whose books this store keeps. */
export const COMPANY_APP = 'company'

/** The contributor that stores core's kinds. */
const CORE = 'core'
const CORE_SCHEMA_VERSION = 1

/** The schema version each contributor of this app writes: core, and the installed pack. */
export function installedSchema(): WorkbookDocument['schema'] {
  const pack = installedPack().workbook
  return pack === null ? { [CORE]: CORE_SCHEMA_VERSION } : { [CORE]: CORE_SCHEMA_VERSION, [pack.key.name]: pack.schemaVersion }
}

/** The records a document holds of every kind, core's and the installed pack's. */
function workbookRecordsOfDocument(document: WorkbookDocument): WorkbookRecords {
  return workbookRecordsOf((kind) => recordsOfDocument(document, kind, codecOfKind), installedPack().workbook)
}

/** A document's records and the workbook they make. */
export function readDocument(identity: WorkbookIdentity, document: WorkbookDocument): { readonly records: WorkbookRecords; readonly workbook: Workbook } {
  const records = workbookRecordsOfDocument(document)
  return { records, workbook: readWorkbook(identity, records, installedPack().workbook) }
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

export type DocumentStorePorts = Pick<
  WorkbookStorePorts<DocumentCopy, WorkbookDocument>,
  | 'openCache'
  | 'readDriveFile'
  | 'findDriveFile'
  | 'pickBooksFolder'
  | 'pickDriveFolder'
  | 'createDriveFile'
  | 'driveFilePlace'
  | 'read'
  | 'keepInBrowser'
  | 'forgetBrowserWorkbook'
  | 'openStorage'
>

/**
 * The store's ports for the workbook as one document, in a Drive file or in this browser. Each file
 * keeps one home for as long as the page lives, so the home remembers the day's backup.
 */
export function documentStorePorts(driveAccess: () => Promise<DriveAccess>, now: () => string): DocumentStorePorts {
  const driveHomes = new Map<string, DocumentHome>()

  async function driveHome(fileId: string): Promise<DocumentHome> {
    const home = driveHomes.get(fileId) ?? driveDocumentHome((await driveAccess()).drive, fileId, COMPANY_APP)
    driveHomes.set(fileId, home)
    return home
  }

  async function pickDriveFolder(title: string): Promise<PickedFolder | null> {
    const access = await driveAccess()
    const picked = await access.pickFolder(title)
    return picked === null ? null : { ...picked, path: await access.folderPath(picked.id) }
  }

  async function refuseSecondFile(drive: DocumentDrive): Promise<void> {
    if ((await findDriveDocument(drive, COMPANY_APP)) !== null) {
      throw new Error(`Drive already holds ${documentName(COMPANY_APP)}, so the app does not make a second one. Choose that file, or trash it in Drive first.`)
    }
  }

  function driveMeta(fileId: string, title: string): CopyMeta {
    return { id: fileId, source: 'drive', title, syncedAt: now(), lastExportedAt: null, unexportedSince: null }
  }

  async function readFile(fileId: string, held: DocumentCopy | null, title: string): Promise<DocumentCopy> {
    const cached = held === null ? null : { revision: held.revision, text: encodeDocument(held.document) }
    const stored = await (await driveHome(fileId)).read(cached)
    const meta = { ...(held?.meta ?? driveMeta(fileId, title)), syncedAt: now() }
    return stored === cached && held !== null ? { ...held, meta } : { meta, revision: stored.revision, document: decodeDocument(stored.text) }
  }

  return {
    openCache: openWorkbookCache,

    async readDriveFile(choice, held) {
      await (await driveAccess()).signIn('sync')
      return readFile(choice.id, held, choice.name)
    },

    async findDriveFile(lookup) {
      const access = await driveAccess()
      await access.signIn(lookup)
      const found = lookup === 'find' ? await findDriveDocument(access.drive, COMPANY_APP) : null
      if (found !== null) {
        return readFile(found, null, documentName(COMPANY_APP))
      }
      const picked = await access.pickFile()
      if (picked === null) {
        return null
      }
      const name = await access.drive.nameOf(picked)
      refuseBackup(name, COMPANY_APP)
      const copy = await readFile(picked, null, name)
      if (copy.document.app !== COMPANY_APP) {
        throw new Error(`The file picked holds the books of another ledgerboard app, ${copy.document.app}. Pick ${documentName(COMPANY_APP)}.`)
      }
      return copy
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
      const { fileId } = await createDriveDocument(access.drive, folderId, COMPANY_APP, encodeDocument(document))
      const created = await readFile(fileId, null, documentName(COMPANY_APP))
      if (!sameRecord(created.document.records, contents.records)) {
        throw new Error(`${documentName(COMPANY_APP)} on Drive does not read back with the records it was given, so the app does not use it. Trash the new file in Drive and try again.`)
      }
      return created
    },

    async driveFilePlace(fileId) {
      const access = await driveAccess()
      return access.signedIn() ? placeOfDriveDocument(access.drive, fileId, COMPANY_APP) : null
    },

    read(copy) {
      const { id, source, title, syncedAt } = copy.meta
      return readDocument({ id, source, title, syncedAt }, copy.document)
    },

    async keepInBrowser(meta, document) {
      const stored = await replaceBrowserDocument(meta.id, encodeDocument(document))
      return { meta, revision: stored.revision, document }
    },

    forgetBrowserWorkbook: deleteBrowserDocument,

    async openStorage(copy) {
      if (copy.meta.source === 'drive') {
        await (await driveAccess()).signIn(null)
        return documentRecordStorage(await driveHome(copy.meta.id), copy, installedSchema(), codecOfKind, now)
      }
      return documentRecordStorage(browserDocumentHome(copy.meta.id), copy, installedSchema(), codecOfKind, now)
    },
  }
}
