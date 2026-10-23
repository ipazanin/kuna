import { currentAccessToken, forgetGoogleSignIn, prepareGoogleIdentity, signOutOfGoogle } from '../../../shared/google/googleAuth'
import { googleWorkbookPorts, readSnapshotFrom, sheetsValuesForWriting } from '../infrastructure/googleWorkbookPorts'
import { googleWorkbookWriter } from '../infrastructure/googleWorkbookWriter'
import { localWorkbookWriter } from '../infrastructure/localWorkbookWriter'
import { spreadsheetRecordStorage } from '../infrastructure/spreadsheetRecordStorage'
import { readSnapshot } from '../infrastructure/spreadsheetTab'
import { openWorkbookCache } from '../infrastructure/workbookCache'
import { loadWorkbookChoice, saveWorkbookChoice } from '../infrastructure/workbookChoice'
import type { WorkbookSnapshot } from '../infrastructure/workbookSnapshot'
import type { WorkbookWriter } from '../infrastructure/workbookWriter'
import { createWorkbookStore } from './createWorkbookStore'
import type { WorkbookStore, WorkbookStorePorts } from './createWorkbookStore'
import { readFromGoogle } from './readFromGoogle'

/** What the store needs besides the spreadsheet adapters, Google's writer among it. */
export type SpreadsheetStorePorts = Omit<WorkbookStorePorts<WorkbookSnapshot>, 'read' | 'localCopy' | 'openStorage'> & {
  /** Writes to the given Sheet. Asks for a token first when none is kept, so call it before anything else awaits. */
  googleWriter(spreadsheetId: string): Promise<WorkbookWriter>
}

/** The store's ports for a workbook kept as tabs: a Google Sheet, or the workbook kept in this browser. */
export function spreadsheetStorePorts(ports: SpreadsheetStorePorts): WorkbookStorePorts<WorkbookSnapshot> {
  return {
    ...ports,
    read: readSnapshot,
    localCopy: (meta, tabs) => ({ meta: { ...meta, missingTabs: [] }, ...tabs }),
    async openStorage(copy) {
      return spreadsheetRecordStorage(copy.meta.source === 'excel' ? localWorkbookWriter(copy) : await ports.googleWriter(copy.meta.id))
    },
  }
}

const workbookStore = createWorkbookStore(
  spreadsheetStorePorts({
    loadChoice: loadWorkbookChoice,
    saveChoice: saveWorkbookChoice,
    openCache: openWorkbookCache,
    async fetchFromGoogle(sheet) {
      // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
      if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
        const { fakeGoogleSheet, fakeSheetsSession } = await import('../infrastructure/fake/fakeSheets')
        return readSnapshotFrom(fakeSheetsSession(), fakeGoogleSheet)
      }
      return readFromGoogle(googleWorkbookPorts, sheet)
    },
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
    now: () => new Date().toISOString(),
    requestPersistentStorage() {
      navigator.storage?.persist?.().catch(() => {
        // Refused or unsupported: the data stays, but the browser may evict it under pressure.
      })
    },
    async googleWriter(spreadsheetId) {
      // Inline, as above: the fake build writes to a Sheet held in memory for the session.
      if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
        const { fakeSheetsSession } = await import('../infrastructure/fake/fakeSheets')
        return googleWorkbookWriter(fakeSheetsSession())
      }
      return googleWorkbookWriter(await sheetsValuesForWriting(spreadsheetId))
    },
  }),
)

/** The one workbook store the screens share, over the spreadsheet adapters. */
export function useWorkbook(): WorkbookStore<WorkbookSnapshot> {
  return workbookStore
}
