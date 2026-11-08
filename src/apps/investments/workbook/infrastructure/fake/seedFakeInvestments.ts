import Dexie from 'dexie'

import { replaceBrowserDocument } from '../../../../../shared/storage/infrastructure/browserDocument'
import { encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { createDriveDocument, documentName } from '../../../../../shared/storage/infrastructure/driveDocument'
import { fakeBooksFolder, fakeDriveSession, holdReadsOf } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'
import { openWorkbookCache } from '../../../../../shared/storage/infrastructure/workbookCache'
import { saveWorkbookChoice } from '../../../../../shared/storage/infrastructure/workbookChoice'
import { INVESTMENTS_APP, emptyInvestmentsDocument } from '../investmentsDocument'
import { fakeInvestmentsDocument } from './fakeInvestments'
import { LOCAL_INVESTMENTS_TITLE } from '../../domain/investmentsBooks'
import { pricesDay } from '../../../prices/application/pricesUpdate'
import { PRICES_FILE_NAME, encodePricesFile } from '../../../prices/domain/pricesFile'
import { fakePricesFile } from '../../../prices/infrastructure/fake/fakePrices'
import type { FakePricesVariant } from '../../../prices/infrastructure/fake/fakePrices'
import { PRICES_DATABASE_PREFIX, openPricesCache } from '../../../prices/infrastructure/pricesCache'
import { forgetSetUpAnswer, keepSetUpAnswer } from '../../../../../shared/app/setUpAnswer'
import { HISTORY_COMPLETE } from '../../../tax/domain/historyAnswer'
import { seedFakeSecrets } from '../../../../../shared/secrets/infrastructure/fake/seedFakeSecrets'
import { AUTO_SYNC_INTERVAL_MS } from '../../../../../shared/sync/application/autoSync'

/**
 * Sets up the fake build's Investments file as `?investments=` names it, each on the fake Drive but `browser`: `drive`
 * an empty file chosen on this device, `sample` a chosen file holding the made-up portfolio, `cash-below-zero` the
 * sample without the deposit of its second account, `young` a portfolio seven months old with no benchmark, `partial-history`
 * the sample with nobody having said its history is complete, as the others have, `opening`
 * the sample chosen with nothing in this browser and every read of it held, so the Investments screens stay opening,
 * `binned` the sample as another device left it, moved to the bin with its prices file after this browser last read it,
 * `mail` the sample with IBKR's report by mail switched on, `sale-2023` the sample with a sale of 2023 whose city is not chosen yet, and `browser` the sample kept in this browser with its prices. Without it nothing is chosen, which is the Investments
 * first run. The sample has the fake prices file beside it, in this browser too, as `?prices=late-prices` or
 * `?prices=no-benchmark` names it or else `sample`, and the empty file has it only when `?prices=` names it, so a first
 * import finds its rates. `?keys=` puts what another browser left in the app's hidden folder, as `seedFakeSecrets`
 * says, the old keys file named after the chosen file. `given` is the sample as a file someone shared, which Drive will not bin. With it, and for `binned`, the copy here is marked read longer ago than a sync on
 * open waits, so the open syncs. Only the Investments app's install imports this, behind an inline VITE_FAKE_WORKBOOK
 * comparison.
 */
export async function seedFakeInvestments(variant: string | null, pricesVariant: string | null, keysVariant: string | null): Promise<void> {
  await forgetFakePrices()
  if (variant === 'browser') {
    await seedInBrowser(pricesVariant)
    return
  }
  if (
    variant !== 'drive' &&
    variant !== 'sample' &&
    variant !== 'mail' &&
    variant !== 'sale-2023' &&
    variant !== 'cash-below-zero' &&
    variant !== 'young' &&
    variant !== 'partial-history' &&
    variant !== 'opening' &&
    variant !== 'binned' &&
    variant !== 'given'
  ) {
    saveWorkbookChoice(INVESTMENTS_APP, null)
    return
  }
  const savedAt = new Date().toISOString()
  const document =
    variant === 'drive'
      ? emptyInvestmentsDocument(savedAt)
      : fakeInvestmentsDocument(savedAt, variant === 'opening' || variant === 'binned' || variant === 'given' || variant === 'partial-history' ? 'sample' : variant)
  const folder = await fakeBooksFolder()
  const created = await createDriveDocument(fakeDriveSession(), folder, INVESTMENTS_APP, encodeDocument(document))
  const choice = { source: 'drive', id: created.fileId, name: documentName(INVESTMENTS_APP) } as const
  if (variant === 'partial-history') forgetSetUpAnswer(created.fileId, HISTORY_COMPLETE)
  else keepSetUpAnswer(created.fileId, HISTORY_COMPLETE)
  const pricesFileId = variant !== 'drive' || pricesVariant !== null ? await seedFakePrices(folder, created.fileId, pricesVariantOf(pricesVariant), savedAt) : null
  const keysSeeded = await seedFakeSecrets(keysVariant, created.fileId)
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
        syncedAt: keysSeeded || variant === 'binned' ? new Date(Date.parse(savedAt) - AUTO_SYNC_INTERVAL_MS - 60_000).toISOString() : savedAt,
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
  if (variant === 'given') {
    fakeDriveSession().file(created.fileId).ownedByMe = false
  }
  if (variant === 'binned') {
    await fakeDriveSession().trash(created.fileId)
    if (pricesFileId !== null) await fakeDriveSession().trash(pricesFileId)
  }
}

function pricesVariantOf(pricesVariant: string | null): FakePricesVariant {
  return pricesVariant === 'late-prices' || pricesVariant === 'no-benchmark' ? pricesVariant : 'sample'
}

/** The id the fake build keeps its browser-kept Investments file under. */
const FAKE_LOCAL_INVESTMENTS_ID = 'local-fake-investments'

/** The sample kept in this browser and chosen, with the fake prices as this browser keeps them for a file with no prices file on Drive. */
async function seedInBrowser(pricesVariant: string | null): Promise<void> {
  keepSetUpAnswer(FAKE_LOCAL_INVESTMENTS_ID, HISTORY_COMPLETE)
  const savedAt = new Date().toISOString()
  const document = fakeInvestmentsDocument(savedAt, 'sample')
  const stored = await replaceBrowserDocument(FAKE_LOCAL_INVESTMENTS_ID, encodeDocument(document))
  const cache = openWorkbookCache(FAKE_LOCAL_INVESTMENTS_ID)
  try {
    await cache.replace({
      meta: { id: FAKE_LOCAL_INVESTMENTS_ID, source: 'browser', title: LOCAL_INVESTMENTS_TITLE, syncedAt: savedAt, lastExportedAt: null, unexportedSince: null },
      revision: stored.revision,
      document,
    })
  } finally {
    cache.close()
  }
  const file = { ...fakePricesFile(pricesVariantOf(pricesVariant), pricesDay(savedAt)), writtenAt: savedAt }
  const prices = openPricesCache(FAKE_LOCAL_INVESTMENTS_ID)
  try {
    await prices.replace({ fileId: null, revision: 'browser-fake', readAt: savedAt, file })
  } finally {
    prices.close()
  }
  saveWorkbookChoice(INVESTMENTS_APP, { source: 'browser', id: FAKE_LOCAL_INVESTMENTS_ID, name: LOCAL_INVESTMENTS_TITLE })
}

/** Each load starts a new fake Drive whose ids repeat, so no copy of an earlier load's prices may stay to name another file. */
async function forgetFakePrices(): Promise<void> {
  const names = await Dexie.getDatabaseNames()
  await Promise.all(names.filter((name) => name.startsWith(PRICES_DATABASE_PREFIX)).map((name) => Dexie.delete(name)))
}

/** The fake prices file beside the sample, and the same revision in this browser, so a sync finds it unchanged. Gives the file's id. */
async function seedFakePrices(folder: string, investmentsFileId: string, variant: FakePricesVariant, savedAt: string): Promise<string> {
  // Written as the page opens, so a failure that may clear on its own waits its while before the page asks again.
  const file = { ...fakePricesFile(variant, pricesDay(savedAt)), writtenAt: savedAt }
  const created = await fakeDriveSession().createFile(folder, PRICES_FILE_NAME, encodePricesFile(file))
  const cache = openPricesCache(investmentsFileId)
  try {
    await cache.replace({ fileId: created.id, revision: created.revision, readAt: savedAt, file })
  } finally {
    cache.close()
  }
  return created.id
}
