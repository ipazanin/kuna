import { describe, expect, it } from 'vitest'

import { fetchQuotes, quotesOff, quotesToAsk } from '../src/apps/investments/prices/application/quoteFetch'
import type { QuoteClock } from '../src/apps/investments/prices/application/quoteFetch'
import type { VendorAnswer } from '../src/apps/investments/prices/application/priceVendor'
import { alphaVantage } from '../src/apps/investments/prices/infrastructure/vendors/alphaVantage'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'
import { twelveData } from '../src/apps/investments/prices/infrastructure/vendors/twelveData'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { account, book, cashMovement, decimal, instrument, trade } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const BROKER = account('broker', 'Broker')
const US_SHARE = instrument('abc')
const SOLD_SHARE = instrument('def')
const EUROPEAN = ['xyz.dex', 'eqq.as', 'wld.dex', 'emu.dex'].map((symbol) => instrument(symbol.split('.')[0]!, { prices: 'alphavantage', sourceSymbol: symbol.toUpperCase() }))

/** Made-up records: a US share held, one sold, and four European listings held. */
const HELD: InvestmentBook = book({
  accounts: [BROKER],
  instruments: [US_SHARE, SOLD_SHARE, ...EUROPEAN],
  cashMovements: [cashMovement('deposit', BROKER, '2026-01-02', '50000')],
  trades: [
    trade('buy', BROKER, US_SHARE, '2026-01-05', '10', '100', '0'),
    trade('buy', BROKER, SOLD_SHARE, '2026-01-05', '10', '100', '0'),
    trade('sell', BROKER, SOLD_SHARE, '2026-02-05', '10', '110', '0'),
    ...EUROPEAN.map((listing) => trade('buy', BROKER, listing, '2026-01-06', '5', '90', '0')),
  ],
})

const KEYS: Readonly<Record<string, string>> = { twelvedata: 'td-key-made-up', alphavantage: 'av-key-made-up' }

/** Monday 16 November 2026 at a time in Zagreb, an hour ahead of UTC. */
function mondayAt(zagrebTime: string): QuoteClock {
  const [hour, minute] = zagrebTime.split(':').map(Number)
  return { at: new Date(Date.UTC(2026, 10, 16, hour! - 1, minute!)).toISOString(), day: civil('2026-11-16') }
}

function json(body: unknown): VendorAnswer {
  return { status: 200, text: JSON.stringify(body) }
}

/** Answers every quote, the Twelve Data one live and the Alpha Vantage one at the close, refusing the symbols in `refused`. */
function answering(asked: string[], refused: readonly string[] = []) {
  return {
    key: (vendorId: string) => KEYS[vendorId] ?? null,
    pause: async () => {},
    fetch: async (url: string): Promise<VendorAnswer> => {
      const symbol = new URL(url).searchParams.get('symbol') ?? ''
      asked.push(symbol)
      if (refused.includes(symbol)) {
        return json({ 'Error Message': 'Invalid API call.' })
      }
      return url.startsWith('https://api.twelvedata.com/')
        ? json({ symbol, datetime: '2026-11-16', close: '104.20', is_market_open: true, last_quote_at: 1_794_843_600 })
        : json({ 'Global Quote': { '01. symbol': symbol, '05. price': '91.5000', '07. latest trading day': '2026-11-16' } })
    },
  }
}

describe('quotesToAsk', () => {
  it('asks the US holding held before Europe has closed, and no listing sold or of a vendor without a key', () => {
    expect(quotesToAsk(PRICE_VENDORS, HELD, mondayAt('16:40'), null, (vendorId) => vendorId in KEYS).map(({ series }) => series)).toEqual(['twelvedata:ABC'])
    expect(quotesToAsk(PRICE_VENDORS, HELD, mondayAt('16:40'), null, () => false)).toEqual([])
  })

  it('asks at most three European listings a day once their markets have closed', () => {
    const asks = quotesToAsk(PRICE_VENDORS, HELD, mondayAt('18:05'), null, (vendorId) => vendorId in KEYS)

    expect(asks.filter(({ vendor }) => vendor.id === 'alphavantage')).toHaveLength(3)
    expect(asks.filter(({ vendor }) => vendor.id === 'twelvedata')).toHaveLength(1)
  })

  it('asks no European listing on a weekend', () => {
    const saturday = { at: '2026-11-21T19:00:00.000Z', day: civil('2026-11-21') }

    expect(quotesToAsk(PRICE_VENDORS, HELD, saturday, null, (vendorId) => vendorId in KEYS).map(({ vendor }) => vendor.id)).toEqual(['twelvedata'])
  })
})

describe('quotesOff', () => {
  /** Made-up records: the four European listings alone, which Alpha Vantage quotes after their close. */
  const EUROPEAN_ONLY: InvestmentBook = book({
    accounts: [BROKER],
    instruments: EUROPEAN,
    cashMovements: [cashMovement('deposit', BROKER, '2026-01-02', '50000')],
    trades: EUROPEAN.map((listing) => trade('buy', BROKER, listing, '2026-01-06', '5', '90', '0')),
  })
  const keyKept = (vendorId: string): boolean => vendorId in KEYS

  it('waits for the close hour before it and turns on once the clock passes it', () => {
    expect(quotesOff(PRICE_VENDORS, EUROPEAN_ONLY, mondayAt('15:00'), null, keyKept)).toEqual({ kind: 'before-close', fromHour: 18 })
    expect(quotesOff(PRICE_VENDORS, EUROPEAN_ONLY, mondayAt('17:59'), null, keyKept)).toEqual({ kind: 'before-close', fromHour: 18 })
    expect(quotesOff(PRICE_VENDORS, EUROPEAN_ONLY, mondayAt('18:00'), null, keyKept)).toBeNull()
  })

  it('says the closes are in once the day’s asks are spent, and that a key is missing without one', () => {
    const spent = { day: civil('2026-11-16'), quotes: [], askedOnce: ['alphavantage:XYZ.DEX', 'alphavantage:EQQ.AS', 'alphavantage:WLD.DEX'] }

    expect(quotesOff(PRICE_VENDORS, EUROPEAN_ONLY, mondayAt('19:00'), spent, keyKept)).toEqual({ kind: 'all-in' })
    expect(quotesOff(PRICE_VENDORS, EUROPEAN_ONLY, mondayAt('19:00'), null, () => false)).toEqual({ kind: 'no-key' })
  })

  it('says the closes are in on a weekend, when no close is still to come', () => {
    const saturday = { at: '2026-11-21T10:00:00.000Z', day: civil('2026-11-21') }

    expect(quotesOff(PRICE_VENDORS, EUROPEAN_ONLY, saturday, null, keyKept)).toEqual({ kind: 'all-in' })
  })
})

describe('fetchQuotes', () => {
  it('keeps the day’s quotes and counts a refused Alpha Vantage answer as asked, so a second click asks it no more', async () => {
    const asked: string[] = []
    const first = await fetchQuotes(answering(asked, ['EQQ.AS']), PRICE_VENDORS, HELD, mondayAt('18:05'), null)

    expect(first.asked).toBe(4)
    expect(first.failed).toBe(1)
    expect(first.quoted.quotes.map((quote) => [quote.series, quote.price])).toEqual([
      ['twelvedata:ABC', decimal('104.20')],
      ['alphavantage:XYZ.DEX', decimal('91.5000')],
      ['alphavantage:WLD.DEX', decimal('91.5000')],
    ])
    expect(first.quoted.askedOnce).toEqual(['alphavantage:XYZ.DEX', 'alphavantage:EQQ.AS', 'alphavantage:WLD.DEX'])

    asked.length = 0
    const second = await fetchQuotes(answering(asked), PRICE_VENDORS, HELD, mondayAt('20:30'), first.quoted)

    // The day's three are spent, so the fourth European listing waits for tomorrow's fetch.
    expect(asked).toEqual(['ABC'])
    expect(second.quoted.quotes).toHaveLength(3)
  })

  it('starts afresh on a new day', async () => {
    const asked: string[] = []
    const earlier = { day: civil('2026-11-13'), quotes: [], askedOnce: ['alphavantage:XYZ.DEX', 'alphavantage:EQQ.AS', 'alphavantage:WLD.DEX'] }
    await fetchQuotes(answering(asked), PRICE_VENDORS, HELD, mondayAt('18:05'), earlier)

    expect(asked).toEqual(['ABC', 'XYZ.DEX', 'EQQ.AS', 'WLD.DEX'])
  })
})

describe('the quote parsers', () => {
  const fetchOf = (body: unknown) => async (): Promise<VendorAnswer> => json(body)

  it.each([
    ['0.8', '0.8'],
    ['104.20', '104.20'],
    ['0.08123', '0.08123'],
  ])('Twelve Data reads the close %s as %s in the quote currency', async (close, price) => {
    expect(await twelveData.quote!(fetchOf({ datetime: '2026-11-16', close, is_market_open: false }), 'key', 'ABC')).toEqual({
      kind: 'quote',
      price,
      day: '2026-11-16',
      at: null,
      marketOpen: false,
    })
  })

  it.each([
    ['0.8000', '0.8000'],
    ['91.5000', '91.5000'],
  ])('Alpha Vantage reads the price %s as %s, at the close', async (close, price) => {
    expect(await alphaVantage.quote!(fetchOf({ 'Global Quote': { '05. price': close, '07. latest trading day': '2026-11-16' } }), 'key', 'XYZ.DEX')).toEqual({
      kind: 'quote',
      price,
      day: '2026-11-16',
      at: null,
      marketOpen: false,
    })
  })

  it('reads Alpha Vantage’s empty quote as an unknown symbol and a Twelve Data error as a failure', async () => {
    expect(await alphaVantage.quote!(fetchOf({ 'Global Quote': {} }), 'key', 'NONE.DEX')).toEqual({ kind: 'failed', reason: 'unknown-symbol' })
    expect(await twelveData.quote!(fetchOf({ status: 'error', code: 403, message: 'Pro plan' }), 'key', 'XETR:ABC')).toEqual({ kind: 'failed', reason: 'not-on-free-key' })
    expect(await twelveData.quote!(fetchOf({}), null, 'ABC')).toEqual({ kind: 'failed', reason: 'no-key' })
  })
})
