import { currentAccessToken, forgetGoogleSignIn, prepareGoogleIdentity, requestToken, signOutOfGoogle } from '../../../shared/google/googleAuth'
import { pickFromDrive } from '../../../shared/google/picker'
import type { PickerKind } from '../../../shared/google/picker'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'
import { documentStorePorts } from '../infrastructure/documentStorePorts'
import type { DriveAccess } from '../infrastructure/documentStorePorts'
import { googleDocumentDrive } from '../infrastructure/googleDocumentDrive'
import { loadWorkbookChoice, saveWorkbookChoice } from '../infrastructure/workbookChoice'
import { createWorkbookStore } from './createWorkbookStore'
import type { WorkbookStore } from './createWorkbookStore'

/** A token for the Drive file: the kept one, or a new one, which needs the click that asked for it. */
async function driveToken(): Promise<string> {
  return currentAccessToken()?.value ?? (await requestToken('none')).value
}

async function picked(kind: PickerKind, title: string): Promise<string | null> {
  const [document] = await pickFromDrive(kind, await driveToken(), { title })
  return document?.id ?? null
}

const GOOGLE_DRIVE_ACCESS: DriveAccess = {
  drive: googleDocumentDrive(driveToken),
  async signIn(then) {
    if (currentAccessToken() === null) {
      await requestToken(then)
    }
  },
  signedIn: () => currentAccessToken() !== null,
  pickFolder: () => picked('folder', 'Pick the folder for the books'),
  pickFile: () => picked('json', 'Pick ledgerboard-company.json'),
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
  hasLiveAccessToken: () => currentAccessToken() !== null,
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
