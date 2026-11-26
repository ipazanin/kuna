// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { openMailReadingCache } from '../src/apps/investments/mail/infrastructure/mailReadingCache'
import { fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices'
import { openPricesCache } from '../src/apps/investments/prices/infrastructure/pricesCache'
import { forgetKeptForEveryFile } from '../src/apps/investments/workbook/infrastructure/keptPerFile'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { removeAppData } from '../src/shared/storage/application/appData'
import type { DataRemovalPorts } from '../src/shared/storage/application/appData'

const READ_AT = '2026-10-06T07:02:00.000Z'

/** Keeps prices and a mail reading for the file in this browser, as a sync of it would. */
async function keepFor(fileId: string): Promise<void> {
  const prices = openPricesCache(fileId)
  await prices.replace({ fileId: `prices-of-${fileId}`, revision: 'r1', readAt: READ_AT, file: fakePricesFile('sample', parseCivilDate('2026-10-06')!) })
  prices.close()
  const mail = openMailReadingCache(fileId)
  await mail.replace({ recipe: 'a recipe', readAt: READ_AT, plan: { window: { from: 1_780_000_000_000, after: 'since' }, query: 'has:attachment', mails: [] } })
  mail.close()
}

async function databasesOf(fileId: string): Promise<string[]> {
  return (await Dexie.getDatabaseNames()).filter((name) => name.endsWith(`-${fileId}`)).sort()
}

const PORTS: DataRemovalPorts = {
  dropFile: async () => true,
  trashBackups: async () => {},
  syncsOver: async () => {},
  syncing: () => false,
  beside: null,
  forgetOnThisDevice: () => {},
  forgetKeptHere: () => forgetKeptForEveryFile(),
}

afterEach(async () => {
  await forgetKeptForEveryFile()
})

describe('what this browser keeps for an Investments file beside its books', () => {
  it('goes with a removal of the file, and so does what an earlier file left', async () => {
    await keepFor('file-1')
    await keepFor('file-2')
    expect(await databasesOf('file-1')).toEqual(['kuna-ibkr-mail-file-1', 'kuna-prices-file-1'])

    const report = await removeAppData(PORTS, { source: 'drive', id: 'file-1', name: 'kuna-investments.json' }, ['browser-copy'])

    expect(report.steps.map(({ step, outcome }) => [step, outcome.kind])).toEqual([
      ['browser-copy', 'done'],
      ['kept-here', 'done'],
    ])
    expect(await databasesOf('file-1')).toEqual([])
    expect(await databasesOf('file-2')).toEqual([])
  })
})
