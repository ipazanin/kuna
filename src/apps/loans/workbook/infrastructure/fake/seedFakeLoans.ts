import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../../shared/storage/infrastructure/documentRecordStorage'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { openWorkbookCache } from '../../../../../shared/storage/infrastructure/workbookCache'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { LOANS_APP, emptyLoansDocument } from '../loansDocument'

/**
 * The id of the Loans file the fake build keeps in this browser, apart from the company's so the two
 * never share a database. It holds the marker `assert-no-fake-bytes` looks for in a production bundle.
 */
const FAKE_LOANS_ID = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP-LOANS'

const DAY = 86_400_000

/**
 * Sets up the fake build's Loans file as `?loans=` names it: `drive` a file on the fake Drive and
 * `browser` one kept in this browser with changes nine days past their last export, each chosen on
 * this device, and `other-device` a file on the fake Drive that another device made, which this
 * device has not chosen. Without it nothing is chosen, which is the Loans first run. Only the Loans
 * app's install imports this, behind an inline VITE_FAKE_WORKBOOK comparison.
 */
export async function seedFakeLoans(variant: string | null): Promise<void> {
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const document = emptyLoansDocument(savedAt)
  const text = encodeDocument(document)
  if (variant === 'drive' || variant === 'other-device') {
    const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), LOANS_APP, text)
    if (variant === 'drive') {
      const meta = { id: created.fileId, source: 'drive', title: documentName(LOANS_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null } as const
      await keepChosen({ meta, revision: created.document.revision, document })
    } else {
      saveWorkbookChoice(LOANS_APP, null)
    }
  } else if (variant === 'browser') {
    const meta = {
      id: FAKE_LOANS_ID,
      source: 'browser',
      title: 'Fake Loans file',
      syncedAt: savedAt,
      lastExportedAt: new Date(now - 12 * DAY).toISOString(),
      unexportedSince: new Date(now - 9 * DAY).toISOString(),
    } as const
    await keepChosen({ meta, revision: (await replaceBrowserDocument(FAKE_LOANS_ID, text)).revision, document })
  } else {
    saveWorkbookChoice(LOANS_APP, null)
  }
}

/** Fills the cache with the copy, as a successful read would, and chooses it. */
async function keepChosen(copy: DocumentCopy): Promise<void> {
  const cache = openWorkbookCache(copy.meta.id)
  try {
    await cache.replace(copy)
  } finally {
    cache.close()
  }
  saveWorkbookChoice(LOANS_APP, { source: copy.meta.source, id: copy.meta.id, name: copy.meta.title })
}
