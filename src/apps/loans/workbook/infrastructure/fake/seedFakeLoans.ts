import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession, holdReadsOf } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { keepChosenCopy } from '../../../../../shared/storage/infrastructure/chosenCopy'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { LOANS_APP, emptyLoansDocument } from '../loansDocument'
import { fakeLoansDocument } from './fakeLoans'

/**
 * The id of the Loans file the fake build keeps in this browser, apart from the company's so the two
 * never share a database. It holds the marker `assert-no-fake-bytes` looks for in a production bundle.
 */
const FAKE_LOANS_ID = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP-LOANS'

const DAY = 86_400_000

/**
 * Sets up the fake build's Loans file as `?loans=` names it: `drive` an empty file on the fake Drive
 * and `browser` one kept in this browser with changes nine days past their last export, each chosen
 * on this device, `sample` a chosen file on the fake Drive holding made-up loans of both kinds,
 * `one-loan` the same with the bank loan alone, `house-and-car` the home loan beside a car loan that
 * ends earlier and an informal loan you owe on an expected plan, `equal-principal` one equal principal bank loan alone, `other-device` an empty file on the fake Drive that
 * another device made, which this device has not chosen, `opening` the sample chosen on the fake
 * Drive with nothing in this browser and every read of it held, so the Loans screens stay opening, and
 * `failed` the sample chosen on the fake Drive with nothing in this browser and the file in the bin, so
 * the first read fails.
 * Without it nothing is chosen, which is the Loans first run. Only the Loans app's install imports
 * this, behind an inline VITE_FAKE_WORKBOOK comparison.
 */
export async function seedFakeLoans(variant: string | null): Promise<void> {
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const document =
    variant === 'sample' || variant === 'opening' || variant === 'failed'
      ? fakeLoansDocument(savedAt)
      : variant === 'one-loan' || variant === 'house-and-car' || variant === 'equal-principal'
        ? fakeLoansDocument(savedAt, variant)
        : emptyLoansDocument(savedAt)
  const text = encodeDocument(document)
  if (
    variant === 'drive' ||
    variant === 'sample' ||
    variant === 'one-loan' ||
    variant === 'house-and-car' ||
    variant === 'equal-principal' ||
    variant === 'other-device' ||
    variant === 'opening' ||
    variant === 'failed'
  ) {
    const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), LOANS_APP, text)
    if (variant === 'opening' || variant === 'failed') {
      saveWorkbookChoice(LOANS_APP, { source: 'drive', id: created.fileId, name: documentName(LOANS_APP) })
      if (variant === 'opening') holdReadsOf(created.fileId)
      else await fakeDriveSession().trash(created.fileId)
    } else if (variant !== 'other-device') {
      const meta = { id: created.fileId, source: 'drive', title: documentName(LOANS_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null } as const
      await keepChosenCopy(LOANS_APP, { meta, revision: created.document.revision, document })
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
    await keepChosenCopy(LOANS_APP, { meta, revision: (await replaceBrowserDocument(FAKE_LOANS_ID, text)).revision, document })
  } else {
    saveWorkbookChoice(LOANS_APP, null)
  }
}
