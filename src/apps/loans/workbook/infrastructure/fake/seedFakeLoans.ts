import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession, holdReadsOf } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { keepChosenCopy } from '../../../../../shared/storage/infrastructure/chosenCopy'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { LOANS_APP } from '../../domain/loansApp'
import { emptyLoansDocument } from '../loansDocument'
import { fakeLoansDocument, fakeTwinNamedLoansDocument } from './fakeLoans'
import type { FakeLoansSet } from './fakeLoans'

/**
 * The id of the Loans file the fake build keeps in this browser, apart from the company's so the two
 * never share a database. It holds the marker `assert-no-fake-bytes` looks for in a production bundle.
 */
const FAKE_LOANS_ID = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP-LOANS'

const DAY = 86_400_000

const SETS: readonly FakeLoansSet[] = ['sample', 'one-loan', 'house-and-car', 'equal-principal', 'lending', 'co-owned', 'four-loans']

function isSet(variant: string | null): variant is FakeLoansSet {
  return (SETS as readonly (string | null)[]).includes(variant)
}

/**
 * Sets up the fake build's Loans file as `?loans=` names it: `drive` an empty file on the fake Drive
 * and `browser` one kept in this browser with changes nine days past their last export, each chosen
 * on this device, a set of `fakeLoans.ts` chosen on the fake Drive, `twin-names` `house-and-car` with the car loan
 * named as the home loan, `other-device` an empty file on the fake Drive that
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
    variant === 'opening' || variant === 'failed'
      ? fakeLoansDocument(savedAt)
      : isSet(variant)
        ? fakeLoansDocument(savedAt, variant)
        : variant === 'twin-names'
          ? fakeTwinNamedLoansDocument(savedAt)
          : emptyLoansDocument(savedAt)
  const text = encodeDocument(document)
  if (variant === 'drive' || isSet(variant) || variant === 'twin-names' || variant === 'other-device' || variant === 'opening' || variant === 'failed') {
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
