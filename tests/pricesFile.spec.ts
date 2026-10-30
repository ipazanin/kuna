import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PricesCache, PricesCopy } from '../src/apps/investments/prices/application/pricesPorts'
import { pricesAge } from '../src/apps/investments/prices/domain/priceBook'
import { decodePricesFile, emptyPricesFile, encodePricesFile, rateSeriesKey, seriesKey } from '../src/apps/investments/prices/domain/pricesFile'
import type { PricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { pricesFileBook, pricesFileRateBook } from '../src/apps/investments/prices/domain/pricesFileBooks'
import { FAKE_SERIES, fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices'
import { openPricesCache } from '../src/apps/investments/prices/infrastructure/pricesCache'
import type { HandPrice } from '../src/apps/investments/workbook/domain/handPrice'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import { PRICE_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { EURO } from '../src/shared/money/currencyCode'
import { decimalText } from '../src/shared/money/decimal'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { BROKER, STOCK_B, USD, WORLD_ETF, book, cashMovement, decimal, instrument, trade, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

/** The worked portfolio's closes and rates as the job would have written them. */
const WORKED_FILE: PricesFile = {
  writtenAt: '2026-10-30T05:41:00.000Z',
  series: {
    [seriesKey('alphavantage', 'WORLD-ETF')]: {
      currency: 'EUR',
      from: '2025-01-02',
      closes: [
        ['2026-10-28', '124.00'],
        ['2026-10-29', '125.00'],
      ],
    },
    [seriesKey('tiingo', 'STOCK-B')]: {
      currency: 'USD',
      from: '2025-03-03',
      closes: [
        ['2026-10-28', '57.50'],
        ['2026-10-29', '58.00'],
      ],
    },
    [rateSeriesKey('USD')]: {
      currency: 'USD',
      from: '2015-01-01',
      closes: [
        ['2025-03-03', '1.05'],
        ['2025-09-15', '1.17'],
        ['2026-02-02', '1.18'],
        ['2026-10-28', '1.115'],
        ['2026-10-29', '1.12'],
      ],
    },
  },
  splits: [{ series: seriesKey('tiingo', 'STOCK-B'), date: '2024-06-10', newUnits: '10', oldUnits: '1' }],
  failures: [{ series: seriesKey('tiingo', 'STOCK-C'), day: '2026-10-30', reason: 'unknown-symbol' }],
}

function handPrice(what: Instrument, date: string, price: string, note = ''): HandPrice {
  return { id: recordIdOf(PRICE_RECORDS, `price-${what.symbol}-${date}`), instrument: what.id, date: civil(date), price: decimal(price), note }
}

function read(text: string): PricesFile {
  const result = decodePricesFile(text)
  if (result.kind !== 'read') {
    throw new Error(`Refused: ${result.reason}`)
  }
  return result.file
}

describe('the prices file', () => {
  it('reads back what it writes, one series a line sorted by key', () => {
    const text = encodePricesFile(WORKED_FILE)
    expect(read(text)).toEqual(WORKED_FILE)
    const lines = text.split('\n')
    expect(lines.slice(0, 4)).toEqual(['{', '  "format": "kuna-prices",', '  "version": 1,', '  "written_at": "2026-10-30T05:41:00.000Z",'])
    expect(lines.filter((line) => line.startsWith('    "')).map((line) => line.slice(5, line.indexOf('":')))).toEqual(['alphavantage:WORLD-ETF', 'ecb:USD', 'tiingo:STOCK-B'])
    expect(text).toContain('{"series":"tiingo:STOCK-B","date":"2024-06-10","new":"10","old":"1"}')
    expect(text).toContain('{"series":"tiingo:STOCK-C","day":"2026-10-30","reason":"unknown-symbol"}')
  })

  it('reads the empty file Kuna makes, before the job has written', () => {
    expect(read(encodePricesFile(emptyPricesFile()))).toEqual({ writtenAt: null, series: {}, splits: [], failures: [] })
  })

  it('refuses text that is no prices file, a newer one and one out of shape', () => {
    const withSeries = (closes: unknown): string =>
      JSON.stringify({ format: 'kuna-prices', version: 1, written_at: null, series: { 'tiingo:ABC': { currency: 'USD', from: '2026-01-02', closes } }, splits: [], failures: [] })
    expect(decodePricesFile('not json')).toEqual({ kind: 'refused', reason: 'not-json' })
    expect(decodePricesFile(JSON.stringify({ format: 'kuna', app: 'investments' }))).toEqual({ kind: 'refused', reason: 'not-prices' })
    expect(decodePricesFile(encodePricesFile(emptyPricesFile()).replace('"version": 1', '"version": 2'))).toEqual({ kind: 'refused', reason: 'newer' })
    expect(decodePricesFile(withSeries([['2026-01-02', '10.5']])).kind).toBe('read')
    expect(decodePricesFile(withSeries([['2026-01-02', 10.5]]))).toEqual({ kind: 'refused', reason: 'not-in-shape' })
    expect(decodePricesFile(withSeries([['2026-02-30', '10.5']]))).toEqual({ kind: 'refused', reason: 'not-in-shape' })
    expect(decodePricesFile(withSeries([['2026-01-02', '1e3']]))).toEqual({ kind: 'refused', reason: 'not-in-shape' })
    expect(
      decodePricesFile(
        withSeries([
          ['2026-01-05', '10.5'],
          ['2026-01-02', '10.4'],
        ]),
      ),
    ).toEqual({ kind: 'refused', reason: 'not-in-shape' })
    expect(
      decodePricesFile(
        withSeries([
          ['2026-01-02', '10.5'],
          ['2026-01-02', '10.4'],
        ]),
      ),
    ).toEqual({ kind: 'refused', reason: 'not-in-shape' })
  })
})

describe("the prices file's books", () => {
  const worldEtf = { ...WORLD_ETF, sourceSymbol: 'WORLD-ETF' }
  const stockB = { ...STOCK_B, sourceSymbol: 'STOCK-B' }

  it('gives the stage 4 figures of the worked portfolio, €3,414.75 of value and +€16.82 on the last day', () => {
    const records = { ...workedPortfolio(), instruments: [worldEtf, stockB] }
    const figures = portfolioFigures({ book: records, prices: pricesFileBook(WORKED_FILE, []), rates: pricesFileRateBook(WORKED_FILE), today: civil('2026-10-29') })
    expect(figures.value).toBe(euros(3414.75))
    expect(figures.totalGain).toBe(euros(414.75))
    expect(figures.lastDay?.change).toBe(euros(16.82))
  })

  it('takes the latest close on or before the day, and none before the first', () => {
    const prices = pricesFileBook(WORKED_FILE, [])
    expect(prices.closeOnOrBefore(stockB, civil('2026-10-31'))).toEqual({ date: civil('2026-10-29'), price: decimal('58'), byHand: false })
    expect(prices.closeOnOrBefore(stockB, civil('2026-10-28'))).toEqual({ date: civil('2026-10-28'), price: decimal('57.5'), byHand: false })
    expect(prices.closeOnOrBefore(stockB, civil('2026-10-27'))).toBeNull()
    expect(prices.closeOnOrBefore(instrument('unlisted'), civil('2026-10-29'))).toBeNull()
  })

  it("lets the job's close win over a hand price on the same day, and a later hand price win over an older close", () => {
    const prices = pricesFileBook(WORKED_FILE, [handPrice(stockB, '2026-10-29', '99'), handPrice(stockB, '2026-10-30', '59.25', 'statement')])
    expect(prices.closeOnOrBefore(stockB, civil('2026-10-29'))).toEqual({ date: civil('2026-10-29'), price: decimal('58'), byHand: false })
    expect(prices.closeOnOrBefore(stockB, civil('2026-10-30'))).toEqual({ date: civil('2026-10-30'), price: decimal('59.25'), byHand: true })
  })

  it('prices a manual instrument by hand alone, in date order whatever the file order', () => {
    const fund = instrument('money-fund', { class: 'money-market', prices: 'manual', sourceSymbol: '' })
    const prices = pricesFileBook(WORKED_FILE, [handPrice(fund, '2026-09-30', '10.1234'), handPrice(fund, '2026-08-31', '10.0987')])
    expect(prices.closeOnOrBefore(fund, civil('2026-09-15'))).toEqual({ date: civil('2026-08-31'), price: decimal('10.0987'), byHand: true })
    expect(prices.closeOnOrBefore(fund, civil('2026-10-29'))?.price).toBe(decimal('10.1234'))
  })

  it("reads the ECB's units per euro on or before the day, and none for a currency it has no series of", () => {
    const rates = pricesFileRateBook(WORKED_FILE)
    expect(decimalText(rates.unitsPerEuroOnOrBefore(USD, civil('2025-12-31'))!)).toBe('1.17')
    expect(rates.unitsPerEuroOnOrBefore(USD, civil('2025-03-02'))).toBeNull()
    expect(rates.unitsPerEuroOnOrBefore(EURO, civil('2026-10-29'))).toBeNull()
  })
})

describe('late prices', () => {
  const fakeBook = (today: string) => {
    const shareA = instrument('share-a', { currency: USD, sourceSymbol: 'ABC' })
    const shareB = instrument('share-b', { currency: USD, sourceSymbol: 'DEF' })
    const etf = instrument('world-etf', { prices: 'alphavantage', sourceSymbol: 'XYZ.DEX' })
    const fund = instrument('money-fund', { class: 'money-market', prices: 'manual', sourceSymbol: '' })
    const records = book({
      accounts: [BROKER],
      instruments: [shareA, shareB, etf, fund],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '10000')],
      trades: [
        trade('buy', BROKER, shareA, '2025-01-03', '5', '150', '1', '1.04'),
        trade('buy', BROKER, shareB, '2025-01-03', '20', '50', '1', '1.04'),
        trade('buy', BROKER, etf, '2025-01-03', '10', '100', '2'),
        trade('buy', BROKER, fund, '2025-01-03', '100', '10', '0'),
      ],
      prices: [handPrice(fund, '2026-08-31', '10.25')],
    })
    return { records, today: civil(today) }
  }

  it('finds the sample current: its newest close is the day before, and only the hand price from August late', () => {
    const { records, today } = fakeBook('2026-10-30')
    const file = fakePricesFile('sample', today)
    const figures = portfolioFigures({ book: records, prices: pricesFileBook(file, records.prices), rates: pricesFileRateBook(file), today })
    expect(
      pricesAge(
        figures.holdings.flatMap((holding) => holding.valuation?.close ?? []),
        today,
      ),
    ).toEqual({ newest: civil('2026-10-29'), late: false })
    expect(figures.holdings.filter((holding) => holding.late).map((holding) => holding.instrument.name)).toEqual(['money-fund'])
    expect(file.failures).toEqual([])
  })

  it('finds the late-prices set late: on Friday 30 Oct its newest close is Monday 26 Oct, and every provider failed', () => {
    const { records, today } = fakeBook('2026-10-30')
    const file = fakePricesFile('late-prices', today)
    const figures = portfolioFigures({ book: records, prices: pricesFileBook(file, records.prices), rates: pricesFileRateBook(file), today })
    expect(
      pricesAge(
        figures.holdings.flatMap((holding) => holding.valuation?.close ?? []),
        today,
      ),
    ).toEqual({ newest: civil('2026-10-26'), late: true })
    expect(figures.holdings.every((holding) => holding.late)).toBe(true)
    expect(figures.unpriced).toEqual([])
    expect(new Set(file.failures.map((failure) => failure.series))).toEqual(new Set([FAKE_SERIES.shareA, FAKE_SERIES.shareB, FAKE_SERIES.worldEtf, 'ecb:USD', 'ecb:GBP', 'ecb:CHF']))
    expect(file.failures.every((failure) => failure.day === today)).toBe(true)
  })

  it('keeps a Friday close current over the weekend and until Wednesday, and late on Thursday', () => {
    const friday = { date: civil('2026-10-30'), price: decimal('1'), byHand: false }
    expect(pricesAge([friday], civil('2026-11-02'))).toEqual({ newest: friday.date, late: false })
    expect(pricesAge([friday], civil('2026-11-04'))).toEqual({ newest: friday.date, late: false })
    expect(pricesAge([friday], civil('2026-11-05'))).toEqual({ newest: friday.date, late: true })
  })

  it('has no age when every close is by hand', () => {
    expect(pricesAge([{ date: civil('2026-01-30'), price: decimal('1'), byHand: true }], civil('2026-10-30'))).toBeNull()
  })

  it('writes the fake sets as files Kuna reads back, with weekday closes only and the split in its closes', () => {
    const file = fakePricesFile('sample', civil('2026-10-30'))
    expect(read(encodePricesFile(file))).toEqual(file)
    const closes = file.series[FAKE_SERIES.shareB]!.closes
    expect(closes.every(([day]) => ![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))).toBe(true)
    const beforeSplit = closes.filter(([day]) => day < '2024-06-10').at(-1)!
    const onSplit = closes.find(([day]) => day === '2024-06-10')!
    expect(Number(beforeSplit[1]) / Number(onSplit[1])).toBeGreaterThan(9)
  })
})

describe('the prices cache', () => {
  const opened: PricesCache[] = []

  function cacheFor(fileId: string): PricesCache {
    const cache = openPricesCache(fileId)
    opened.push(cache)
    return cache
  }

  afterEach(async () => {
    for (const cache of opened.splice(0)) {
      await cache.delete()
    }
  })

  const copy: PricesCopy = { fileId: 'prices-1', revision: 'rev-7', readAt: '2026-10-30T07:02:00.000Z', file: WORKED_FILE }

  it('keeps the copy whole, in its own database, until it is deleted', async () => {
    const cache = cacheFor('prices-1')
    expect(await cache.read()).toBeNull()
    await cache.replace(copy)
    expect(await cache.read()).toEqual(copy)
    expect(await Dexie.getDatabaseNames()).toContain('kuna-prices-prices-1')
    await cache.replace({ ...copy, revision: 'rev-8', file: emptyPricesFile() })
    expect((await cache.read())?.revision).toBe('rev-8')
    await cache.delete()
    expect(await Dexie.getDatabaseNames()).not.toContain('kuna-prices-prices-1')
  })

  it("refuses another file's copy", async () => {
    await expect(cacheFor('prices-2').replace(copy)).rejects.toThrow('Refusing to keep prices file prices-1 in the database for prices-2.')
  })
})
