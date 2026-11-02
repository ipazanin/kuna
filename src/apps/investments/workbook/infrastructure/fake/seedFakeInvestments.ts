import Dexie from 'dexie'

import { encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession, holdReadsOf } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { openWorkbookCache } from '../../../../../shared/storage/infrastructure/workbookCache'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { INVESTMENTS_APP, emptyInvestmentsDocument } from '../investmentsDocument'
import { fakeInvestmentsDocument } from './fakeInvestments'
import { pricesDay } from '../../../prices/application/pricesUpdate'
import { PRICES_FILE_NAME, encodePricesFile } from '../../../prices/domain/pricesFile'
import { fakePricesFile } from '../../../prices/infrastructure/fake/fakePrices'
import type { FakePricesVariant } from '../../../prices/infrastructure/fake/fakePrices'
import { PRICES_DATABASE_PREFIX, openPricesCache } from '../../../prices/infrastructure/pricesCache'
import { encodeKeysFile, keysFileName } from '../../../prices/domain/keysFile'
import { fakeKeys, isFakeKeysVariant } from '../../../prices/infrastructure/fake/fakeKeys'
import { APP_DATA_FOLDER } from '../../../../../shared/google/driveClient'
import { AUTO_SYNC_INTERVAL_MS } from '../../../../../shared/sync/application/autoSync'

/**
 * Sets up the fake build's Investments file as `?investments=` names it, each on the fake Drive: `drive` an empty
 * file chosen on this device, `sample` a chosen file holding the made-up portfolio, `cash-below-zero` the sample
 * without the deposit of its second account, `young` a portfolio seven months old with no benchmark, and `opening`
 * the sample chosen with nothing in this browser and every read of it held, so the Investments screens stay opening.
 * Without it nothing is chosen, which is the Investments first run. The sample has the fake prices file beside it, in
 * this browser too, as `?prices=late-prices` or `?prices=no-benchmark` names it or else `sample`, and the empty file
 * has it only when `?prices=` names it, so a first import finds its rates. `?keys=other-browser` or `?keys=removed` puts the keys
 * file another browser left in the app's hidden folder for the chosen file, and marks it read longer ago than a sync on open
 * waits, so the open syncs and takes it. Only the Investments app's install imports this, behind an inline VITE_FAKE_WORKBOOK
 * comparison.
 */
export async function seedFakeInvestments(variant: string | null, pricesVariant: string | null, keysVariant: string | null): Promise<void> {
  await forgetFakePrices()
  if (variant !== 'drive' && variant !== 'sample' && variant !== 'cash-below-zero' && variant !== 'young' && variant !== 'opening') {
    saveWorkbookChoice(INVESTMENTS_APP, null)
    return
  }
  const savedAt = new Date().toISOString()
  const document = variant === 'drive' ? emptyInvestmentsDocument(savedAt) : fakeInvestmentsDocument(savedAt, variant === 'opening' ? 'sample' : variant)
  const folder = await fakeBooksFolder()
  const created = await createDriveDocument(fakeDriveSession(), folder, INVESTMENTS_APP, encodeDocument(document))
  const choice = { source: 'drive', id: created.fileId, name: documentName(INVESTMENTS_APP) } as const
  if (variant !== 'drive' || pricesVariant !== null) {
    await seedFakePrices(folder, created.fileId, pricesVariant === 'late-prices' || pricesVariant === 'no-benchmark' ? pricesVariant : 'sample', savedAt)
  }
  const keysSeeded = isFakeKeysVariant(keysVariant)
  if (keysSeeded) {
    await fakeDriveSession().createFile(APP_DATA_FOLDER, keysFileName(created.fileId), encodeKeysFile(fakeKeys(keysVariant)))
  }
  if (variant === 'opening') {
    saveWorkbookChoice(INVESTMENTS_APP, choice)
    holdReadsOf(created.fileId)
    return
  }
  const cache = openWorkbookCache(created.fileId)
  try {
    await cache.replace({
      meta: {
        id: created.fileId,
        source: 'drive',
        title: choice.name,
        syncedAt: keysSeeded ? new Date(Date.parse(savedAt) - AUTO_SYNC_INTERVAL_MS - 60_000).toISOString() : savedAt,
        lastExportedAt: null,
        unexportedSince: null,
      },
      revision: created.document.revision,
      document,
    })
  } finally {
    cache.close()
  }
  saveWorkbookChoice(INVESTMENTS_APP, choice)
}

/** Each load starts a new fake Drive whose ids repeat, so no copy of an earlier load's prices may stay to name another file. */
async function forgetFakePrices(): Promise<void> {
  const names = await Dexie.getDatabaseNames()
  await Promise.all(names.filter((name) => name.startsWith(PRICES_DATABASE_PREFIX)).map((name) => Dexie.delete(name)))
}

/** The fake prices file beside the sample, and the same revision in this browser, so a sync finds it unchanged. */
async function seedFakePrices(folder: string, investmentsFileId: string, variant: FakePricesVariant, savedAt: string): Promise<void> {
  // Written as the page opens, so a failure that may clear on its own waits its while before the page asks again.
  const file = { ...fakePricesFile(variant, pricesDay(savedAt)), writtenAt: savedAt }
  const created = await fakeDriveSession().createFile(folder, PRICES_FILE_NAME, encodePricesFile(file))
  const cache = openPricesCache(investmentsFileId)
  try {
    await cache.replace({ fileId: created.id, revision: created.revision, readAt: savedAt, file })
  } finally {
    cache.close()
  }
}
