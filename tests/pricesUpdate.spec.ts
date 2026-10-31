import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { createPricesUpdate, pricesFetchVerdict, pricesFileBeside } from '../src/apps/investments/prices/application/pricesUpdate'
import type { PricesFetchMoment, PricesUpdate } from '../src/apps/investments/prices/application/pricesUpdate'
import type { PricesCache, PricesDrive, PricesPlace } from '../src/apps/investments/prices/application/pricesPorts'
import type { PriceVendor, VendorCloses } from '../src/apps/investments/prices/application/priceVendor'
import { PRICES_FILE_NAME, decodePricesFile, emptyPricesFile, encodePricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import type { PricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices'
import { pricesDriveOn } from '../src/apps/investments/prices/infrastructure/fake/fakePricesDrive'
import { openPricesCache } from '../src/apps/investments/prices/infrastructure/pricesCache'
import { runProblem } from '../src/apps/investments/prices/presentation/runProblem'
import { pricesStep } from '../src/apps/investments/prices/presentation/pricesStep'
import { words } from '../src/apps/investments/prices/presentation/words'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { FOLDER_MIME_TYPE } from '../src/shared/google/driveClient'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import { createSync } from '../src/shared/sync/application/sync'
import type { StepState } from '../src/shared/sync/application/syncRun'
import { BROKER, USD, book, cashMovement, instrument, trade } from './fixtures/investments'
import { civil } from './fixtures/ledger'

/** Friday 30 Oct 2026 at 08:00 in Zagreb. */
const NOW = '2026-10-30T07:00:00.000Z'
const TODAY = civil('2026-10-30')

const SHARE = instrument('abc', { currency: USD })

/** Made-up records: one US share bought in 2025, so the prices need Twelve Data and the ECB. */
function investments(): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [SHARE],
    cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '5000')],
    trades: [trade('buy', BROKER, SHARE, '2025-03-03', '10', '50', '1', '1.05')],
  })
}

/** A vendor of made-up closes that answers one close a series, the day before, and waits while `gate` holds it. */
function madeUpVendor(id: string, prices: PriceVendor['prices'], needsKey: boolean, world: { asked: string[]; gate: Promise<void> | null }): PriceVendor {
  return {
    id,
    name: id,
    covers: '',
    prices,
    needsKey,
    keyAddress: needsKey ? 'https://example.com/key' : null,
    limits: { perMinute: null, perDay: null, gapMilliseconds: null },
    testSymbol: 'TEST',
    async closes(_fetch, _key, symbol): Promise<VendorCloses> {
      world.asked.push(`${id}:${symbol}`)
      if (world.gate !== null) await world.gate
      return { kind: 'closes', closes: [['2026-10-29', '10.00']], splits: [], earlierFailure: null }
    },
  }
}

interface World {
  readonly drive: FakeDrive
  readonly folderId: string
  readonly investmentsFileId: string
  readonly cache: PricesCache
  readonly update: PricesUpdate
  /** The series each vendor was asked for, in order. */
  readonly asked: string[]
  /** Holds every vendor answer until the returned function lets them go. */
  hold(): () => void
  keys: Record<string, string>
  /** Another tab holds the fetch lock. */
  locked: boolean
  /** The fake Drive turns the next writes of the prices file away. */
  overwriteFails: boolean
}

const caches: PricesCache[] = []
let worlds = 0

afterEach(async () => {
  for (const cache of caches.splice(0)) {
    await cache.delete()
  }
})

/** One browser with the Investments file on a fake Drive, or kept in this browser, and its copy of the prices. */
async function worldOf(options: { readonly onDrive?: boolean; readonly records?: InvestmentBook | null } = {}): Promise<World> {
  const drive = createFakeDrive()
  const folderId = await drive.createFolder('root', 'Books')
  const investmentsFileId = (await drive.createFile(folderId, 'kuna-investments.json', '{}')).id
  worlds += 1
  const cache = openPricesCache(`spec-${worlds}`)
  caches.push(cache)
  const vendorWorld = { asked: [] as string[], gate: null as Promise<void> | null }
  const base = pricesDriveOn(drive)
  const failing: PricesDrive = {
    ...base,
    overwrite: async (fileId, text) => {
      if (self.overwriteFails) throw new Error('403 from the fake Drive')
      return base.overwrite(fileId, text)
    },
  }
  const place: PricesPlace = { investmentsFileId, cache, drive: options.onDrive === false ? null : failing }
  const self: World = {
    drive,
    folderId,
    investmentsFileId,
    cache,
    asked: vendorWorld.asked,
    keys: { twelvedata: 'made-up-key-for-a-spec' },
    locked: false,
    overwriteFails: false,
    hold() {
      let release = (): void => {}
      vendorWorld.gate = new Promise((resolve) => {
        release = resolve
      })
      return () => {
        vendorWorld.gate = null
        release()
      }
    },
    update: createPricesUpdate({
      place: async () => place,
      investments: () => (options.records === undefined ? investments() : options.records),
      vendors: [madeUpVendor('twelvedata', 'listings', true, vendorWorld), madeUpVendor('ecb', 'rates', false, vendorWorld)],
      fetch: async () => ({ status: 200, text: '' }),
      pause: async () => {},
      key: (vendorId) => self.keys[vendorId] ?? null,
      exclusively: async (run) => (self.locked ? 'busy' : run()),
      now: () => NOW,
      newRevision: () => `browser-${worlds}`,
    }),
  }
  return self
}

/** The prices file on the fake Drive beside the Investments file, as a fetch on that day wrote it. */
async function pricesOnDrive(world: World, file: PricesFile): Promise<string> {
  return (await world.drive.createFile(world.folderId, PRICES_FILE_NAME, encodePricesFile(file))).id
}

function readText(text: string): PricesFile {
  const read = decodePricesFile(text)
  if (read.kind !== 'read') throw new Error(read.reason)
  return read.file
}

/** Lets a fetch the step started without waiting for it run to its end. */
async function backgroundSettled(world: World): Promise<void> {
  for (let round = 0; round < 50; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2))
    if (world.update.state.fetching === null) return
  }
}

describe('the prices file beside the Investments file', () => {
  it('makes an empty prices file in the folder of the Investments file the first time, and finds that one after', async () => {
    const world = await worldOf()
    const drive = pricesDriveOn(world.drive)

    const made = await pricesFileBeside(drive, world.investmentsFileId)
    expect(world.drive.file(made)).toMatchObject({ name: 'kuna-investments-prices.json', parents: [world.folderId] })
    expect(readText(await world.drive.download(made))).toEqual(emptyPricesFile())

    world.drive.requests.length = 0
    expect(await pricesFileBeside(drive, world.investmentsFileId)).toBe(made)
    expect(world.drive.requests).not.toContain('createFile')
  })

  it('takes only a file of its own folder, never a folder of that name or a prices file in another folder', async () => {
    const world = await worldOf()
    await world.drive.createFolder(world.folderId, PRICES_FILE_NAME)
    const elsewhere = await world.drive.createFolder('root', 'Elsewhere')
    const stranger = (await world.drive.createFile(elsewhere, PRICES_FILE_NAME, encodePricesFile(emptyPricesFile()))).id

    const found = await pricesFileBeside(pricesDriveOn(world.drive), world.investmentsFileId)
    expect(found).not.toBe(stranger)
    expect(world.drive.file(found)).toMatchObject({ parents: [world.folderId], mimeType: 'application/json' })
    expect(world.drive.file(found).mimeType).not.toBe(FOLDER_MIME_TYPE)
  })

  it('takes the same one of two that two devices made at the same moment', async () => {
    const world = await worldOf()
    const first = await pricesOnDrive(world, emptyPricesFile())
    const second = await pricesOnDrive(world, emptyPricesFile())
    expect(await pricesFileBeside(pricesDriveOn(world.drive), world.investmentsFileId)).toBe([first, second].sort()[0])
  })

  it('leaves two devices that make the file at the same moment on the same one', async () => {
    const world = await worldOf()
    const [deviceA, deviceB] = await Promise.all([pricesFileBeside(pricesDriveOn(world.drive), world.investmentsFileId), pricesFileBeside(pricesDriveOn(world.drive), world.investmentsFileId)])
    expect(deviceA).toBe(deviceB)
    expect(await pricesDriveOn(world.drive).filesNamed(world.folderId, PRICES_FILE_NAME)).toContain(deviceA)
  })
})

describe('the Prices step of a sync', () => {
  /** A sync of the Investments group alone: its books read as they are, then the Prices step. */
  function syncOf(world: World) {
    return createSync({
      groups: () => [
        {
          app: 'investments',
          name: 'Investments',
          books: { id: 'books', label: 'Books', scopes: () => ['drive.file'], startLine: '', on: () => true, run: async () => ({ kind: 'done', line: '', writeId: null, link: null }) },
          steps: () => [pricesStep(world.update)],
          whenIdle: async () => {},
        },
      ],
      granted: () => true,
      askForAccess: async () => {},
      asksByLeaving: () => false,
      now: () => NOW,
    })
  }

  function stepState(sync: ReturnType<typeof syncOf>): StepState | undefined {
    return sync.state.run?.groups[0]?.steps.find((step) => step.id === 'prices')?.state
  }

  it('reads the prices file into the copy on the first sync, and on the next downloads nothing while its head revision is unchanged', async () => {
    const world = await worldOf()
    const file = fakePricesFile('sample', TODAY)
    const fileId = await pricesOnDrive(world, file)
    const sync = syncOf(world)

    await sync.sync()
    await backgroundSettled(world)
    expect(stepState(sync)).toEqual({ kind: 'done', line: words.step.read, writeId: null, link: null })
    expect(world.update.state.copy).toMatchObject({ fileId, revision: world.drive.file(fileId).headRevisionId, file })
    expect(await world.cache.read()).toEqual(world.update.state.copy)

    world.drive.requests.length = 0
    await sync.sync()
    await backgroundSettled(world)
    expect(stepState(sync)).toEqual({ kind: 'done', line: words.step.unchanged, writeId: null, link: null })
    expect(world.drive.requests).toEqual(['headRevision'])
    expect(world.asked).toEqual([])
  })

  it('reads the file again once another device wrote it', async () => {
    const world = await worldOf()
    world.keys = {}
    const fileId = await pricesOnDrive(world, fakePricesFile('late-prices', civil('2026-10-29')))
    const sync = syncOf(world)
    await sync.sync()
    await backgroundSettled(world)

    const newer = fakePricesFile('sample', TODAY)
    await world.drive.upload(fileId, encodePricesFile(newer))
    world.drive.requests.length = 0
    await sync.sync()
    await backgroundSettled(world)

    expect(world.drive.requests).toEqual(['headRevision', 'download'])
    expect(world.update.state.copy?.file).toEqual(newer)
    expect(stepState(sync)).toMatchObject({ kind: 'done', line: words.step.read })
  })

  it('makes the prices file on the first sync of an Investments file without one, which the ECB fetch then fills without a key', async () => {
    const world = await worldOf()
    world.keys = {}
    const sync = syncOf(world)
    await sync.sync()
    await backgroundSettled(world)

    const made = world.update.state.copy?.fileId
    expect(made).toBeDefined()
    expect(world.drive.file(made!)).toMatchObject({ name: PRICES_FILE_NAME, parents: [world.folderId] })
    expect(Object.keys(world.update.state.copy?.file.series ?? {})).toEqual(['ecb:USD', 'ecb:GBP', 'ecb:CHF'])
  })

  it('fails the step and keeps the copy when a newer Kuna wrote the file, which it leaves as it is', async () => {
    const world = await worldOf()
    const fileId = await pricesOnDrive(world, fakePricesFile('sample', TODAY))
    const sync = syncOf(world)
    await sync.sync()
    const kept = world.update.state.copy

    const newer = encodePricesFile(emptyPricesFile()).replace('"version": 1', '"version": 2')
    await world.drive.upload(fileId, newer)
    await sync.sync()
    await backgroundSettled(world)

    expect(stepState(sync)).toEqual({ kind: 'failed', line: words.refused.newer, link: { label: words.step.settings, to: '/investments/settings' } })
    expect(world.update.state.copy).toEqual(kept)
    expect(await world.drive.download(fileId)).toBe(newer)
  })
})

describe('when the day comes to fetch', () => {
  const twelveData = { id: 'twelvedata', needsKey: true }
  const ecb = { id: 'ecb', needsKey: false }

  function moment(overrides: Partial<PricesFetchMoment>): PricesFetchMoment {
    return { writtenAt: '2026-10-29T05:41:00.000Z', today: TODAY, needed: [twelveData, ecb], hasKey: (vendorId) => vendorId === 'twelvedata', keyless: [], running: false, ...overrides }
  }

  it('fetches when the prices file was written yesterday, or never', () => {
    expect(pricesFetchVerdict(moment({}))).toBe('due')
    expect(pricesFetchVerdict(moment({ writtenAt: null }))).toBe('due')
  })

  it('waits for tomorrow once a fetch wrote the file today in Zagreb, after midnight there even when it was still yesterday in UTC', () => {
    expect(pricesFetchVerdict(moment({ writtenAt: '2026-10-30T05:41:00.000Z' }))).toBe('fetched-today')
    expect(pricesFetchVerdict(moment({ writtenAt: '2026-10-29T23:30:00.000Z' }))).toBe('fetched-today')
    expect(pricesFetchVerdict(moment({ writtenAt: '2026-10-29T22:30:00.000Z' }))).toBe('due')
  })

  it('fetches the ECB without any key when a keyed vendor is needed too, and leaves the fetch to another browser only when no vendor needed can run', () => {
    expect(pricesFetchVerdict(moment({ hasKey: () => false }))).toBe('due')
    expect(pricesFetchVerdict(moment({ needed: [twelveData], hasKey: () => false }))).toBe('no-key')
  })

  it('fetches again today when the fetch that wrote the file had no key that this browser holds', () => {
    const today = { writtenAt: '2026-10-30T05:41:00.000Z', keyless: ['twelvedata'] }
    expect(pricesFetchVerdict(moment(today))).toBe('due')
    expect(pricesFetchVerdict(moment({ ...today, hasKey: () => false }))).toBe('fetched-today')
  })

  it('fetches without any key when the records need only the ECB', () => {
    expect(pricesFetchVerdict(moment({ needed: [ecb], hasKey: () => false }))).toBe('due')
  })

  it('starts no second fetch while one runs', () => {
    expect(pricesFetchVerdict(moment({ running: true }))).toBe('running')
    expect(pricesFetchVerdict(moment({ running: true, writtenAt: '2026-10-30T05:41:00.000Z' }))).toBe('running')
  })
})

describe("the day's fetch", () => {
  it('writes the prices file on Drive and the copy on the first open of the day, and asks nothing more that day', async () => {
    const world = await worldOf()
    const fileId = await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    await world.update.read()
    const before = world.drive.file(fileId).headRevisionId

    expect(await world.update.fetchIfDue()).toBe('due')
    expect(world.asked).toEqual(['twelvedata:ABC', 'ecb:USD', 'ecb:GBP', 'ecb:CHF'])
    const written = readText(await world.drive.download(fileId))
    expect(written.writtenAt).toBe(NOW)
    expect(world.drive.file(fileId).headRevisionId).not.toBe(before)
    expect(world.update.state.copy).toMatchObject({ fileId, revision: world.drive.file(fileId).headRevisionId, file: written })
    expect(world.update.state.lastRun).toEqual({ kind: 'written', file: written })

    world.asked.length = 0
    expect(await world.update.fetchIfDue()).toBe('fetched-today')
    expect(world.asked).toEqual([])
  })

  it('fetches nothing when another browser wrote the prices file today while this one waited its turn', async () => {
    const world = await worldOf()
    const fileId = await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    await world.update.read()
    await world.drive.upload(fileId, encodePricesFile({ ...fakePricesFile('sample', civil('2026-10-29')), writtenAt: NOW }))
    const before = world.drive.file(fileId).headRevisionId

    expect(await world.update.fetchIfDue()).toBe('due')
    expect(world.asked).toEqual([])
    expect(world.drive.file(fileId).headRevisionId).toBe(before)
    expect(world.update.state.lastRun).toBeNull()
  })

  it('keeps a failed fetch in the last run, in words the screens can show, and says nothing of a fetch another tab runs', async () => {
    const world = await worldOf()
    await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    world.overwriteFails = true
    await world.update.fetchNow()
    expect(runProblem(world.update.state.lastRun)).not.toBeNull()

    world.locked = true
    await world.update.fetchNow()
    expect(world.update.state.lastRun).toEqual({ kind: 'busy' })
    expect(runProblem(world.update.state.lastRun)).toBeNull()
  })

  it('fetches the ECB alone in a browser without the key the records need, noting the keyed vendor as no-key', async () => {
    const world = await worldOf()
    world.keys = {}
    await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    expect(await world.update.fetchIfDue()).toBe('due')
    expect(world.asked).toEqual(['ecb:USD', 'ecb:GBP', 'ecb:CHF'])
    expect(world.update.state.copy?.file.failures).toEqual([{ series: 'twelvedata:ABC', day: TODAY, reason: 'no-key' }])
  })

  it('fetches the rates an import wants alone, beside those the records need, and leaves the day due', async () => {
    const world = await worldOf()
    const fileId = await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    await world.update.read()
    const before = readText(await world.drive.download(fileId))

    const run = await world.update.fetchRates({ currencies: ['SEK'], from: '2014-06-02' })
    expect(run).toMatchObject({ kind: 'written' })
    expect(world.asked).toEqual(['ecb:USD', 'ecb:GBP', 'ecb:CHF', 'ecb:SEK'])
    const written = readText(await world.drive.download(fileId))
    expect(written.writtenAt).toBe(before.writtenAt)
    expect(written.series['ecb:SEK']?.from).toBe('2014-06-02')
    expect(world.update.state.copy?.file).toEqual(written)
    expect(await world.update.fetchIfDue()).toBe('due')
  })

  it('waits for a fetch under way before it fetches the rates an import wants', async () => {
    const world = await worldOf()
    await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    const release = world.hold()
    const daily = world.update.fetchNow()
    const rates = world.update.fetchRates({ currencies: ['SEK'], from: '2020-01-02' })
    release()
    await daily
    expect(await rates).toMatchObject({ kind: 'written' })
    expect(world.asked).toEqual(['twelvedata:ABC', 'ecb:USD', 'ecb:GBP', 'ecb:CHF', 'ecb:USD', 'ecb:GBP', 'ecb:CHF', 'ecb:SEK'])
  })

  it('runs one fetch at a time in a page, counting the series as it asks for each', async () => {
    const world = await worldOf()
    await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    const release = world.hold()

    const first = world.update.fetchIfDue()
    for (let round = 0; round < 50 && world.asked.length === 0; round += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2))
    }
    expect(world.update.state.fetching).toEqual({ asked: 1, of: 4 })
    expect(await world.update.fetchIfDue()).toBe('running')
    expect(await world.update.fetchNow()).toBe('running')

    release()
    expect(await first).toBe('due')
    expect(world.update.state.fetching).toBeNull()
    expect(world.asked).toEqual(['twelvedata:ABC', 'ecb:USD', 'ecb:GBP', 'ecb:CHF'])
  })

  it('leaves the fetch to the tab of this browser that holds the lock, writing nothing', async () => {
    const world = await worldOf()
    const fileId = await pricesOnDrive(world, fakePricesFile('sample', civil('2026-10-29')))
    const head = world.drive.file(fileId).headRevisionId
    world.locked = true

    expect(await world.update.fetchNow()).toEqual({ kind: 'busy' })
    expect(world.update.state.lastRun).toEqual({ kind: 'busy' })
    expect(world.asked).toEqual([])
    expect(world.drive.file(fileId).headRevisionId).toBe(head)
  })

  it('fetches now whatever the day, and keeps the prices of an Investments file kept in this browser in its copy alone', async () => {
    const world = await worldOf({ onDrive: false })
    await world.cache.replace({ fileId: null, revision: 'browser-0', readAt: NOW, file: fakePricesFile('sample', TODAY) })
    await world.update.open()
    world.drive.requests.length = 0

    expect(await world.update.fetchIfDue()).toBe('fetched-today')
    const run = await world.update.fetchNow()
    expect(run).toMatchObject({ kind: 'written' })
    expect(world.drive.requests).toEqual([])
    expect(await world.cache.read()).toMatchObject({ fileId: null, revision: `browser-${worlds}` })
    expect(world.update.state.copy?.file.writtenAt).toBe(NOW)
    expect(world.update.state.copy?.file.series['twelvedata:ABC']?.closes.at(-1)).toEqual(['2026-10-29', '10.00'])
  })

  it('names the Investments file only once the copy of this browser is read, also when there is none', async () => {
    const world = await worldOf({ onDrive: false })
    const opening = world.update.open()

    expect(world.update.state.investmentsFileId).toBeNull()
    await opening
    expect(world.update.state.investmentsFileId).toBe(world.investmentsFileId)
    expect(world.update.state.copy).toBeNull()
  })

  it('fetches nothing before the Investments records are read', async () => {
    const world = await worldOf({ records: null })
    expect(await world.update.fetchIfDue()).toBe('no-books')
    expect(await world.update.fetchNow()).toBe('no-books')
  })
})
