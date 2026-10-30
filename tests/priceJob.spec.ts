import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

import { decodePricesFile, emptyPricesFile, encodePricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import type { PricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { pricesFileRateBook } from '../src/apps/investments/prices/domain/pricesFileBooks'
import { PROPERTIES, runPriceJob } from '../src/apps/investments/prices/job/priceJob'
import type { PriceJobPorts, ProviderAnswer } from '../src/apps/investments/prices/job/priceJobPorts'
import { splitRatio } from '../src/apps/investments/prices/job/tiingo'
import { addDays, weekdaysBetween } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { currencyCodeOf } from '../src/shared/money/currencyCode'
import { encodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { USD } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const INVESTMENTS_ID = 'investments-file'
const PRICES_ID = 'prices-file'

/** A made-up Investments file in the fields the plan gives the records: a US share, a Xetra ETF, a benchmark with no trades and a fund priced by hand. */
function investmentsFile(extra: { readonly records?: Readonly<Record<string, readonly DocumentRecord[]>>; readonly schema?: Readonly<Record<string, number>> } = {}): string {
  const records: Record<string, readonly DocumentRecord[]> = {
    'investment-account': [{ id: 'acc-1', name: 'Broker' }],
    instrument: [
      { id: 'ins-abc', name: 'Share A', class: 'stocks', symbol: 'ABC', currency: 'USD', quoted: 'unit', prices: 'tiingo', source_symbol: 'ABC' },
      { id: 'ins-xyz', name: 'World ETF', class: 'stocks', symbol: 'XYZ', exchange: 'XETR', currency: 'EUR', quoted: 'unit', prices: 'alphavantage', source_symbol: 'XYZ.DEX' },
      { id: 'ins-idx', name: 'Index fund', class: 'stocks', symbol: 'IDX', currency: 'USD', quoted: 'unit', prices: 'tiingo', source_symbol: 'IDX' },
      { id: 'ins-fund', name: 'Money fund', class: 'money-market', symbol: 'FUND', currency: 'EUR', quoted: 'unit', prices: 'manual', source_symbol: '' },
    ],
    'cash-movement': [{ id: 'cm-1', account: 'acc-1', kind: 'deposit', date: '2025-01-02', currency: 'EUR', amount: '5000' }],
    exchange: [{ id: 'ex-1', account: 'acc-1', date: '2025-03-03', sold: '1000', sold_currency: 'EUR', bought: '1050', bought_currency: 'USD' }],
    trade: [
      { id: 'tr-1', account: 'acc-1', instrument: 'ins-xyz', side: 'buy', date: '2025-01-03', quantity: '10', price: '100', fees: '2' },
      { id: 'tr-2', account: 'acc-1', instrument: 'ins-abc', side: 'buy', date: '2025-03-03', quantity: '20', price: '50', fees: '1', rate: '1.05' },
      { id: 'tr-3', account: 'acc-1', instrument: 'ins-fund', side: 'buy', date: '2025-03-04', quantity: '100', price: '10', fees: '0' },
    ],
    income: [],
  }
  for (const [kind, added] of Object.entries(extra.records ?? {})) {
    records[kind] = [...(records[kind] ?? []), ...added]
  }
  return encodeDocument({ app: 'investments', schema: extra.schema ?? { investments: 1 }, savedAt: '2026-10-29T18:00:00.000Z', records })
}

function weekdays(from: string, to: string): CivilDate[] {
  const days: CivilDate[] = []
  for (let day = civil(from); day <= to; day = addDays(day, 1)) {
    if (weekdaysBetween(day, day) === 1) {
      days.push(day)
    }
  }
  return days
}

/** Made-up closes in cents, one per weekday from the start of 2014 to the day before the run. */
function madeUpCloses(base: number, through: string): readonly (readonly [string, string])[] {
  return weekdays('2014-01-01', through).map((day, place) => [day, `${base + (place % 50)}.${String(place % 100).padStart(2, '0')}`] as const)
}

interface Provider {
  /** Overrides the made-up answer of a request whose URL holds the text. */
  readonly failing: ReadonlyMap<string, ProviderAnswer | 'no-answer'>
  /** The day Tiingo reports a 10-for-1 split of share A. */
  readonly splitDay: string | null
  /** A day whose closes and rates every provider sends corrected, unlike on the run before. */
  readonly revisedDay: string | null
}

/** The close a provider sends on its revised day. */
const REVISED = '77.77'

/** Answers like the three providers' from made-up history up to the day before `day`. */
function providerAnswer(url: string, headers: Readonly<Record<string, string>>, day: string, provider: Provider): ProviderAnswer {
  const through = addDays(civil(day), -1)
  const query = new URL(url).searchParams
  if (url.startsWith('https://api.tiingo.com/tiingo/daily/')) {
    if (headers.Authorization !== 'Token tiingo-key') {
      return { status: 401, text: '{"detail":"Invalid token."}' }
    }
    const symbol = decodeURIComponent(url.split('/')[5]!)
    const base = { ABC: 50, IDX: 400, NEW: 20 }[symbol]
    if (base === undefined) {
      return { status: 404, text: `{"detail":"Error: Ticker '${symbol}' not found"}` }
    }
    const rows = madeUpCloses(base, through)
      .filter(([date]) => date >= query.get('startDate')!)
      .map(([date, close]) => ({
        date: `${date}T00:00:00.000Z`,
        close: Number(date === provider.revisedDay ? REVISED : close),
        high: 0,
        low: 0,
        open: 0,
        volume: 1000,
        adjClose: Number(close),
        divCash: 0,
        splitFactor: date === provider.splitDay ? 10 : 1,
      }))
    return { status: 200, text: JSON.stringify(rows) }
  }
  if (url.startsWith('https://www.alphavantage.co/query?')) {
    if (query.get('apikey') !== 'alpha-key') {
      return { status: 200, text: '{"Error Message": "the parameter apikey is invalid or missing."}' }
    }
    const closes = madeUpCloses(100, through).map(([date, close]) => [date, date === provider.revisedDay ? REVISED : close] as const)
    const asText = (rows: readonly (readonly [string, string])[]): Record<string, Record<string, string>> =>
      Object.fromEntries(rows.map(([date, close]) => [date, { '1. open': close, '2. high': close, '3. low': close, '4. close': `${close}00`, '5. volume': '1000' }]))
    if (query.get('function') === 'TIME_SERIES_DAILY') {
      expect(query.get('outputsize')).toBe('compact')
      return { status: 200, text: JSON.stringify({ 'Meta Data': { '2. Symbol': query.get('symbol') }, 'Time Series (Daily)': asText(closes.slice(-100)) }) }
    }
    const monthEnds = closes.filter(([date], place) => closes[place + 1] === undefined || closes[place + 1]![0].slice(0, 7) !== date.slice(0, 7))
    return { status: 200, text: JSON.stringify({ 'Meta Data': { '2. Symbol': query.get('symbol') }, 'Monthly Time Series': asText(monthEnds) }) }
  }
  if (url.startsWith('https://data-api.ecb.europa.eu/service/data/EXR/')) {
    const currencies = url.split('/EXR/D.')[1]!.split('.EUR.')[0]!.split('+')
    const rate = { USD: 1, GBP: 0, CHF: 0, SEK: 11, NOK: 11, HRK: 7 } as Record<string, number>
    /** The ECB stopped the kuna's rates when Croatia took the euro. */
    const lastHrk = '2022-12-30'
    const rows = weekdays('1999-01-04', through)
      .filter((date) => date >= query.get('startPeriod')!)
      .flatMap((date, place) =>
        currencies
          .filter((currency) => currency in rate && (currency !== 'HRK' || date <= lastHrk))
          .map((currency) => `EXR.D.${currency}.EUR.SP00.A,D,${currency},EUR,SP00,A,${date},${date === provider.revisedDay ? REVISED : `${rate[currency]}.${String(1000 + (place % 300))}`}`),
      )
    return { status: 200, text: ['KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE', ...rows].join('\r\n') }
  }
  throw new Error(`No made-up answer for ${url}`)
}

interface Account {
  readonly ports: PriceJobPorts
  readonly files: Map<string, string>
  readonly requests: { readonly url: string; readonly headers: Readonly<Record<string, string>> }[]
  /** Each request's address and each pause, in the order the job made them. */
  readonly events: string[]
  readonly writes: string[]
  run(day: string, provider?: Partial<Provider>): readonly string[]
  prices(): PricesFile
}

const KEYS = { [PROPERTIES.investmentsFile]: INVESTMENTS_ID, [PROPERTIES.pricesFile]: PRICES_ID, [PROPERTIES.tiingoKey]: 'tiingo-key', [PROPERTIES.alphaVantageKey]: 'alpha-key' }

/** Ivan's Google account as the job sees it: two Drive files, the script properties and the providers, all made up. */
function account(properties: Readonly<Record<string, string>> = KEYS, investments = investmentsFile()): Account {
  const files = new Map([
    [INVESTMENTS_ID, investments],
    [PRICES_ID, encodePricesFile(emptyPricesFile())],
  ])
  const requests: { url: string; headers: Readonly<Record<string, string>> }[] = []
  const events: string[] = []
  const writes: string[] = []
  let today = ''
  let provider: Provider = { failing: new Map(), splitDay: null, revisedDay: null }
  const ports: PriceJobPorts = {
    fetch(url, headers) {
      requests.push({ url, headers })
      events.push(url)
      const failure = [...provider.failing].find(([part]) => url.includes(part))?.[1]
      if (failure === 'no-answer') {
        throw new Error('Address unavailable')
      }
      return failure ?? providerAnswer(url, headers, today, provider)
    },
    readFile(fileId) {
      const text = files.get(fileId)
      if (text === undefined) {
        throw new Error(`No file ${fileId}`)
      }
      return text
    },
    writeFile(fileId, text) {
      writes.push(fileId)
      files.set(fileId, text)
    },
    property: (name) => properties[name] ?? null,
    pause: (milliseconds) => events.push(`pause ${milliseconds}`),
  }
  return {
    ports,
    files,
    requests,
    events,
    writes,
    run(day, overrides = {}) {
      today = day
      provider = { failing: new Map(), splitDay: null, revisedDay: null, ...overrides }
      requests.length = 0
      events.length = 0
      return runPriceJob(ports, { at: `${day}T05:41:00.000Z`, day })
    },
    prices() {
      const read = decodePricesFile(files.get(PRICES_ID)!)
      if (read.kind !== 'read') {
        throw new Error(read.reason)
      }
      return read.file
    },
  }
}

function closesOf(file: PricesFile, key: string): readonly (readonly [string, string])[] {
  return file.series[key]?.closes ?? []
}

function asked(requests: Account['requests'], host: string): URLSearchParams[] {
  return requests.filter((request) => request.url.includes(host)).map((request) => new URL(request.url).searchParams)
}

describe('the daily price job, on its first run', () => {
  const ivan = account()
  const log = ivan.run('2026-10-30')
  const file = ivan.prices()

  it('fetches each US listing from its first trade, and the benchmark with no trades from the first deposit', () => {
    expect(file.series['tiingo:ABC']).toMatchObject({ currency: 'USD', from: '2025-03-03' })
    expect(closesOf(file, 'tiingo:ABC')[0]![0]).toBe('2025-03-03')
    expect(closesOf(file, 'tiingo:ABC').at(-1)![0]).toBe('2026-10-29')
    expect(file.series['tiingo:IDX']).toMatchObject({ currency: 'USD', from: '2025-01-02' })
    expect(closesOf(file, 'tiingo:IDX')[0]![0]).toBe('2025-01-02')
  })

  it('keeps closes as the providers send them: Tiingo numbers as their shortest text, Alpha Vantage text as it is', () => {
    expect(closesOf(file, 'tiingo:ABC')[0]).toEqual(['2025-03-03', String(Number(madeUpCloses(50, '2025-03-03').at(-1)![1]))])
    expect(closesOf(file, 'alphavantage:XYZ.DEX').at(-1)![1]).toMatch(/^\d+\.\d{4}$/)
  })

  it('fetches a European listing as its 100 daily closes and the month ends before them', () => {
    const closes = closesOf(file, 'alphavantage:XYZ.DEX')
    expect(file.series['alphavantage:XYZ.DEX']).toMatchObject({ currency: 'EUR', from: '2025-01-03' })
    const daily = closes.filter(([day]) => day >= closes.at(-100)![0])
    expect(daily).toHaveLength(100)
    expect(daily.at(-1)![0]).toBe('2026-10-29')
    const monthly = closes.slice(0, -100)
    expect(monthly.length).toBeGreaterThan(100)
    expect(new Set(monthly.map(([day]) => day.slice(0, 7))).size).toBe(monthly.length)
    expect(asked(ivan.requests, 'alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY', 'TIME_SERIES_MONTHLY'])
  })

  it('has the rates of a new USD row on the first run, and GBP and CHF from 2015 in the same request', () => {
    const rates = pricesFileRateBook(file)
    expect(rates.unitsPerEuroOnOrBefore(USD, civil('2025-03-03'))).not.toBeNull()
    expect(Object.keys(file.series).filter((key) => key.startsWith('ecb:'))).toEqual(['ecb:CHF', 'ecb:GBP', 'ecb:USD'])
    expect(['ecb:USD', 'ecb:GBP', 'ecb:CHF'].map((key) => file.series[key]!.from)).toEqual(['2015-01-01', '2015-01-01', '2015-01-01'])
    expect(closesOf(file, 'ecb:GBP')[0]![0]).toBe('2015-01-01')
    expect(asked(ivan.requests, 'data-api.ecb.europa.eu').map((query) => query.get('startPeriod'))).toEqual(['2015-01-01'])
    expect(ivan.requests.find((request) => request.url.includes('ecb'))!.url).toContain('/EXR/D.USD+GBP+CHF.EUR.SP00.A?')
  })

  it('asks nothing for a fund priced by hand, and sends the Tiingo key as a header, never in the address', () => {
    expect(Object.keys(file.series).some((key) => key.includes('FUND'))).toBe(false)
    expect(ivan.requests).toHaveLength(5)
    for (const request of ivan.requests.filter((candidate) => candidate.url.includes('tiingo'))) {
      expect(request.url).not.toContain('tiingo-key')
      expect(request.headers.Authorization).toBe('Token tiingo-key')
    }
  })

  it('writes the prices file once, with its time and no failures, and logs counts only', () => {
    expect(ivan.writes).toEqual([PRICES_ID])
    expect(file.writtenAt).toBe('2026-10-30T05:41:00.000Z')
    expect(file.failures).toEqual([])
    expect(log).toEqual([
      'Read 3 listings and 3 currencies from the Investments file.',
      'Tiingo: 2 asked, 2 updated.',
      'Alpha Vantage: 1 asked, 1 updated.',
      'ECB: 3 asked, 3 updated.',
      'Wrote 6 series, 0 split notes and 0 failures.',
    ])
    expect(log.join(' ')).not.toMatch(/ABC|IDX|XYZ|\d+\.\d/)
  })
})

describe('the daily price job, on a later run', () => {
  it('asks only from the last close and adds the new day to what it kept', () => {
    const ivan = account()
    ivan.run('2026-10-30')
    const before = ivan.prices()
    ivan.run('2026-11-02')
    const after = ivan.prices()
    expect(asked(ivan.requests, 'tiingo').length).toBe(2)
    expect(ivan.requests.filter((request) => request.url.includes('tiingo')).map((request) => new URL(request.url).searchParams.get('startDate'))).toEqual(['2026-10-29', '2026-10-29'])
    expect(asked(ivan.requests, 'alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY'])
    expect(asked(ivan.requests, 'ecb').map((query) => query.get('startPeriod'))).toEqual(['2026-10-29'])
    expect(closesOf(after, 'tiingo:ABC')).toEqual([...closesOf(before, 'tiingo:ABC'), closesOf(after, 'tiingo:ABC').at(-1)])
    expect(closesOf(after, 'tiingo:ABC').at(-1)![0]).toBe('2026-10-30')
    expect(closesOf(after, 'alphavantage:XYZ.DEX').slice(0, closesOf(before, 'alphavantage:XYZ.DEX').length)).toEqual(closesOf(before, 'alphavantage:XYZ.DEX'))
    expect(after.series['ecb:USD']!.from).toBe('2015-01-01')
  })

  it("keeps yesterday's closes of every provider that failed and notes each failure", () => {
    const ivan = account()
    ivan.run('2026-10-30')
    const before = ivan.prices()
    const failing = new Map<string, ProviderAnswer | 'no-answer'>([
      ['/daily/ABC/', { status: 500, text: 'Internal Server Error' }],
      ['/daily/IDX/', { status: 429, text: 'Too Many Requests' }],
      ['alphavantage', { status: 200, text: '{"Information": "You have reached the 25 requests a day limit."}' }],
      ['data-api.ecb.europa.eu', 'no-answer'],
    ])
    const log = ivan.run('2026-11-02', { failing })
    const after = ivan.prices()
    expect(after.series).toEqual(before.series)
    expect(after.writtenAt).toBe('2026-11-02T05:41:00.000Z')
    expect(after.failures).toEqual([
      { series: 'tiingo:ABC', day: '2026-11-02', reason: 'refused' },
      { series: 'tiingo:IDX', day: '2026-11-02', reason: 'limit' },
      { series: 'alphavantage:XYZ.DEX', day: '2026-11-02', reason: 'limit' },
      { series: 'ecb:USD', day: '2026-11-02', reason: 'no-answer' },
      { series: 'ecb:GBP', day: '2026-11-02', reason: 'no-answer' },
      { series: 'ecb:CHF', day: '2026-11-02', reason: 'no-answer' },
    ])
    expect(log.slice(1, 4)).toEqual(['Tiingo: 2 asked, 0 updated, failed: 1 refused, 1 limit.', 'Alpha Vantage: 1 asked, 0 updated, failed: 1 limit.', 'ECB: 3 asked, 0 updated, failed: 3 no-answer.'])
  })

  it('clears the failures once the providers answer again', () => {
    const ivan = account()
    ivan.run('2026-10-30', { failing: new Map([['/daily/ABC/', { status: 500, text: '' }]]) })
    expect(ivan.prices().failures).toHaveLength(1)
    expect(ivan.prices().series['tiingo:ABC']).toBeUndefined()
    ivan.run('2026-11-02')
    expect(ivan.prices().failures).toEqual([])
    expect(ivan.prices().series['tiingo:ABC']!.from).toBe('2025-03-03')
  })

  it('has the rates of a row in a new currency on the run that first sees it, from 2015 like the others', () => {
    const ivan = account()
    ivan.run('2026-10-30')
    ivan.files.set(
      INVESTMENTS_ID,
      investmentsFile({ records: { income: [{ id: 'in-1', account: 'acc-1', kind: 'interest', date: '2026-10-29', currency: 'SEK', gross: '120', withheld: '0', rate: '11.2' }] } }),
    )
    ivan.run('2026-11-02')
    const file = ivan.prices()
    expect(ivan.requests.filter((request) => request.url.includes('ecb')).map((request) => request.url.split('/EXR/')[1]!.split('&')[0])).toEqual([
      'D.SEK.EUR.SP00.A?startPeriod=2015-01-01',
      'D.USD+GBP+CHF.EUR.SP00.A?startPeriod=2026-10-29',
    ])
    expect(file.series['ecb:SEK']).toMatchObject({ currency: 'SEK', from: '2015-01-01' })
    expect(pricesFileRateBook(file).unitsPerEuroOnOrBefore(currencyCodeOf('SEK')!, civil('2026-10-29'))).not.toBeNull()
    expect(file.failures).toEqual([])
  })

  it('fetches the history again when a record older than a series start arrives', () => {
    const ivan = account()
    ivan.run('2026-10-30')
    ivan.files.set(
      INVESTMENTS_ID,
      investmentsFile({ records: { trade: [{ id: 'tr-0', account: 'acc-1', instrument: 'ins-abc', side: 'buy', date: '2024-11-04', quantity: '5', price: '45', fees: '1', rate: '1.08' }] } }),
    )
    ivan.run('2026-11-02')
    expect(ivan.requests.filter((request) => request.url.includes('/daily/ABC/')).map((request) => new URL(request.url).searchParams.get('startDate'))).toEqual(['2024-11-04'])
    expect(ivan.prices().series['tiingo:ABC']!.from).toBe('2024-11-04')
    expect(closesOf(ivan.prices(), 'tiingo:ABC')[0]![0]).toBe('2024-11-04')
  })

  it("asks again for a European listing's month ends until they come, keeping its daily closes meanwhile", () => {
    const ivan = account()
    ivan.run('2026-10-30', { failing: new Map([['TIME_SERIES_MONTHLY', { status: 200, text: '{"Note": "Thank you for using Alpha Vantage! Please slow down."}' }]]) })
    const first = ivan.prices()
    expect(closesOf(first, 'alphavantage:XYZ.DEX')).toHaveLength(100)
    expect(first.series['alphavantage:XYZ.DEX']!.from).toBe(closesOf(first, 'alphavantage:XYZ.DEX')[0]![0])
    expect(first.failures).toEqual([{ series: 'alphavantage:XYZ.DEX', day: '2026-10-30', reason: 'limit' }])
    ivan.run('2026-11-02')
    expect(asked(ivan.requests, 'alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY', 'TIME_SERIES_MONTHLY'])
    expect(ivan.prices().series['alphavantage:XYZ.DEX']!.from).toBe('2025-01-03')
  })

  it('takes a corrected close or rate the providers send for a day the file already has', () => {
    const ivan = account()
    ivan.run('2026-10-30')
    ivan.run('2026-11-02', { revisedDay: '2026-10-29' })
    const after = ivan.prices()
    const onRevisedDay = (key: string): readonly (readonly [string, string])[] => closesOf(after, key).filter(([day]) => day === '2026-10-29')
    expect(onRevisedDay('tiingo:ABC')).toEqual([['2026-10-29', REVISED]])
    expect(onRevisedDay('alphavantage:XYZ.DEX')).toEqual([['2026-10-29', `${REVISED}00`]])
    expect(onRevisedDay('ecb:USD')).toEqual([['2026-10-29', REVISED]])
  })

  it('pauses before each Alpha Vantage request, which a free key may refuse in a burst', () => {
    const ivan = account()
    ivan.run('2026-10-30')
    const paced = ivan.events
      .filter((event) => event.startsWith('pause') || event.includes('alphavantage'))
      .map((event) => (event.startsWith('pause') ? event : new URL(event).searchParams.get('function')))
    expect(paced).toEqual(['pause 1500', 'TIME_SERIES_DAILY', 'pause 1500', 'TIME_SERIES_MONTHLY'])
    expect(ivan.events.filter((event) => event.startsWith('pause'))).toHaveLength(2)
  })

  it("stops asking for a European listing's month ends once Alpha Vantage says they are for paid keys", () => {
    const ivan = account()
    const premium = { status: 200, text: '{"Information": "Thank you for using Alpha Vantage! This is a premium endpoint."}' }
    ivan.run('2026-10-30', { failing: new Map([['TIME_SERIES_MONTHLY', premium]]) })
    const first = ivan.prices()
    expect(closesOf(first, 'alphavantage:XYZ.DEX')).toHaveLength(100)
    expect(first.series['alphavantage:XYZ.DEX']!.from).toBe('2025-01-03')
    expect(first.failures).toEqual([{ series: 'alphavantage:XYZ.DEX', day: '2026-10-30', reason: 'not-on-free-key' }])
    ivan.run('2026-11-02', { failing: new Map([['TIME_SERIES_MONTHLY', premium]]) })
    expect(asked(ivan.requests, 'alphavantage').map((query) => query.get('function'))).toEqual(['TIME_SERIES_DAILY'])
    expect(ivan.prices().failures).toEqual([])
  })

  it('asks only from the last rate for the published currencies when the ECB does not publish one the file names', () => {
    const ivan = account(
      KEYS,
      investmentsFile({ records: { income: [{ id: 'in-1', account: 'acc-1', kind: 'interest', date: '2026-10-29', currency: 'RSD', gross: '120', withheld: '0', rate: '117.1' }] } }),
    )
    ivan.run('2026-10-30')
    expect(ivan.prices().failures).toEqual([{ series: 'ecb:RSD', day: '2026-10-30', reason: 'unknown-symbol' }])
    ivan.run('2026-11-02')
    expect(ivan.requests.filter((request) => request.url.includes('ecb')).map((request) => request.url.split('/EXR/')[1]!.split('&')[0])).toEqual([
      'D.RSD.EUR.SP00.A?startPeriod=2015-01-01',
      'D.USD+GBP+CHF.EUR.SP00.A?startPeriod=2026-10-29',
    ])
    expect(ivan.prices().failures).toEqual([{ series: 'ecb:RSD', day: '2026-11-02', reason: 'unknown-symbol' }])
  })

  it('keeps the rates of a currency the ECB stopped publishing and asks for it no more', () => {
    const ivan = account(
      KEYS,
      investmentsFile({ records: { income: [{ id: 'in-1', account: 'acc-1', kind: 'interest', date: '2020-05-04', currency: 'HRK', gross: '120', withheld: '0', rate: '7.6' }] } }),
    )
    ivan.run('2026-10-30')
    const before = ivan.prices()
    expect(closesOf(before, 'ecb:HRK').at(-1)![0]).toBe('2022-12-30')
    const log = ivan.run('2026-11-02')
    expect(ivan.requests.filter((request) => request.url.includes('ecb')).map((request) => request.url.split('/EXR/')[1]!.split('&')[0])).toEqual(['D.USD+GBP+CHF.EUR.SP00.A?startPeriod=2026-10-29'])
    expect(ivan.prices().series['ecb:HRK']).toEqual(before.series['ecb:HRK'])
    expect(ivan.prices().failures).toEqual([])
    expect(log[3]).toBe('ECB: 3 asked, 3 updated.')
  })

  it('reads the currency from the series key when the ECB sends no CURRENCY column', () => {
    const ivan = account()
    const csv = ['KEY,FREQ,TIME_PERIOD,OBS_VALUE', 'EXR.D.USD.EUR.SP00.A,D,2026-10-29,1.0812', 'EXR.D.GBP.EUR.SP00.A,D,2026-10-29,0.8701'].join('\r\n')
    ivan.run('2026-10-30', { failing: new Map([['data-api.ecb.europa.eu', { status: 200, text: csv }]]) })
    expect(closesOf(ivan.prices(), 'ecb:USD')).toEqual([['2026-10-29', '1.0812']])
    expect(closesOf(ivan.prices(), 'ecb:GBP')).toEqual([['2026-10-29', '0.8701']])
    expect(ivan.prices().failures).toEqual([{ series: 'ecb:CHF', day: '2026-10-30', reason: 'unknown-symbol' }])
  })

  it('notes a split Tiingo reports once, however often its day comes back', () => {
    const ivan = account()
    ivan.run('2026-10-30', { splitDay: '2026-10-29' })
    ivan.run('2026-11-02', { splitDay: '2026-10-29' })
    expect(ivan.prices().splits).toEqual([
      { series: 'tiingo:ABC', date: '2026-10-29', newUnits: '10', oldUnits: '1' },
      { series: 'tiingo:IDX', date: '2026-10-29', newUnits: '10', oldUnits: '1' },
    ])
  })

  it('notes a missing key and sends no request without it', () => {
    const { [PROPERTIES.tiingoKey]: _tiingoKey, ...withoutTiingo } = KEYS
    const ivan = account(withoutTiingo)
    ivan.run('2026-10-30')
    expect(asked(ivan.requests, 'tiingo')).toEqual([])
    expect(
      ivan
        .prices()
        .failures.filter((failure) => failure.reason === 'no-key')
        .map((failure) => failure.series),
    ).toEqual(['tiingo:ABC', 'tiingo:IDX'])
  })

  it('notes a symbol the provider does not know', () => {
    const ivan = account(KEYS, investmentsFile().replace('"source_symbol":"IDX"', '"source_symbol":"NOPE"'))
    ivan.run('2026-10-30')
    expect(ivan.prices().failures).toEqual([{ series: 'tiingo:NOPE', day: '2026-10-30', reason: 'unknown-symbol' }])
  })
})

describe('what the daily price job reads from the Investments file', () => {
  const ivan = account(
    KEYS,
    investmentsFile({
      records: {
        'cash-movement': [{ id: 'cm-0', account: 'acc-1', kind: 'deposit', date: '2014-06-02', currency: 'EUR', amount: '1000' }],
        instrument: [{ id: 'ins-new', name: 'Share B', class: 'stocks', symbol: 'NEW', currency: 'USD', quoted: 'unit', prices: 'tiingo', source_symbol: 'NEW' }],
        'spin-off': [{ id: 'so-1', account: 'acc-1', instrument: 'ins-abc', received: 'ins-new', date: '2025-06-02', quantity: '4', cost_share: '0.1' }],
        exchange: [{ id: 'ex-2', account: 'acc-1', date: '2025-07-01', sold: '100', sold_currency: 'EUR', bought: '1150', bought_currency: 'NOK', fee: '5', fee_currency: 'SEK' }],
        trade: [{ id: 'tr-bad', account: 'acc-1', instrument: 'ins-abc', side: 'buy', date: '2024-02-30', quantity: '1', price: '40', fees: '0', rate: '1.1' }],
      },
    }),
  )
  ivan.run('2026-10-30')
  const file = ivan.prices()

  it('runs the rates from a record before 2015, and the benchmark from the first deposit', () => {
    expect(asked(ivan.requests, 'data-api.ecb.europa.eu').map((query) => query.get('startPeriod'))).toEqual(['2014-06-02'])
    expect(file.series['ecb:USD']!.from).toBe('2014-06-02')
    expect(closesOf(file, 'ecb:USD')[0]![0]).toBe('2014-06-02')
    expect(file.series['tiingo:IDX']!.from).toBe('2014-06-02')
  })

  it('starts an instrument received in a spin-off on the spin-off day', () => {
    expect(file.series['tiingo:NEW']).toMatchObject({ currency: 'USD', from: '2025-06-02' })
  })

  it("rates an exchange's bought and fee currencies", () => {
    expect(file.series['ecb:NOK']!.from).toBe('2014-06-02')
    expect(file.series['ecb:SEK']!.from).toBe('2014-06-02')
  })

  it('leaves out a record whose date is no day', () => {
    expect(file.series['tiingo:ABC']!.from).toBe('2025-03-03')
  })
})

describe('the daily price job, stopping', () => {
  it('stops with a note on an Investments file a newer Kuna saved, and keeps every series', () => {
    const ivan = account()
    ivan.run('2026-10-30')
    const before = ivan.prices()
    ivan.files.set(INVESTMENTS_ID, investmentsFile({ schema: { investments: 2 } }))
    expect(() => ivan.run('2026-11-02')).toThrow('Stopped with nothing fetched: investments-newer.')
    expect(ivan.requests).toEqual([])
    expect(ivan.prices()).toEqual({ ...before, writtenAt: '2026-11-02T05:41:00.000Z', failures: [{ series: null, day: '2026-11-02', reason: 'investments-newer' }] })
  })

  it('stops with a note when the Investments file cannot be opened', () => {
    const ivan = account({ ...KEYS, [PROPERTIES.investmentsFile]: 'gone' })
    expect(() => ivan.run('2026-10-30')).toThrow('investments-unreadable')
    expect(ivan.prices().failures).toEqual([{ series: null, day: '2026-10-30', reason: 'investments-unreadable' }])
  })

  it('leaves alone a file that is no prices file, such as the Investments file named by mistake', () => {
    const ivan = account({ ...KEYS, [PROPERTIES.pricesFile]: INVESTMENTS_ID })
    expect(() => ivan.run('2026-10-30')).toThrow('is no prices file Kuna made (not-prices)')
    expect(ivan.writes).toEqual([])
    expect(ivan.files.get(INVESTMENTS_ID)).toBe(investmentsFile())
  })

  it('asks for the two file ids before it reads anything', () => {
    const ivan = account({ [PROPERTIES.tiingoKey]: 'tiingo-key' })
    expect(() => ivan.run('2026-10-30')).toThrow('Set the script properties INVESTMENTS_FILE_ID and PRICES_FILE_ID first.')
    expect(ivan.writes).toEqual([])
  })
})

describe("Tiingo's split factor", () => {
  it('reads as whole new and old units', () => {
    expect(splitRatio(10)).toEqual({ newUnits: 10, oldUnits: 1 })
    expect(splitRatio(0.333333)).toEqual({ newUnits: 1, oldUnits: 3 })
    expect(splitRatio(1.5)).toEqual({ newUnits: 3, oldUnits: 2 })
    expect(splitRatio(0.05)).toEqual({ newUnits: 1, oldUnits: 20 })
    expect(splitRatio(1)).toBeNull()
    expect(splitRatio(0)).toBeNull()
  })
})

/** What `price-job/Triggers.js` did with the Apps Script services it was handed. */
interface AppsScriptRun {
  readonly fetches: { readonly url: string; readonly params: unknown }[]
  readonly written: Map<string, string>
  readonly logged: string[]
  readonly zones: string[]
  readonly slept: number[]
  readonly deleted: string[]
  readonly created: { readonly handler: string; readonly days: number; readonly hour: number; readonly zone: string }[]
  readonly ports: () => PriceJobPorts
}

/** Loads `Triggers.js` as Apps Script would, beside made-up services and a stand-in for the bundled job. */
function appsScript(properties: Readonly<Record<string, string>>, triggers: readonly string[] = []): { readonly script: Record<string, () => void>; readonly run: AppsScriptRun } {
  let handed: PriceJobPorts | null = null
  const run: AppsScriptRun = {
    fetches: [],
    written: new Map(),
    logged: [],
    zones: [],
    slept: [],
    deleted: [],
    created: [],
    ports: () => handed!,
  }
  const script: Record<string, unknown> = {
    console: { log: (line: string) => run.logged.push(line) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (name: string) => properties[name] ?? null }) },
    UrlFetchApp: {
      fetch(url: string, params: unknown) {
        run.fetches.push({ url, params })
        return { getResponseCode: () => 429, getContentText: (charset: string) => `limit in ${charset}` }
      },
    },
    DriveApp: {
      getFileById: (fileId: string) => ({
        getBlob: () => ({ getDataAsString: (charset: string) => `${fileId} in ${charset}` }),
        setContent: (text: string) => run.written.set(fileId, text),
      }),
    },
    Utilities: {
      formatDate(_at: Date, zone: string, pattern: string) {
        run.zones.push(zone)
        return pattern === 'yyyy-MM-dd' ? '2026-10-30' : pattern
      },
      sleep: (milliseconds: number) => run.slept.push(milliseconds),
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((handler) => ({ getHandlerFunction: () => handler })),
      deleteTrigger: (trigger: { getHandlerFunction(): string }) => run.deleted.push(trigger.getHandlerFunction()),
      newTrigger: (handler: string) => ({
        timeBased: () => ({
          everyDays: (days: number) => ({
            atHour: (hour: number) => ({ inTimezone: (zone: string) => ({ create: () => run.created.push({ handler, days, hour, zone }) }) }),
          }),
        }),
      }),
    },
    KunaPriceJob: {
      runPriceJob(ports: PriceJobPorts, clock: { readonly at: string; readonly day: string }) {
        handed = ports
        return [`Ran on ${clock.day}.`, 'Wrote 0 series.']
      },
    },
  }
  runInNewContext(readFileSync(new URL('../price-job/Triggers.js', import.meta.url), 'utf8'), script)
  return { script: script as Record<string, () => void>, run }
}

describe('the Apps Script side of the job', () => {
  it("hands the job Apps Script's fetch, Drive, properties and sleep, the day in Zagreb, and logs each line", () => {
    const { script, run } = appsScript({ [PROPERTIES.tiingoKey]: '  tiingo-key  ', [PROPERTIES.alphaVantageKey]: '   ' })
    script.runPrices!()
    const ports = run.ports()
    expect(run.zones).toEqual(['Europe/Zagreb'])
    expect(run.logged).toEqual(['Ran on 2026-10-30.', 'Wrote 0 series.'])
    expect(ports.fetch('https://example.test/prices', { Authorization: 'Token tiingo-key' })).toEqual({ status: 429, text: 'limit in UTF-8' })
    expect(run.fetches).toEqual([{ url: 'https://example.test/prices', params: { headers: { Authorization: 'Token tiingo-key' }, muteHttpExceptions: true } }])
    expect(ports.readFile('file-1')).toBe('file-1 in UTF-8')
    ports.writeFile('file-2', 'prices')
    expect(run.written).toEqual(new Map([['file-2', 'prices']]))
    expect(ports.property(PROPERTIES.tiingoKey)).toBe('tiingo-key')
    expect(ports.property(PROPERTIES.alphaVantageKey)).toBeNull()
    expect(ports.property(PROPERTIES.pricesFile)).toBeNull()
    ports.pause(1500)
    expect(run.slept).toEqual([1500])
  })

  it('replaces earlier triggers of the daily run with one a day at 06:00 in Zagreb, and leaves other triggers alone', () => {
    const { script, run } = appsScript({}, ['runPrices', 'somethingElse', 'runPrices'])
    script.installDailyTrigger!()
    expect(run.deleted).toEqual(['runPrices', 'runPrices'])
    expect(run.created).toEqual([{ handler: 'runPrices', days: 1, hour: 6, zone: 'Europe/Zagreb' }])
  })
})
