import { SPENDING_APP } from '../spendingDocument'
import { fakeSpendingDocument, fakeStarterDocument } from './fakeSpending'
import type { FakeSpendingSet } from './fakeSpending'
import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../../shared/storage/infrastructure/documentRecordStorage'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession, holdReadsOf } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { openWorkbookCache } from '../../../../../shared/storage/infrastructure/workbookCache'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'

/**
 * The id of the Spending file the fake build keeps in this browser, apart from the other apps' so none share a
 * database. It holds the marker `assert-no-fake-bytes` looks for in a production bundle.
 */
const FAKE_SPENDING_ID = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP-SPENDING'

const DAY = 86_400_000

const SETS: readonly FakeSpendingSet[] = ['sample', 'foreign', 'over']

function isSet(variant: string | null): variant is FakeSpendingSet {
  return (SETS as readonly (string | null)[]).includes(variant)
}

/**
 * Sets up the fake build's Spending file as `?spending=` names it: `drive` a new file with the starter categories on
 * the fake Drive and `browser` one kept in this browser with changes nine days past their last export, each chosen on
 * this device, a set of `fakeSpending.ts` chosen on the fake Drive, `other-device` a new file on the fake Drive that
 * another device made, which this device has not chosen, `opening` the sample chosen on the fake Drive with nothing in
 * this browser and every read of it held, so the Spending screens stay opening, and `failed` the sample chosen on the
 * fake Drive with nothing in this browser and the file in the bin, so the first read fails. Without it nothing is
 * chosen, which is the Spending first run. Only the Spending app's install imports this, behind an inline
 * VITE_FAKE_WORKBOOK comparison.
 */
export async function seedFakeSpending(variant: string | null): Promise<void> {
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const document = isSet(variant) ? fakeSpendingDocument(savedAt, variant) : variant === 'opening' || variant === 'failed' ? fakeSpendingDocument(savedAt) : fakeStarterDocument(savedAt)
  const text = encodeDocument(document)
  if (variant === 'drive' || isSet(variant) || variant === 'other-device' || variant === 'opening' || variant === 'failed') {
    const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), SPENDING_APP, text)
    if (variant === 'opening' || variant === 'failed') {
      saveWorkbookChoice(SPENDING_APP, { source: 'drive', id: created.fileId, name: documentName(SPENDING_APP) })
      if (variant === 'opening') holdReadsOf(created.fileId)
      else await fakeDriveSession().trash(created.fileId)
    } else if (variant !== 'other-device') {
      const meta = { id: created.fileId, source: 'drive', title: documentName(SPENDING_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null } as const
      await keepChosen({ meta, revision: created.document.revision, document })
    } else {
      saveWorkbookChoice(SPENDING_APP, null)
    }
  } else if (variant === 'browser') {
    const meta = {
      id: FAKE_SPENDING_ID,
      source: 'browser',
      title: 'Fake Spending file',
      syncedAt: savedAt,
      lastExportedAt: new Date(now - 12 * DAY).toISOString(),
      unexportedSince: new Date(now - 9 * DAY).toISOString(),
    } as const
    await keepChosen({ meta, revision: (await replaceBrowserDocument(FAKE_SPENDING_ID, text)).revision, document })
  } else {
    saveWorkbookChoice(SPENDING_APP, null)
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
  saveWorkbookChoice(SPENDING_APP, { source: copy.meta.source, id: copy.meta.id, name: copy.meta.title })
}
