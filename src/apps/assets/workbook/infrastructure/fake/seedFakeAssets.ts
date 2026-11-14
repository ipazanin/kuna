import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession, holdReadsOf } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { keepChosenCopy } from '../../../../../shared/storage/infrastructure/chosenCopy'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { ASSETS_APP, emptyAssetsDocument } from '../assetsDocument'
import { fakeAssetsDocument } from './fakeAssets'
import type { FakeAssetsSet } from './fakeAssets'

/**
 * The id of the Assets file the fake build keeps in this browser, apart from the other apps' so none share a
 * database. It holds the marker `assert-no-fake-bytes` looks for in a production bundle.
 */
const FAKE_ASSETS_ID = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP-ASSETS'

const DAY = 86_400_000

const SETS: readonly FakeAssetsSet[] = ['sample', 'house-and-car', 'loan-gone']

function isSet(variant: string | null): variant is FakeAssetsSet {
  return (SETS as readonly (string | null)[]).includes(variant)
}

/**
 * Sets up the fake build's Assets file as `?assets=` names it: `drive` an empty file on the fake Drive and `browser`
 * one kept in this browser with changes nine days past their last export, each chosen on this device, a set of
 * `fakeAssets.ts` chosen on the fake Drive, `other-device` an empty file on the fake Drive that another device made,
 * which this device has not chosen, `opening` the sample chosen on the fake Drive with nothing in this browser and
 * every read of it held, so the Assets screens stay opening, and `failed` the sample chosen on the fake Drive with
 * nothing in this browser and the file in the bin, so the first read fails. Without it nothing is chosen, which is the
 * Assets first run. Only the Assets app's install imports this, behind an inline VITE_FAKE_WORKBOOK comparison.
 */
export async function seedFakeAssets(variant: string | null): Promise<void> {
  const now = Date.now()
  const savedAt = new Date(now).toISOString()
  const document = isSet(variant) ? fakeAssetsDocument(savedAt, variant) : variant === 'opening' || variant === 'failed' ? fakeAssetsDocument(savedAt) : emptyAssetsDocument(savedAt)
  const text = encodeDocument(document)
  if (variant === 'drive' || isSet(variant) || variant === 'other-device' || variant === 'opening' || variant === 'failed') {
    const created = await createDriveDocument(fakeDriveSession(), await fakeBooksFolder(), ASSETS_APP, text)
    if (variant === 'opening' || variant === 'failed') {
      saveWorkbookChoice(ASSETS_APP, { source: 'drive', id: created.fileId, name: documentName(ASSETS_APP) })
      if (variant === 'opening') holdReadsOf(created.fileId)
      else await fakeDriveSession().trash(created.fileId)
    } else if (variant !== 'other-device') {
      const meta = { id: created.fileId, source: 'drive', title: documentName(ASSETS_APP), syncedAt: savedAt, lastExportedAt: null, unexportedSince: null } as const
      await keepChosenCopy(ASSETS_APP, { meta, revision: created.document.revision, document })
    } else {
      saveWorkbookChoice(ASSETS_APP, null)
    }
  } else if (variant === 'browser') {
    const meta = {
      id: FAKE_ASSETS_ID,
      source: 'browser',
      title: 'Fake Assets file',
      syncedAt: savedAt,
      lastExportedAt: new Date(now - 12 * DAY).toISOString(),
      unexportedSince: new Date(now - 9 * DAY).toISOString(),
    } as const
    await keepChosenCopy(ASSETS_APP, { meta, revision: (await replaceBrowserDocument(FAKE_ASSETS_ID, text)).revision, document })
  } else {
    saveWorkbookChoice(ASSETS_APP, null)
  }
}
