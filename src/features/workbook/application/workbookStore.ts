import { currentToken, forgetGoogleSignIn, prepareGoogleIdentity, signOutOfGoogle, tokenFor } from '../../../shared/google/googleAuth'
import { pathFromMyDrive } from '../../../shared/google/driveClient'
import { pickFromDrive } from '../../../shared/google/picker'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'
import { documentStorePorts } from '../infrastructure/documentStorePorts'
import type { DriveAccess } from '../infrastructure/documentStorePorts'
import { googleDocumentDrive } from '../infrastructure/googleDocumentDrive'
import { loadWorkbookChoice, saveWorkbookChoice } from '../infrastructure/workbookChoice'
import { createWorkbookStore } from './createWorkbookStore'
import type { WorkbookStore } from './createWorkbookStore'

/** The page's token for the Drive file, or a new one, which needs the click that asked for it and on a phone fails instead of leaving the page. */
function driveToken(): Promise<string> {
  return tokenFor('drive.file', null)
}

const GOOGLE_DRIVE_ACCESS: DriveAccess = {
  drive: googleDocumentDrive(driveToken),
  async signIn(then) {
    await tokenFor('drive.file', then)
  },
  signedIn: () => currentToken('drive.file') !== null,
  async pickFolder(title) {
    const [folder] = await pickFromDrive('folder', await driveToken(), { title, parentId: 'root' })
    return folder === undefined ? null : { id: folder.id, name: folder.name }
  },
  async folderPath(folderId) {
    const token = currentToken('drive.readonly')
    return token === null ? null : pathFromMyDrive(token, folderId)
  },
  async pickFile() {
    const [file] = await pickFromDrive('json', await driveToken(), { title: 'Pick the file with your books' })
    return file?.id ?? null
  },
}

async function driveAccess(): Promise<DriveAccess> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeDriveAccess } = await import('../infrastructure/fake/fakeDriveSession')
    return fakeDriveAccess()
  }
  return GOOGLE_DRIVE_ACCESS
}

const now = (): string => new Date().toISOString()

const workbookStore = createWorkbookStore({
  ...documentStorePorts(driveAccess, now),
  loadChoice: loadWorkbookChoice,
  saveChoice: saveWorkbookChoice,
  prepareSync() {
    if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
      prepareGoogleIdentity().catch(() => {
        // The click loads it again and reports the failure then.
      })
    }
  },
  hasLiveAccessToken: () => currentToken('drive.file') !== null,
  forgetGoogleSignIn,
  signOutOfGoogle,
  newLocalId: () => `local-${crypto.randomUUID()}`,
  now,
  pause: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  requestPersistentStorage() {
    navigator.storage?.persist?.().catch(() => {
      // Refused or unsupported: the data stays, but the browser may evict it under pressure.
    })
  },
})

/** The one workbook store the screens share, over the document in a Drive file or in this browser. */
export function useWorkbook(): WorkbookStore<DocumentCopy, WorkbookDocument> {
  return workbookStore
}
