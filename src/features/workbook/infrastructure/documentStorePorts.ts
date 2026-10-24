import type { WorkbookStorePorts } from '../application/createWorkbookStore'
import type { DocumentHome } from '../application/documentHome'
import type { CopyMeta } from '../application/workbookPorts'
import { sameRecord } from '../domain/recordsRead'
import { browserDocumentHome, deleteBrowserDocument, replaceBrowserDocument } from './browserDocument'
import { decodeDocument, encodeDocument } from './documentFormat'
import type { WorkbookDocument } from './documentFormat'
import { documentRecordStorage, readDocument } from './documentRecordStorage'
import type { DocumentCopy } from './documentRecordStorage'
import { createDriveDocument, documentName, driveDocumentHome, findDriveDocument, placeOfDriveDocument, refuseBackup } from './driveDocument'
import type { DocumentDrive } from './driveDocument'
import { openWorkbookCache } from './workbookCache'

/** The app of the hub whose books this store keeps. */
export const COMPANY_APP = 'company'

/** What the store needs from Google to keep the document on Drive. */
export interface DriveAccess {
  readonly drive: DocumentDrive
  /** Asks Google for a token when none is kept, which needs a click. On a phone the tab goes to Google, and `then` is what the app does once back. */
  signIn(then: 'sync' | 'pick' | 'none'): Promise<void>
  /** Whether a token is kept, so a request to Drive needs no click. */
  signedIn(): boolean
  /** The folder the person picks for the file, or null when cancelled. */
  pickFolder(): Promise<string | null>
  /** The file the person picks, or null when cancelled. */
  pickFile(): Promise<string | null>
}

export type DocumentStorePorts = Pick<
  WorkbookStorePorts<DocumentCopy, WorkbookDocument>,
  'openCache' | 'readDriveFile' | 'findDriveFile' | 'createDriveFile' | 'driveFilePlace' | 'read' | 'keepInBrowser' | 'forgetBrowserWorkbook' | 'openStorage'
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

    async findDriveFile() {
      const access = await driveAccess()
      await access.signIn('pick')
      const found = await findDriveDocument(access.drive, COMPANY_APP)
      if (found !== null) {
        return readFile(found, null, documentName(COMPANY_APP))
      }
      const picked = await access.pickFile()
      if (picked === null) {
        return null
      }
      await refuseBackup(access.drive, picked, COMPANY_APP)
      const copy = await readFile(picked, null, documentName(COMPANY_APP))
      if (copy.document.app !== COMPANY_APP) {
        throw new Error(`The file picked holds the books of another ledgerboard app, ${copy.document.app}. Pick ${documentName(COMPANY_APP)}.`)
      }
      return copy
    },

    async createDriveFile(contents) {
      const access = await driveAccess()
      await access.signIn('none')
      if ((await findDriveDocument(access.drive, COMPANY_APP)) !== null) {
        throw new Error(`Drive already holds ${documentName(COMPANY_APP)}, so the app does not make a second one. Choose that file, or trash it in Drive first.`)
      }
      const folderId = await access.pickFolder()
      if (folderId === null) {
        return null
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
        await (await driveAccess()).signIn('none')
        return documentRecordStorage(await driveHome(copy.meta.id), copy, now)
      }
      return documentRecordStorage(browserDocumentHome(copy.meta.id), copy, now)
    },
  }
}
