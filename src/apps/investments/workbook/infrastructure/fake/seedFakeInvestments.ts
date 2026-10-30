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
import { PRICES_DATABASE_PREFIX, openPricesCache } from '../../../prices/infrastructure/pricesCache'

/**
 * Sets up the fake build's Investments file as `?investments=` names it, each on the fake Drive: `drive` an empty
 * file chosen on this device, `sample` a chosen file holding the made-up portfolio, and `opening` the sample chosen
 * with nothing in this browser and every read of it held, so the Investments screens stay opening. Without it nothing
 * is chosen, which is the Investments first run. The sample has the fake prices file beside it, in this browser too,
 * as `?prices=late-prices` names it or else `sample`. Only the Investments app's install imports this, behind an
 * inline VITE_FAKE_WORKBOOK comparison.
 */
export async function seedFakeInvestments(variant: string | null, pricesVariant: string | null): Promise<void> {
  await forgetFakePrices()
  if (variant !== 'drive' && variant !== 'sample' && variant !== 'opening') {
    saveWorkbookChoice(INVESTMENTS_APP, null)
    return
  }
  const savedAt = new Date().toISOString()
  const document = variant === 'drive' ? emptyInvestmentsDocument(savedAt) : fakeInvestmentsDocument(savedAt)
  const folder = await fakeBooksFolder()
  const created = await createDriveDocument(fakeDriveSession(), folder, INVESTMENTS_APP, encodeDocument(document))
  const choice = { source: 'drive', id: created.fileId, name: documentName(INVESTMENTS_APP) } as const
  if (variant !== 'drive') {
    await seedFakePrices(folder, created.fileId, pricesVariant === 'late-prices' ? 'late-prices' : 'sample', savedAt)
  }
  if (variant === 'opening') {
    saveWorkbookChoice(INVESTMENTS_APP, choice)
    holdReadsOf(created.fileId)
    return
  }
  const cache = openWorkbookCache(created.fileId)
  try {
    await cache.replace({
      meta: { id: created.fileId, source: 'drive', title: choice.name, syncedAt: savedAt, lastExportedAt: null, unexportedSince: null },
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
async function seedFakePrices(folder: string, investmentsFileId: string, variant: 'sample' | 'late-prices', savedAt: string): Promise<void> {
  const file = fakePricesFile(variant, pricesDay(savedAt))
  const created = await fakeDriveSession().createFile(folder, PRICES_FILE_NAME, encodePricesFile(file))
  const cache = openPricesCache(investmentsFileId)
  try {
    await cache.replace({ fileId: created.id, revision: created.revision, readAt: savedAt, file })
  } finally {
    cache.close()
  }
}
