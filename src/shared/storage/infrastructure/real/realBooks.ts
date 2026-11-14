import { answerFromFirstRun } from '../../../app/kunaStart'
import { replaceBrowserDocument } from '../browserDocument'
import { keepChosenCopy } from '../chosenCopy'
import { decodeDocument } from '../documentFormat'
import type { DocumentCopy } from '../documentRecordStorage'
import { documentName } from '../driveDocument'
import { saveWorkbookChoice } from '../workbookChoice'

/**
 * The id each app's real books are kept under in this browser. It holds the marker `assert-no-fake-bytes` looks for in a
 * production bundle, which tests/devOnlyMarkers.spec.ts holds to scripts/support/devOnlyMarkers.mjs.
 */
export const REAL_BOOKS_ID = 'REAL-BOOKS-DEV-ONLY-DO-NOT-SHIP'

/** A file of the folder `npm run dev:real` serves, or null when the folder does not hold it. */
export async function realBooksFile(name: string): Promise<string | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}__real-books/${name}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`The dev server could not read ${name} from KUNA_REAL_BOOKS_DIR: ${response.status}.`)
  return response.text()
}

/**
 * Keeps the app's file from the real books folder in this browser and chooses it, as the fake seeds do with made-up books, and
 * answers the home welcome with the app kept in this browser. Gives the copy, or null when the folder has no file for the app,
 * which leaves the app on its first run. Only an app's install imports this, behind inline `import.meta.env.DEV` and
 * VITE_REAL_BOOKS comparisons.
 */
export async function seedRealBook(app: string): Promise<DocumentCopy | null> {
  const text = await realBooksFile(documentName(app))
  if (text === null) {
    saveWorkbookChoice(app, null)
    return null
  }
  const id = `${REAL_BOOKS_ID}-${app}`
  const stored = await replaceBrowserDocument(id, text)
  const copy: DocumentCopy = {
    meta: { id, source: 'browser', title: documentName(app), syncedAt: new Date().toISOString(), lastExportedAt: null, unexportedSince: null },
    revision: stored.revision,
    document: decodeDocument(text),
  }
  await keepChosenCopy(app, copy)
  answerFromFirstRun('browser', app, false)
  return copy
}
