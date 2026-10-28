import { currentToken, forgetGoogleSignIn, prepareGoogleIdentity } from '../../google/googleAuth'
import { createWorkbookStore } from '../application/createWorkbookStore'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { WorkbookDocument } from './documentFormat'
import type { DocumentCopy } from './documentRecordStorage'
import { documentStorePorts } from './documentStorePorts'
import type { AppDocument, DriveAccess } from './documentStorePorts'
import { googleDriveAccess } from './googleDriveAccess'
import { loadWorkbookChoice, saveWorkbookChoice, someWorkbookOnDrive } from './workbookChoice'

const now = (): string => new Date().toISOString()

/**
 * An app's store over its document in a Drive file or in this browser, through the page's one Google
 * sign-in. `pickFileTitle` heads the Picker that opens the app's file.
 */
export function pageWorkbookStore<Books extends BooksRead>(app: string, document: AppDocument<Books>, pickFileTitle: string): WorkbookStore<Books, DocumentCopy, WorkbookDocument> {
  const google = googleDriveAccess(pickFileTitle)

  async function driveAccess(): Promise<DriveAccess> {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { fakeDriveAccess } = await import('./fake/fakeDriveSession')
      return fakeDriveAccess(app)
    }
    return google
  }

  return createWorkbookStore({
    ...documentStorePorts(app, document, driveAccess, now),
    loadChoice: () => loadWorkbookChoice(app),
    saveChoice: (choice) => saveWorkbookChoice(app, choice),
    prepareSync() {
      if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
        prepareGoogleIdentity().catch(() => {
          // The click loads it again and reports the failure then.
        })
      }
    },
    hasLiveAccessToken: () => currentToken('drive.file') !== null,
    // The page's Google sign-in serves every app, so it goes only with the last file on Drive.
    keptInBrowser() {
      if (!someWorkbookOnDrive()) forgetGoogleSignIn()
    },
    newLocalId: () => `local-${crypto.randomUUID()}`,
    now,
    pause: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    requestPersistentStorage() {
      navigator.storage?.persist?.().catch(() => {
        // Refused or unsupported: the data stays, but the browser may evict it under pressure.
      })
    },
  })
}
