import { beforeAll, describe, expect, it } from 'vitest'

import { fetchPrices } from '../src/apps/investments/prices/application/priceFetch'
import type { PriceFetchOutcome } from '../src/apps/investments/prices/application/priceFetch'
import type { PriceFetchPorts } from '../src/apps/investments/prices/application/pricesPorts'
import type { PriceVendor, VendorAnswer } from '../src/apps/investments/prices/application/priceVendor'
import { decodePricesFile, ECB_SOURCE, emptyPricesFile, encodePricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import type { PricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { pricesFileRateBook } from '../src/apps/investments/prices/domain/pricesFileBooks'
import { fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'
import { twelveData } from '../src/apps/investments/prices/infrastructure/vendors/twelveData'
import { PRICE_SOURCES } from '../src/apps/investments/workbook/domain/instrument'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { addDays, weekdaysBetween } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { EURO, currencyCodeOf } from '../src/shared/money/currencyCode'
import { USD, account, book, cashMovement, decimal, exchange, instrument, spinOff, trade } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const BROKER = account('broker', 'Broker')
const SHARE_A = instrument('abc', { currency: USD })
const WORLD_ETF = instrument('xyz', { prices: 'alphavantage', sourceSymbol: 'XYZ.DEX' })
const INDEX_FUND = instrument('idx', { currency: USD })
const MONEY_FUND = instrument('fund', { class: 'money-market', prices: 'manual', sourceSymbol: '' })

/** Made-up records: a US share, a Xetra ETF, a benchmark with no trades and a fund priced by hand. */
function investments(extra: Partial<InvestmentBook> = {}): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [SHARE_A, WORLD_ETF, INDEX_FUND, MONEY_FUND, ...(extra.instruments ?? [])],
    cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '5000'), ...(extra.cashMovements ?? [])],
    exchanges: [exchange(BROKER, '2025-03-03', '1000', EURO, '1050', USD), ...(extra.exchanges ?? [])],
    trades: [
      trade('buy', BROKER, WORLD_ETF, '2025-01-03', '10', '100', '2'),
      trade('buy', BROKER, SHARE_A, '2025-03-03', '20', '50', '1', '1.05'),
      trade('buy', BROKER, MONEY_FUND, '2025-03-04', '100', '10', '0'),
      ...(extra.trades ?? []),
    ],
    income: extra.income ?? [],
    spinOffs: extra.spinOffs ?? [],
  })
}

const KEYS: Readonly<Record<string, string>> = { twelvedata: 'td-key-made-up', alphavantage: 'av-key-made-up' }

const weekdaysThrough = new Map<string, readonly CivilDate[]>()

/** The weekdays from the start of 1995 to the day, both included. */
function weekdays(through: string): readonly CivilDate[] {
  let days = weekdaysThrough.get(through)
  if (days === undefined) {
    const found: CivilDate[] = []
    for (let day = civil('1995-01-02'); day <= through; day = addDays(day, 1)) {
      if (weekdaysBetween(day, day) === 1) {
        found.push(day)
      }
    }
    days = found
    weekdaysThrough.set(through, days)
  }
  return days
}

/** Made-up closes in cents, one per weekday through the day. */
function madeUpCloses(base: number, through: string): readonly (readonly [string, string])[] {
  return weekdays(through).map((day, place) => [day, `${base + (place % 50)}.${String(place % 100).padStart(2, '0')}`] as const)
}

interface World {
  /** Overrides the made-up answer of a request whose address holds the text. */
  readonly failing: ReadonlyMap<string, VendorAnswer | 'no-answer'>
  /** A day whose closes and rates every vendor sends corrected, unlike on the fetch before. */
  readonly revisedDay: string | null
}

/** The close a vendor sends on its revised day. */
const REVISED = '77.77'

function json(status: number, body: unknown): VendorAnswer {
  return { status, text: JSON.stringify(body) }
}

/** Twelve Data's base close of each made-up symbol it knows. */
function twelveDataBase(symbol: string): number | undefined {
  return { ABC: 50, IDX: 400, NEW: 20 }[symbol] ?? (/^S\d+$/.test(symbol) ? 30 : undefined)
}

/** Answers like the three vendors' from made-up history through `day`, whose own close is still moving. */
function vendorAnswer(url: string, day: string, world: World): VendorAnswer {
  const query = new URL(url).searchParams
  const revised = (rows: readonly (readonly [string, string])[]): readonly (readonly [string, string])[] => rows.map(([date, close]) => [date, date === world.revisedDay ? REVISED : close] as const)
  if (url.startsWith('https://api.twelvedata.com/time_series?')) {
    if (query.get('apikey') !== KEYS.twelvedata) {
      return json(401, { code: 401, message: '**apikey** parameter is incorrect or not specified.', status: 'error' })
    }
    expect([query.get('interval'), query.get('order'), query.get('adjust'), query.get('outputsize')]).toEqual(['1day', 'asc', 'none', '5000'])
    const base = twelveDataBase(query.get('symbol')!)
    if (base === undefined) {
      return json(404, { code: 404, message: '**symbol** not found.', status: 'error' })
    }
    const through = query.get('end_date') ?? day
    const rows = revised(madeUpCloses(base, day))
      .filter(([date]) => date >= query.get('start_date')! && date <= through)
      .slice(-5000)
    if (rows.length === 0) {
      return json(400, { code: 400, message: 'No data is available on the specified dates. Try setting different start/end dates.', status: 'error' })
    }
    const values = rows.map(([date, close]) => ({ datetime: date, open: close, high: close, low: close, close: `${close}000`, volume: '1000' }))
    return json(200, { meta: { symbol: query.get('symbol'), interval: '1day', currency: 'USD' }, values, status: 'ok' })
  }
  if (url.startsWith('https://www.alphavantage.co/query?')) {
    if (query.get('apikey') !== KEYS.alphavantage) {
      return json(200, { 'Error Message': 'the parameter apikey is invalid or missing.' })
    }
    const closes = revised(madeUpCloses(100, day))
    const asText = (rows: readonly (readonly [string, string])[]): Record<string, Record<string, string>> =>
      Object.fromEntries(rows.map(([date, close]) => [date, { '1. open': close, '2. high': close, '3. low': close, '4. close': `${close}00`, '5. volume': '1000' }]))
    if (query.get('function') === 'TIME_SERIES_DAILY') {
      expect(query.get('outputsize')).toBe('compact')
      return json(200, { 'Meta Data': { '2. Symbol': query.get('symbol') }, 'Time Series (Daily)': asText(closes.slice(-100)) })
    }
    const monthEnds = closes.filter(([date], place) => closes[place + 1] === undefined || closes[place + 1]![0].slice(0, 7) !== date.slice(0, 7))
    return json(200, { 'Meta Data': { '2. Symbol': query.get('symbol') }, 'Monthly Time Series': asText(monthEnds) })
  }
  if (url.startsWith('https://data-api.ecb.europa.eu/service/data/EXR/D.')) {
    const currency = url.split('/EXR/D.')[1]!.split('.EUR.')[0]!
    const rate = ({ USD: 1, GBP: 0, CHF: 0, SEK: 11, NOK: 11, HRK: 7 } as Record<string, number>)[currency]
    if (rate === undefined) {
      return json(404, { title: 'Not Found', status: 404, detail: 'No Series was returned for the query.' })
    }
    /** The ECB stopped the kuna's rates when Croatia took the euro. */
    const last = currency === 'HRK' ? '2022-12-30' : day
    const rows = weekdays(day)
      .map((date, place) => [date, `${rate}.${String(1000 + (place % 300))}`] as const)
      .filter(([date]) => date >= query.get('startPeriod')! && date <= last)
    if (rows.length === 0) {
      return { status: 200, text: '' }
    }
    const lines = revised(rows).map(([date, value]) => `EXR.D.${currency}.EUR.SP00.A,D,${currency},EUR,SP00,A,${date},${value}`)
    return { status: 200, text: ['KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE', ...lines].join('\r\n') }
  }
  throw new Error('No made-up answer for this address')
}

interface Device {
  readonly ports: PriceFetchPorts
  /** Each request's address and each pause, in the order the fetch made them. */
  readonly events: string[]
  readonly writes: string[]
  records: InvestmentBook
  pricesText: string
  run(day: string, world?: Partial<World>, vendors?: readonly PriceVendor[]): Promise<PriceFetchOutcome>
  prices(): PricesFile
  asked(host: string): URLSearchParams[]
}

/** One browser with its keys, the Investments records it holds, the prices file on Drive and the vendors, all made up. */
function device(keys: Readonly<Record<string, string>> = KEYS, records: InvestmentBook = investments()): Device {
  let today = ''
  let world: World = { failing: new Map(), revisedDay: null }
  const events: string[] = []
  const writes: string[] = []
  const self: Device = {
    events,
    writes,
    records,
    pricesText: encodePricesFile(emptyPricesFile()),
    ports: {
      async fetch(url) {
        events.push(url)
        const failure = [...world.failing].find(([part]) => url.includes(part))?.[1]
        if (failure === 'no-answer') {
          throw new TypeError('Failed to fetch')
        }
        return failure ?? vendorAnswer(url, today, world)
      },
      async pause(milliseconds) {
        events.push(`pause ${milliseconds}`)
      },
      key: (vendorId) => keys[vendorId] ?? null,
      investments: () => self.records,
      readPrices: async () => self.pricesText,
      async writePrices(text) {
        writes.push(text)
        self.pricesText = text
      },
    },
    async run(day, overrides = {}, vendors = PRICE_VENDORS) {
      today = day
      world = { failing: new Map(), revisedDay: null, ...overrides }
      events.length = 0
      return fetchPrices(self.ports, vendors, { at: `${day}T07:41:00.000Z`, day })
    },
    prices() {
      const read = decodePricesFile(self.pricesText)
      if (read.kind !== 'read') {
        throw new Error(read.reason)
      }
      return read.file
    },
    asked(host) {
      return events.filter((event) => event.includes(host)).map((event) => new URL(event).searchParams)
    },
  }
  return self
}

function closesOf(file: PricesFile, key: string): readonly (readonly [string, string])[] {
  return file.series[key]?.closes ?? []
}

function ecbAsked(it: Device): string[] {
  return it.events.filter((event) => event.includes('data-api.ecb')).map((event) => event.split('/EXR/')[1]!.split('&')[0]!)
}

describe('fetching prices for the first time', () => {
  const browser = device()
  let outcome: PriceFetchOutcome
  let file: PricesFile
  beforeAll(async () => {
    outcome = await browser.run('2026-10-30')
    file = browser.prices()
  })

  it('fetches each US listing from Twelve Data from its first trade, and the benchmark with no trades from the first deposit', () => {
    expect(file.series['twelvedata:ABC']).toMatchObject({ currency: 'USD', from: '2025-03-03' })
    expect(closesOf(file, 'twelvedata:ABC')[0]![0]).toBe('2025-03-03')
    expect(file.series['twelvedata:IDX']).toMatchObject({ currency: 'USD', from: '2025-01-02' })
    expect(closesOf(file, 'twelvedata:IDX')[0]![0]).toBe('2025-01-02')
    expect(browser.asked('twelvedata').map((query) => [query.get('symbol'), query.get('start_date')])).toEqual([
      ['ABC', '2025-03-03'],
      ['IDX', '2025-01-02'],
    ])
  })

  it("leaves out today's close, which may still move, and keeps each close as the vendor sent it", () => {
    expect(closesOf(file, 'twelvedata:ABC').at(-1)![0]).toBe('2026-10-29')
    expect(closesOf(file, 'alphavantage:XYZ.DEX').at(-1)![0]).toBe('2026-10-29')
    expect(closesOf(file, 'ecb:USD').at(-1)![0]).toBe('2026-10-29')
    expect(closesOf(file, 'twelvedata:ABC').at(-1)![1]).toMatch(/^\d+\.\d{5}$/)
    expect(closesOf(file, 'alphavantage:XYZ.DEX').at(-1)![1]).toMatch(/^\d+\.\d{4}$/)
  })

  it('fetches a European listing from Alpha Vantage as its daily closes and the month ends before them', () => {
    const closes = closesOf(file, 'alphavantage:XYZ.DEX')
    expect(file.series['alphavantage:XYZ.DEX']).toMatchObject({ currency: 'EUR', from: '2025-01-03' })
    const daily = closes.slice(-99)
    expect(weekdaysBetween(civil(daily[0]![0]), civil('2026-10-29'))).toBe(99)
    const monthly = closes.slice(0, -99)
    // The month end before the first trade day stays, so the days up to the first daily close have a close.
    expect(monthly[0]![0]).toBe('2024-12-31')
    expect(new Set(monthly.map(([day]) => day.slice(0, 7))).size).toBe(monthly.length)
    expect(browser.asked('alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY', 'TIME_SERIES_MONTHLY'])
  })

  it('has the ECB rates of USD, GBP and CHF from 2015, one request per currency and no key', () => {
    expect(pricesFileRateBook(file).unitsPerEuroOnOrBefore(USD, civil('2025-03-03'))).not.toBeNull()
    expect(['ecb:USD', 'ecb:GBP', 'ecb:CHF'].map((key) => file.series[key]!.from)).toEqual(['2015-01-01', '2015-01-01', '2015-01-01'])
    expect(closesOf(file, 'ecb:GBP')[0]![0]).toBe('2015-01-01')
    expect(ecbAsked(browser)).toEqual(['D.USD.EUR.SP00.A?startPeriod=2015-01-01', 'D.GBP.EUR.SP00.A?startPeriod=2015-01-01', 'D.CHF.EUR.SP00.A?startPeriod=2015-01-01'])
    expect(browser.events.filter((event) => event.includes('data-api.ecb')).some((event) => event.includes('key'))).toBe(false)
  })

  it('asks nothing for a fund priced by hand, and writes the prices file once with no failures', () => {
    expect(Object.keys(file.series).some((key) => key.includes('FUND'))).toBe(false)
    expect(browser.events).toHaveLength(8)
    expect(browser.writes).toHaveLength(1)
    expect(outcome).toEqual({ kind: 'written', file })
    expect(file.writtenAt).toBe('2026-10-30T07:41:00.000Z')
    expect(file.failures).toEqual([])
  })

  it('never writes a key into the prices file', () => {
    for (const written of browser.writes) {
      expect(written).not.toContain(KEYS.twelvedata)
      expect(written).not.toContain(KEYS.alphavantage)
      expect(written).not.toMatch(/apikey|key-made-up/)
    }
  })
})

describe('fetching prices again', () => {
  it('asks only from the last close and adds the new day to what it kept', async () => {
    const browser = device()
    await browser.run('2026-10-30')
    const before = browser.prices()
    await browser.run('2026-11-02')
    const after = browser.prices()
    expect(browser.asked('twelvedata').map((query) => query.get('start_date'))).toEqual(['2026-10-29', '2026-10-29'])
    expect(browser.asked('alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY'])
    expect(browser.asked('data-api.ecb').map((query) => query.get('startPeriod'))).toEqual(['2026-10-29', '2026-10-29', '2026-10-29'])
    expect(closesOf(after, 'twelvedata:ABC')).toEqual([...closesOf(before, 'twelvedata:ABC'), closesOf(after, 'twelvedata:ABC').at(-1)])
    expect(closesOf(after, 'twelvedata:ABC').at(-1)![0]).toBe('2026-10-30')
    expect(closesOf(after, 'alphavantage:XYZ.DEX').slice(0, closesOf(before, 'alphavantage:XYZ.DEX').length)).toEqual(closesOf(before, 'alphavantage:XYZ.DEX'))
    expect(after.series['ecb:USD']!.from).toBe('2015-01-01')
  })

  it('keeps the earlier closes of every vendor that failed and notes each failure', async () => {
    const browser = device()
    await browser.run('2026-10-30')
    const before = browser.prices()
    const failing = new Map<string, VendorAnswer | 'no-answer'>([
      ['symbol=ABC', { status: 500, text: 'Internal Server Error' }],
      ['symbol=IDX', json(429, { code: 429, message: 'You have run out of API credits for the current minute.', status: 'error' })],
      ['alphavantage', json(200, { Information: 'You have reached the 25 requests a day limit.' })],
      ['data-api.ecb.europa.eu', 'no-answer'],
    ])
    await browser.run('2026-11-02', { failing })
    const after = browser.prices()
    expect(after.series).toEqual(before.series)
    expect(after.writtenAt).toBe('2026-11-02T07:41:00.000Z')
    expect(after.failures).toEqual([
      { series: 'twelvedata:ABC', day: '2026-11-02', reason: 'refused' },
      { series: 'twelvedata:IDX', day: '2026-11-02', reason: 'limit' },
      { series: 'alphavantage:XYZ.DEX', day: '2026-11-02', reason: 'limit' },
      { series: 'ecb:USD', day: '2026-11-02', reason: 'no-answer' },
      { series: 'ecb:GBP', day: '2026-11-02', reason: 'no-answer' },
      { series: 'ecb:CHF', day: '2026-11-02', reason: 'no-answer' },
    ])
  })

  it('clears the failures once the vendors answer again', async () => {
    const browser = device()
    await browser.run('2026-10-30', { failing: new Map([['symbol=ABC', { status: 500, text: '' }]]) })
    expect(browser.prices().failures).toHaveLength(1)
    expect(browser.prices().series['twelvedata:ABC']).toBeUndefined()
    await browser.run('2026-11-02')
    expect(browser.prices().failures).toEqual([])
    expect(browser.prices().series['twelvedata:ABC']!.from).toBe('2025-03-03')
  })

  it('takes a corrected close or rate the vendors send for a day the file already has', async () => {
    const browser = device()
    await browser.run('2026-10-30')
    await browser.run('2026-11-02', { revisedDay: '2026-10-29' })
    const onRevisedDay = (key: string): readonly (readonly [string, string])[] => closesOf(browser.prices(), key).filter(([day]) => day === '2026-10-29')
    expect(onRevisedDay('twelvedata:ABC')).toEqual([['2026-10-29', `${REVISED}000`]])
    expect(onRevisedDay('alphavantage:XYZ.DEX')).toEqual([['2026-10-29', `${REVISED}00`]])
    expect(onRevisedDay('ecb:USD')).toEqual([['2026-10-29', REVISED]])
  })

  it('fetches the history again when a record older than a series start arrives', async () => {
    const browser = device()
    await browser.run('2026-10-30')
    browser.records = investments({ trades: [trade('buy', BROKER, SHARE_A, '2024-11-04', '5', '45', '1', '1.08')] })
    await browser.run('2026-11-02')
    expect(browser.asked('symbol=ABC').map((query) => query.get('start_date'))).toEqual(['2024-11-04'])
    expect(browser.prices().series['twelvedata:ABC']!.from).toBe('2024-11-04')
    expect(closesOf(browser.prices(), 'twelvedata:ABC')[0]![0]).toBe('2024-11-04')
  })

  it('has the rates of a new currency on the fetch that first sees it, from 2015 like the others', async () => {
    const browser = device()
    await browser.run('2026-10-30')
    const sek = currencyCodeOf('SEK')!
    browser.records = investments({ cashMovements: [cashMovement('deposit', BROKER, '2026-10-29', '120', sek, '11.2')] })
    await browser.run('2026-11-02')
    expect(ecbAsked(browser)).toEqual([
      'D.USD.EUR.SP00.A?startPeriod=2026-10-29',
      'D.GBP.EUR.SP00.A?startPeriod=2026-10-29',
      'D.CHF.EUR.SP00.A?startPeriod=2026-10-29',
      'D.SEK.EUR.SP00.A?startPeriod=2015-01-01',
    ])
    expect(browser.prices().series['ecb:SEK']).toMatchObject({ currency: 'SEK', from: '2015-01-01' })
    expect(pricesFileRateBook(browser.prices()).unitsPerEuroOnOrBefore(sek, civil('2026-10-29'))).not.toBeNull()
  })

  it('notes a currency the ECB does not publish, and keeps the rates of one it stopped and asks for it no more', async () => {
    const records = investments({
      cashMovements: [cashMovement('deposit', BROKER, '2020-05-04', '120', currencyCodeOf('HRK')!, '7.6'), cashMovement('deposit', BROKER, '2026-10-29', '120', currencyCodeOf('RSD')!, '117.1')],
    })
    const browser = device(KEYS, records)
    await browser.run('2026-10-30')
    const before = browser.prices()
    expect(before.failures).toEqual([{ series: 'ecb:RSD', day: '2026-10-30', reason: 'unknown-symbol' }])
    expect(closesOf(before, 'ecb:HRK').at(-1)![0]).toBe('2022-12-30')
    await browser.run('2026-11-02')
    expect(ecbAsked(browser).some((asked) => asked.startsWith('D.HRK'))).toBe(false)
    expect(ecbAsked(browser).filter((asked) => asked.startsWith('D.RSD'))).toEqual(['D.RSD.EUR.SP00.A?startPeriod=2015-01-01'])
    expect(browser.prices().series['ecb:HRK']).toEqual(before.series['ecb:HRK'])
    expect(browser.prices().failures).toEqual([{ series: 'ecb:RSD', day: '2026-11-02', reason: 'unknown-symbol' }])
  })

  it("asks again for a European listing's month ends until they come, keeping its daily closes meanwhile", async () => {
    const browser = device()
    await browser.run('2026-10-30', { failing: new Map([['TIME_SERIES_MONTHLY', json(200, { Note: 'Thank you for using Alpha Vantage! Please slow down.' })]]) })
    const first = browser.prices()
    expect(closesOf(first, 'alphavantage:XYZ.DEX')).toHaveLength(99)
    expect(first.series['alphavantage:XYZ.DEX']!.from).toBe(closesOf(first, 'alphavantage:XYZ.DEX')[0]![0])
    expect(first.failures).toEqual([{ series: 'alphavantage:XYZ.DEX', day: '2026-10-30', reason: 'limit' }])
    await browser.run('2026-11-02')
    expect(browser.asked('alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY', 'TIME_SERIES_MONTHLY'])
    expect(browser.prices().series['alphavantage:XYZ.DEX']!.from).toBe('2025-01-03')
  })

  it("stops asking for a European listing's month ends once Alpha Vantage says they are for paid keys", async () => {
    const browser = device()
    const premium = json(200, { Information: 'Thank you for using Alpha Vantage! This is a premium endpoint.' })
    await browser.run('2026-10-30', { failing: new Map([['TIME_SERIES_MONTHLY', premium]]) })
    expect(browser.prices().series['alphavantage:XYZ.DEX']!.from).toBe('2025-01-03')
    expect(browser.prices().failures).toEqual([{ series: 'alphavantage:XYZ.DEX', day: '2026-10-30', reason: 'not-on-free-key' }])
    await browser.run('2026-11-02', { failing: new Map([['TIME_SERIES_MONTHLY', premium]]) })
    expect(browser.asked('alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY'])
    expect(browser.prices().failures).toEqual([])
  })

  it('notes a split a vendor reports once, however often its day comes back', async () => {
    const splitting: PriceVendor = {
      ...twelveData,
      async closes(fetch, key, symbol, from) {
        const fetched = await twelveData.closes(fetch, key, symbol, from)
        return fetched.kind === 'failed' ? fetched : { ...fetched, splits: [{ date: '2026-10-29', newUnits: '10', oldUnits: '1' }] }
      },
    }
    const browser = device()
    await browser.run('2026-10-30', {}, [splitting])
    await browser.run('2026-11-02', {}, [splitting])
    expect(browser.prices().splits).toEqual([
      { series: 'twelvedata:ABC', date: '2026-10-29', newUnits: '10', oldUnits: '1' },
      { series: 'twelvedata:IDX', date: '2026-10-29', newUnits: '10', oldUnits: '1' },
    ])
  })
})

describe('what the fetch reads from the Investments records', () => {
  const newShare = instrument('new', { currency: USD })
  const browser = device(
    KEYS,
    investments({
      instruments: [newShare],
      cashMovements: [cashMovement('deposit', BROKER, '2014-06-02', '1000')],
      spinOffs: [spinOff(SHARE_A, newShare, '2025-06-02', '4', '0.1')],
      exchanges: [exchange(BROKER, '2025-07-01', '100', EURO, '1150', currencyCodeOf('NOK')!, { amount: decimal('5'), currency: currencyCodeOf('SEK')! })],
    }),
  )
  let file: PricesFile
  beforeAll(async () => {
    await browser.run('2026-10-30')
    file = browser.prices()
  })

  it('runs the rates from a record before 2015, and the benchmark from the first deposit', () => {
    expect(file.series['ecb:USD']!.from).toBe('2014-06-02')
    expect(closesOf(file, 'ecb:USD')[0]![0]).toBe('2014-06-02')
    expect(file.series['twelvedata:IDX']!.from).toBe('2014-06-02')
  })

  it('starts an instrument received in a spin-off on the spin-off day', () => {
    expect(file.series['twelvedata:NEW']).toMatchObject({ currency: 'USD', from: '2025-06-02' })
  })

  it("rates an exchange's bought and fee currencies", () => {
    expect(file.series['ecb:NOK']!.from).toBe('2014-06-02')
    expect(file.series['ecb:SEK']!.from).toBe('2014-06-02')
  })
})

describe('the vendors without a key, at their limits and on their errors', () => {
  it('notes a vendor without a key in this browser as no-key and asks it nothing', async () => {
    const browser = device({ alphavantage: KEYS.alphavantage })
    await browser.run('2026-10-30')
    expect(browser.asked('twelvedata')).toEqual([])
    expect(browser.prices().failures).toEqual([
      { series: 'twelvedata:ABC', day: '2026-10-30', reason: 'no-key' },
      { series: 'twelvedata:IDX', day: '2026-10-30', reason: 'no-key' },
    ])
    expect(browser.prices().series['alphavantage:XYZ.DEX']).toBeDefined()
  })

  it("keeps to Twelve Data's 8 requests a minute, pausing out the minute and no longer", async () => {
    const shares: Instrument[] = Array.from({ length: 20 }, (_, place) => instrument(`s${place + 1}`, { currency: USD }))
    const browser = device(KEYS, investments({ instruments: shares, trades: shares.map((share) => trade('buy', BROKER, share, '2026-01-05', '1', '30', '0', '1.1')) }))
    await browser.run('2026-10-30')
    let elapsed = 0
    const sentAt: number[] = []
    for (const event of browser.events) {
      if (event.startsWith('pause ')) {
        elapsed += Number(event.slice(6))
      } else if (event.includes('twelvedata')) {
        sentAt.push(elapsed)
      }
    }
    expect(sentAt).toHaveLength(22)
    expect(sentAt.slice(0, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(sentAt.slice(8).every((at, place) => at - sentAt[place]! >= 60_000)).toBe(true)
    expect(browser.events.filter((event) => event.startsWith('pause ') && event !== 'pause 1500')).toEqual(['pause 61000', 'pause 61000'])
    expect(browser.prices().failures).toEqual([])
  })

  it('keeps 1.5 seconds between Alpha Vantage requests, which would otherwise go out together', async () => {
    const browser = device(KEYS)
    await browser.run('2026-10-30')
    expect(browser.events.filter((event) => event.startsWith('pause '))).toEqual(['pause 1500'])
  })

  it('stops at a daily limit, answering for the vendor without asking it', async () => {
    const twoADay: PriceVendor = { ...twelveData, limits: { perMinute: null, perDay: 2, gapMilliseconds: null } }
    const newShare = instrument('new', { currency: USD })
    const browser = device(KEYS, investments({ instruments: [newShare], trades: [trade('buy', BROKER, newShare, '2026-01-05', '1', '20', '0', '1.1')] }))
    await browser.run('2026-10-30', {}, [twoADay])
    expect(browser.asked('twelvedata')).toHaveLength(2)
    expect(browser.prices().failures).toEqual([{ series: 'twelvedata:NEW', day: '2026-10-30', reason: 'limit' }])
  })

  it('asks a vendor nothing more once it answers that its limit is reached', async () => {
    const otherEtf = instrument('qrs', { prices: 'alphavantage', sourceSymbol: 'QRS.DEX' })
    const browser = device(KEYS, investments({ instruments: [otherEtf] }))
    await browser.run('2026-10-30', { failing: new Map([['alphavantage', json(200, { Information: 'You have reached the 25 requests a day limit.' })]]) })
    expect(browser.asked('alphavantage')).toHaveLength(1)
    expect(browser.prices().failures).toEqual([
      { series: 'alphavantage:XYZ.DEX', day: '2026-10-30', reason: 'limit' },
      { series: 'alphavantage:QRS.DEX', day: '2026-10-30', reason: 'limit' },
    ])
  })

  it("reads Twelve Data's errors: an unknown symbol, a listing for paid plans, and a range with no new day", async () => {
    const browser = device(KEYS, investments({ instruments: [instrument('nope', { currency: USD })] }))
    await browser.run('2026-10-30', { failing: new Map([['symbol=IDX', json(403, { code: 403, message: 'This symbol is available starting with Grow.', status: 'error' })]]) })
    expect(browser.prices().failures).toEqual([
      { series: 'twelvedata:IDX', day: '2026-10-30', reason: 'not-on-free-key' },
      { series: 'twelvedata:NOPE', day: '2026-10-30', reason: 'unknown-symbol' },
    ])
    const before = browser.prices()
    const noNewDay = json(400, { code: 400, message: 'No data is available on the specified dates. Try setting different start/end dates.', status: 'error' })
    await browser.run('2026-11-02', { failing: new Map([['symbol=ABC', noNewDay]]) })
    expect(browser.prices().series['twelvedata:ABC']).toEqual(before.series['twelvedata:ABC'])
    expect(browser.prices().failures.filter((failure) => failure.series === 'twelvedata:ABC')).toEqual([])
  })

  it("brings a history longer than one of Twelve Data's pages in pages going back", async () => {
    const browser = device(KEYS, investments({ cashMovements: [cashMovement('deposit', BROKER, '1996-01-02', '1000')] }))
    await browser.run('2026-10-30')
    expect(browser.asked('symbol=IDX').map((query) => [query.get('start_date'), query.get('end_date')])).toEqual([
      ['1996-01-02', null],
      ['1996-01-02', closesOf(browser.prices(), 'twelvedata:IDX').at(-4999)![0]],
    ])
    const closes = closesOf(browser.prices(), 'twelvedata:IDX')
    expect(closes[0]![0]).toBe('1996-01-02')
    expect(closes).toHaveLength(weekdaysBetween(civil('1996-01-02'), civil('2026-10-29')))
  })

  it('leaves alone a file that is no prices file, such as one a newer Kuna wrote', async () => {
    const browser = device()
    browser.pricesText = JSON.stringify({ format: 'kuna-prices', version: 2, written_at: null, series: {}, splits: [], failures: [] })
    expect(await browser.run('2026-10-30')).toEqual({ kind: 'refused', reason: 'newer' })
    expect(browser.events).toEqual([])
    expect(browser.writes).toEqual([])
  })
})

describe('the price vendor registry', () => {
  it('gives every vendor that needs a key an address to claim one, and none to a vendor that needs none', () => {
    for (const vendor of PRICE_VENDORS) {
      expect(vendor.keyAddress === null ? 'no address' : new URL(vendor.keyAddress).protocol).toBe(vendor.needsKey ? 'https:' : 'no address')
    }
  })

  it('has one vendor for each series key prefix: every source an instrument names, and the ECB for the rates', () => {
    const prefixes = [...PRICE_SOURCES.filter((source) => source !== 'manual'), ECB_SOURCE]
    expect(PRICE_VENDORS.map((vendor) => vendor.id).sort()).toEqual([...prefixes].sort())
    expect(PRICE_VENDORS.filter((vendor) => vendor.prices === 'rates').map((vendor) => vendor.id)).toEqual([ECB_SOURCE])
    const fakeKeys = Object.keys(fakePricesFile('sample', civil('2026-10-30')).series)
    expect(fakeKeys.filter((key) => !PRICE_VENDORS.some((vendor) => key.startsWith(`${vendor.id}:`)))).toEqual([])
  })

  it('names each vendor, says what it covers, and states limits a pacing can keep to', () => {
    for (const vendor of PRICE_VENDORS) {
      expect(vendor.name).not.toBe('')
      expect(vendor.covers).not.toBe('')
      expect([vendor.limits.perMinute, vendor.limits.perDay].every((limit) => limit === null || (Number.isInteger(limit) && limit > 0))).toBe(true)
    }
  })
})
