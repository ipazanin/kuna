// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { createPricesUpdate } from '../src/apps/investments/prices/application/pricesUpdate'
import type { PricesUpdate } from '../src/apps/investments/prices/application/pricesUpdate'
import type { PricesCache, PricesCopy } from '../src/apps/investments/prices/application/pricesPorts'
import type { VendorAnswer } from '../src/apps/investments/prices/application/priceVendor'
import { quoteAsksOn, rememberQuoteAsks } from '../src/apps/investments/prices/infrastructure/vendorUsage'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { account, book, cashMovement, decimal, instrument, trade } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const BROKER = account('broker', 'Broker')
const US_SHARE = instrument('abc')
const EUROPEAN = ['xyz.dex', 'eqq.as', 'wld.dex'].map((symbol) => instrument(symbol.split('.')[0]!, { prices: 'alphavantage', sourceSymbol: symbol.toUpperCase() }))

/** Made-up records: a US share and three European listings held. */
const HELD: InvestmentBook = book({
  accounts: [BROKER],
  instruments: [US_SHARE, ...EUROPEAN],
  cashMovements: [cashMovement('deposit', BROKER, '2026-01-02', '50000')],
  trades: [trade('buy', BROKER, US_SHARE, '2026-01-05', '10', '100', '0'), ...EUROPEAN.map((listing) => trade('buy', BROKER, listing, '2026-01-06', '5', '90', '0'))],
})

const KEYS: Readonly<Record<string, string>> = { twelvedata: 'td-key-made-up', alphavantage: 'av-key-made-up' }
const MONDAY = civil('2026-11-16')

function json(body: unknown): VendorAnswer {
  return { status: 200, text: JSON.stringify(body) }
}

/** A cache of the prices copy that lives in the spec, since the reload this spec is about keeps no prices file. */
function memoryCache(): PricesCache {
  let held: PricesCopy | null = null
  return {
    replace: async (copy) => {
      held = copy
    },
    read: async () => held,
    delete: async () => {
      held = null
    },
    close: () => {},
  }
}

/** One page of this browser at a Zagreb time on Monday 16 November 2026, noting each symbol it asks a vendor for. */
function pageAt(zagrebTime: string, asked: string[], investmentsFileId = 'made-up-investments'): PricesUpdate {
  const [hour, minute] = zagrebTime.split(':').map(Number)
  const at = new Date(Date.UTC(2026, 10, 16, hour! - 1, minute!)).toISOString()
  const cache = memoryCache()
  return createPricesUpdate({
    place: async () => ({ investmentsFileId, cache, drive: null }),
    investments: () => HELD,
    vendors: PRICE_VENDORS,
    fetch: async (url) => {
      const symbol = new URL(url).searchParams.get('symbol') ?? ''
      asked.push(symbol)
      return url.startsWith('https://api.twelvedata.com/')
        ? json({ symbol, datetime: '2026-11-16', close: '104.20', is_market_open: true, last_quote_at: 1_794_843_600 })
        : json({ 'Global Quote': { '01. symbol': symbol, '05. price': '91.5000', '07. latest trading day': '2026-11-16' } })
    },
    pause: async () => {},
    key: (vendorId) => KEYS[vendorId] ?? null,
    exclusively: async (run) => run(),
    now: () => at,
    newRevision: () => 'browser-made-up',
    keptQuotes: quoteAsksOn,
    keepQuotes: rememberQuoteAsks,
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('a reload on the day of a Fetch today click', () => {
  it('shows the European closes the click brought and asks Alpha Vantage nothing more, while the live US quote is asked again', async () => {
    const before = pageAt('18:30', [])
    await before.open()
    await before.fetchQuotes()
    expect(before.state.quoted?.quotes).toHaveLength(4)

    const asked: string[] = []
    const reloaded = pageAt('19:00', asked)
    await reloaded.open()

    expect(reloaded.state.quoted?.day).toBe(MONDAY)
    expect(reloaded.state.quoted?.quotes.map((quote) => [quote.series, quote.price])).toEqual([
      ['alphavantage:XYZ.DEX', decimal('91.5000')],
      ['alphavantage:EQQ.AS', decimal('91.5000')],
      ['alphavantage:WLD.DEX', decimal('91.5000')],
    ])
    expect(reloaded.quotesOff(HELD, new Date(Date.UTC(2026, 10, 16, 18, 0)).toISOString())).toBeNull()

    const fetched = await reloaded.fetchQuotes()

    expect(asked).toEqual(['ABC'])
    expect(fetched).toMatchObject({ asked: 1, failed: 0 })
    expect(reloaded.state.quoted?.quotes).toHaveLength(4)
  })

  it('shows no closes on another Investments file, which the click was not on, and still asks Alpha Vantage nothing more', async () => {
    const before = pageAt('18:30', [])
    await before.open()
    await before.fetchQuotes()

    const asked: string[] = []
    const other = pageAt('19:00', asked, 'other-made-up-investments')
    await other.open()

    expect(other.state.quoted).toBeNull()
    await other.fetchQuotes()
    expect(asked).toEqual(['ABC'])
  })

  it('shows nothing kept after a click that asked only a live quote, which a reload asks again', async () => {
    const before = pageAt('16:40', [])
    await before.open()
    await before.fetchQuotes()

    const reloaded = pageAt('16:50', [])
    await reloaded.open()

    expect(reloaded.state.quoted).toBeNull()
  })
})

describe('the entry that keeps the day’s once-a-day asks', () => {
  it('reads an entry from before the closes were kept as asks with no closes', () => {
    localStorage.setItem('kuna.price-quote-asks', JSON.stringify({ day: '2026-11-16', series: ['alphavantage:XYZ.DEX'] }))

    expect(quoteAsksOn(MONDAY)).toEqual({ quoted: { day: MONDAY, quotes: [], askedOnce: ['alphavantage:XYZ.DEX'] }, investmentsFileId: null })
  })

  it('reads another day, an entry it cannot read and a close it cannot read as nothing kept', () => {
    rememberQuoteAsks({
      quoted: { day: MONDAY, quotes: [{ series: 'alphavantage:XYZ.DEX', day: MONDAY, price: decimal('91.5'), at: null, marketOpen: false }], askedOnce: ['alphavantage:XYZ.DEX'] },
      investmentsFileId: 'made-up-investments',
    })
    expect(quoteAsksOn(civil('2026-11-17'))).toEqual({ quoted: { day: civil('2026-11-17'), quotes: [], askedOnce: [] }, investmentsFileId: null })

    localStorage.setItem('kuna.price-quote-asks', JSON.stringify({ day: '2026-11-16', series: ['alphavantage:XYZ.DEX'], quotes: [{ series: 'alphavantage:XYZ.DEX', day: 'Monday', price: '91.5' }] }))
    expect(quoteAsksOn(MONDAY).quoted.quotes).toEqual([])

    localStorage.setItem('kuna.price-quote-asks', '{')
    expect(quoteAsksOn(MONDAY)).toEqual({ quoted: { day: MONDAY, quotes: [], askedOnce: [] }, investmentsFileId: null })
  })

  it('keeps a once-a-day close and never a live quote', () => {
    rememberQuoteAsks({
      quoted: {
        day: MONDAY,
        quotes: [
          { series: 'twelvedata:ABC', day: MONDAY, price: decimal('104.2'), at: '2026-11-16T15:00:00.000Z', marketOpen: true },
          { series: 'alphavantage:XYZ.DEX', day: MONDAY, price: decimal('91.5'), at: null, marketOpen: false },
        ],
        askedOnce: ['alphavantage:XYZ.DEX'],
      },
      investmentsFileId: 'made-up-investments',
    })

    expect(quoteAsksOn(MONDAY)).toMatchObject({ investmentsFileId: 'made-up-investments' })
    expect(quoteAsksOn(MONDAY).quoted.quotes.map((quote) => quote.series)).toEqual(['alphavantage:XYZ.DEX'])
  })
})
