import { describe, expect, it } from 'vitest'

import type { EcbAnswer, RatesUpdatePorts } from '../src/shared/rates/application/ratesPorts'
import { updateRates } from '../src/shared/rates/application/ratesUpdate'
import { holdsRatesFor, mergedDemand } from '../src/shared/rates/domain/ratesDemand'
import { decodeRatesFile, emptyRatesFile, encodeRatesFile } from '../src/shared/rates/domain/ratesFile'
import type { RatesFile } from '../src/shared/rates/domain/ratesFile'
import { everydayBook } from '../src/shared/rates/domain/rateBooks'
import { ratesDriveOn } from '../src/shared/rates/infrastructure/fake/fakeRatesDrive'
import { memoryRatesCache } from '../src/shared/rates/infrastructure/fake/fakeRatesState'
import { APP_PROPERTY, KUNA_FOLDER_MARK } from '../src/shared/storage/domain/driveMarks'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import { currencyCodeOf, EURO } from '../src/shared/money/currencyCode'
import type { CurrencyCode } from '../src/shared/money/currencyCode'
import { decimalOfText } from '../src/shared/money/decimal'
import { eurosAtRate } from '../src/shared/money/rateBook'
import type { DatedRate } from '../src/shared/money/rateBook'
import { civil, euros } from './fixtures/ledger'

const USD = currencyCodeOf('USD')!
const GBP = currencyCodeOf('GBP')!

/** A made-up ECB that answers each currency's rows on or after the day asked, and records each ask. */
function world(rates: Partial<Record<string, readonly DatedRate[]>>, day = '2026-11-10') {
  const asked: string[] = []
  const cache = memoryRatesCache()
  const ports: RatesUpdatePorts = {
    cache,
    async ecbRates(currency: CurrencyCode, from): Promise<EcbAnswer> {
      asked.push(`${currency} from ${from}`)
      const rows = rates[currency]
      return rows === undefined ? { kind: 'failed' } : { kind: 'rates', rates: rows.filter(([rowDay]) => rowDay >= from) }
    },
    today: () => civil(day),
    now: () => `${day}T08:00:00.000Z`,
  }
  return { asked, cache, ports }
}

const USD_ROWS: readonly DatedRate[] = [
  ['2026-08-24', '1.1600'],
  ['2026-09-01', '1.1500'],
  ['2026-11-06', '1.1165'],
  ['2026-11-09', '1.1180'],
]

describe('updating the rates', () => {
  it('asks the ECB for a history from a week before the day needed, and keeps it in this browser', async () => {
    const { asked, cache, ports } = world({ USD: USD_ROWS })

    const update = await updateRates(ports, new Map([[USD, civil('2026-09-01')]]), null)

    expect(asked).toEqual(['USD from 2026-08-25'])
    expect(update).toMatchObject({ failed: [], drive: 'none' })
    expect((await cache.read())?.ecb.USD).toEqual({ from: '2026-09-01', checked: '2026-11-10', rows: USD_ROWS.slice(1) })
  })

  it('asks nothing again the same day, and from the last rate on a later one', async () => {
    const first = world({ USD: USD_ROWS })
    await updateRates(first.ports, new Map([[USD, civil('2026-09-01')]]), null)
    await updateRates(first.ports, new Map([[USD, civil('2026-09-01')]]), null)
    const later = { ...first.ports, today: () => civil('2026-11-12') }
    await updateRates(later, new Map([[USD, civil('2026-09-01')]]), null)

    expect(first.asked).toEqual(['USD from 2026-08-25', 'USD from 2026-11-09'])
  })

  it('lists a currency whose fetch failed and keeps the rates of the others', async () => {
    const { ports } = world({ USD: USD_ROWS })

    const update = await updateRates(
      ports,
      new Map([
        [USD, civil('2026-09-01')],
        [GBP, civil('2026-09-01')],
      ]),
      null,
    )

    expect(update.failed).toEqual([GBP])
    expect(everydayBook(update.file).newestDay(USD)).toBe('2026-11-09')
  })
})

describe('the rates file on Drive', () => {
  async function driveWithAppFile() {
    const drive = createFakeDrive()
    const books = await drive.createFolder('root', 'Books')
    const appFile = (await drive.createFile(books, 'kuna-spending.json', '{}')).id
    return { drive, books, appFile }
  }

  it('is made in the Kuna folder, marked so any device finds it', async () => {
    const { drive, appFile } = await driveWithAppFile()
    const kuna = await drive.createFolder('root', 'Kuna', { [APP_PROPERTY]: KUNA_FOLDER_MARK })
    const { ports } = world({ USD: USD_ROWS })

    const update = await updateRates(ports, new Map([[USD, civil('2026-09-01')]]), { drive: ratesDriveOn(drive), besideFileId: appFile })

    const [made] = await drive.findOwnedByAppProperty(APP_PROPERTY, 'rates')
    expect(update.drive).toBe('sent')
    expect(drive.file(made!).parents).toEqual([kuna])
    expect(drive.file(made!).name).toBe('kuna-rates.json')
  })

  it('is made beside the app file while there is no Kuna folder, and not at all while it would hold nothing', async () => {
    const { drive, books, appFile } = await driveWithAppFile()
    const { ports } = world({})

    expect((await updateRates(ports, new Map(), { drive: ratesDriveOn(drive), besideFileId: appFile })).drive).toBe('unchanged')
    expect(await drive.findOwnedByAppProperty(APP_PROPERTY, 'rates')).toEqual([])

    await updateRates(world({ USD: USD_ROWS }).ports, new Map([[USD, civil('2026-09-01')]]), { drive: ratesDriveOn(drive), besideFileId: appFile })
    const [made] = await drive.findOwnedByAppProperty(APP_PROPERTY, 'rates')
    expect(drive.file(made!).parents).toEqual([books])
  })

  it('brings another device’s rates into this browser without asking the ECB, and leaves the file alone', async () => {
    const { drive, books, appFile } = await driveWithAppFile()
    const other: RatesFile = { ...emptyRatesFile(), writtenAt: '2026-11-10T07:00:00.000Z', ecb: { USD: { from: '2026-09-01', checked: '2026-11-10', rows: USD_ROWS.slice(1) } } }
    await drive.createFile(books, 'kuna-rates.json', encodeRatesFile(other), { [APP_PROPERTY]: 'rates' })
    const { asked, cache, ports } = world({ USD: USD_ROWS })

    const update = await updateRates(ports, new Map([[USD, civil('2026-09-01')]]), { drive: ratesDriveOn(drive), besideFileId: appFile })

    expect(asked).toEqual([])
    expect(update.drive).toBe('unchanged')
    expect((await cache.read())?.ecb.USD?.rows).toEqual(USD_ROWS.slice(1))
  })

  it('keeps a rate this browser fetched and one the file holds, and writes both', async () => {
    const { drive, books, appFile } = await driveWithAppFile()
    const other: RatesFile = { ...emptyRatesFile(), ecb: { GBP: { from: '2026-09-01', checked: '2026-11-10', rows: [['2026-11-09', '0.8700']] } } }
    const fileId = (await drive.createFile(books, 'kuna-rates.json', encodeRatesFile(other), { [APP_PROPERTY]: 'rates' })).id
    const { ports } = world({ USD: USD_ROWS })
    await updateRates(ports, new Map([[USD, civil('2026-09-01')]]), null)

    const update = await updateRates(ports, new Map([[USD, civil('2026-09-01')]]), { drive: ratesDriveOn(drive), besideFileId: appFile })

    const written = decodeRatesFile(await drive.download(fileId))
    expect(update.drive).toBe('sent')
    expect(written.kind === 'read' ? Object.keys(written.file.ecb).sort() : null).toEqual(['GBP', 'USD'])
  })

  it('leaves a file it cannot read as it is, and keeps the rates in this browser', async () => {
    const { drive, books, appFile } = await driveWithAppFile()
    const newer = encodeRatesFile(emptyRatesFile()).replace('"version": 1', '"version": 9')
    const fileId = (await drive.createFile(books, 'kuna-rates.json', newer, { [APP_PROPERTY]: 'rates' })).id
    const { cache, ports } = world({ USD: USD_ROWS })

    const update = await updateRates(ports, new Map([[USD, civil('2026-09-01')]]), { drive: ratesDriveOn(drive), besideFileId: appFile })

    expect(update.drive).toEqual({ refused: 'newer' })
    expect(await drive.download(fileId)).toBe(newer)
    expect((await cache.read())?.ecb.USD).toBeDefined()
  })
})

describe('what the apps need', () => {
  it('takes each currency from the earliest day any app needs it, and needs no rate for the euro', () => {
    expect(
      mergedDemand([
        new Map([
          [USD, civil('2026-09-01')],
          [EURO, civil('2020-01-01')],
        ]),
        null,
        new Map([[USD, civil('2025-01-01')]]),
      ]),
    ).toEqual(new Map([[USD, civil('2025-01-01')]]))
  })

  it('is held once the file has the series from early enough', () => {
    const file: RatesFile = { ...emptyRatesFile(), ecb: { USD: { from: '2026-09-01', checked: '2026-11-10', rows: [] } } }

    expect(holdsRatesFor(file, new Map([[USD, civil('2026-10-01')]]))).toBe(true)
    expect(holdsRatesFor(file, new Map([[USD, civil('2026-08-01')]]))).toBe(false)
  })
})

describe('the everyday book', () => {
  it.each([
    ['0.8', '8.00', 10],
    ['1.1165', '1000.00', 895.66],
  ])('reads a rate of %s units per euro, so %s units are €%s', (rate, amount, expected) => {
    const file: RatesFile = { ...emptyRatesFile(), ecb: { GBP: { from: '2026-11-01', checked: '2026-11-06', rows: [['2026-11-06', rate]] } } }

    expect(eurosAtRate(decimalOfText(amount)!, GBP, civil('2026-11-06'), everydayBook(file))).toEqual(euros(expected))
  })
})
