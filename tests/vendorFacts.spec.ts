import { describe, expect, it } from 'vitest'

import type { VendorAnswer, VendorFetch } from '../src/apps/investments/prices/application/priceVendor'
import { testVendor } from '../src/apps/investments/prices/application/vendorTest'
import { alphaVantage } from '../src/apps/investments/prices/infrastructure/vendors/alphaVantage'
import { finnhub } from '../src/apps/investments/prices/infrastructure/vendors/finnhub'
import { twelveData } from '../src/apps/investments/prices/infrastructure/vendors/twelveData'
import { civil } from './fixtures/ledger'

// The answers below follow the shapes of the vendors' documentation, with made-up companies and figures.

function json(status: number, body: unknown): VendorAnswer {
  return { status, text: JSON.stringify(body) }
}

/** A fetch that answers every request with the same answer and keeps each address asked. */
function answering(answer: VendorAnswer): { readonly fetch: VendorFetch; readonly asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    fetch: async (url) => {
      asked.push(url)
      return answer
    },
  }
}

describe("Finnhub's profiles and search", () => {
  it('asks profile2 by ISIN with the key as token, and reads the industry and the country', async () => {
    const vendor = answering(json(200, { country: 'US', currency: 'USD', finnhubIndustry: 'Semiconductors', name: 'Example Chips Inc', ticker: 'EXC' }))
    expect(await finnhub.profile(vendor.fetch, 'made-up-key', { isin: 'US0000000001', symbol: 'EXC' })).toEqual({ kind: 'profile', industry: 'Semiconductors', country: 'US' })
    expect(vendor.asked).toEqual(['https://finnhub.io/api/v1/stock/profile2?isin=US0000000001&token=made-up-key'])
  })

  it('asks by symbol without an ISIN, and reads an empty answer as a profile of nulls', async () => {
    const vendor = answering(json(200, {}))
    expect(await finnhub.profile(vendor.fetch, 'made-up-key', { isin: null, symbol: 'EXC' })).toEqual({ kind: 'profile', industry: null, country: null })
    expect(vendor.asked[0]).toContain('/stock/profile2?symbol=EXC&')
  })

  it('reads a bad key as refused, a paid endpoint as for paid keys and 429 as the limit', async () => {
    const ask = (answer: VendorAnswer) => finnhub.profile(answering(answer).fetch, 'made-up-key', { isin: null, symbol: 'EXC' })
    expect(await ask(json(401, { error: 'Invalid API key' }))).toEqual({ kind: 'failed', reason: 'refused' })
    expect(await ask(json(403, { error: "You don't have access to this resource." }))).toEqual({ kind: 'failed', reason: 'not-on-free-key' })
    expect(await ask(json(429, { error: 'API limit reached.' }))).toEqual({ kind: 'failed', reason: 'limit' })
    expect(finnhub.limitOf(json(429, {}))).toBe('minute')
  })

  it('reads its search results as listings with no market and no currency', async () => {
    const vendor = answering(json(200, { count: 1, result: [{ description: 'EXAMPLE CHIPS INC', displaySymbol: 'EXC', symbol: 'EXC', type: 'Common Stock' }] }))
    expect(await finnhub.search(vendor.fetch, 'made-up-key', 'exc')).toEqual({
      kind: 'found',
      listings: [{ symbol: 'EXC', name: 'EXAMPLE CHIPS INC', mic: null, market: null, currency: null, type: 'Common Stock', freeCloses: false }],
    })
  })

  it('tests a key with the profile of its test symbol', async () => {
    const vendor = answering(json(200, { country: 'US', finnhubIndustry: 'Technology' }))
    expect(await testVendor(finnhub, vendor.fetch, 'made-up-key', civil('2026-11-02'))).toEqual({ kind: 'works' })
    expect(vendor.asked[0]).toContain('symbol=AAPL')
  })
})

describe("Alpha Vantage's fund weights, dividends and search", () => {
  it('reads ETF_PROFILE sectors as names and fractions as sent, an answer with none as empty, and leaves out a row it cannot read', async () => {
    const vendor = answering(
      json(200, {
        net_assets: '1000000',
        sectors: [
          { sector: 'INFORMATION TECHNOLOGY', weight: '0.251' },
          { sector: 'HEALTHCARE', weight: '0.1' },
        ],
        holdings: [],
      }),
    )
    expect(await alphaVantage.fundSectors(vendor.fetch, 'made-up-key', 'EXF')).toEqual({
      kind: 'fund-sectors',
      sectors: [
        ['INFORMATION TECHNOLOGY', '0.251'],
        ['HEALTHCARE', '0.1'],
      ],
    })
    expect(new URL(vendor.asked[0]!).searchParams.get('function')).toBe('ETF_PROFILE')
    expect(await alphaVantage.fundSectors(answering(json(200, {})).fetch, 'made-up-key', 'EXC')).toEqual({ kind: 'fund-sectors', sectors: [] })
    const oneUnread = {
      sectors: [
        { sector: 'ENERGY', weight: 0.5 },
        { sector: 'FINANCIALS', weight: '0.5' },
      ],
    }
    expect(await alphaVantage.fundSectors(answering(json(200, oneUnread)).fetch, 'made-up-key', 'EXF')).toEqual({ kind: 'fund-sectors', sectors: [['FINANCIALS', '0.5']] })
  })

  it('reads DIVIDENDS with a known ex day and payment day, oldest payment first, leaving out one whose days are None and rows it cannot read', async () => {
    const vendor = answering(
      json(200, {
        symbol: 'EXC',
        data: [
          { ex_dividend_date: '2026-11-14', declaration_date: '2026-10-30', record_date: '2026-11-14', payment_date: '2026-12-15', amount: '0.31' },
          { ex_dividend_date: '2026-08-14', declaration_date: 'None', record_date: 'None', payment_date: 'None', amount: '0.30' },
          { ex_dividend_date: '2026-02-14', payment_date: '2026-03-15', amount: 0.29 },
          'not a row',
          { ex_dividend_date: '2026-05-14', declaration_date: '2026-04-30', record_date: '2026-05-15', payment_date: '2026-06-15', amount: '0.30' },
        ],
      }),
    )
    expect(await alphaVantage.dividends(vendor.fetch, 'made-up-key', 'EXC')).toEqual({
      kind: 'dividends',
      dividends: [
        ['2026-05-14', '2026-06-15', '0.30'],
        ['2026-11-14', '2026-12-15', '0.31'],
      ],
    })
  })

  it('reads SYMBOL_SEARCH best matches with their type, region and currency, and its notes as Alpha Vantage’s limits', async () => {
    const match = { '1. symbol': 'EXF.DEX', '2. name': 'Example World UCITS ETF', '3. type': 'ETF', '4. region': 'XETRA', '5. marketOpen': '08:00', '8. currency': 'EUR', '9. matchScore': '0.8' }
    expect(await alphaVantage.search(answering(json(200, { bestMatches: [match] })).fetch, 'made-up-key', 'EXF')).toEqual({
      kind: 'found',
      listings: [{ symbol: 'EXF.DEX', name: 'Example World UCITS ETF', mic: null, market: 'XETRA', currency: 'EUR', type: 'ETF', freeCloses: true }],
    })
    const note = json(200, { Information: 'Our standard API rate limit is 25 requests per day.' })
    expect(await alphaVantage.search(answering(note).fetch, 'made-up-key', 'EXF')).toEqual({ kind: 'failed', reason: 'limit' })
  })
})

describe("Twelve Data's search", () => {
  it('reads symbol_search with its market code and type, a US listing as priced by the free key, and an answer of no data as nothing found', async () => {
    const vendor = answering(
      json(200, {
        data: [
          {
            symbol: 'EXC',
            instrument_name: 'Example Chips Inc',
            exchange: 'NASDAQ',
            mic_code: 'XNGS',
            exchange_timezone: 'America/New_York',
            instrument_type: 'Common Stock',
            country: 'United States',
            currency: 'USD',
          },
          {
            symbol: 'EXE',
            instrument_name: 'Example Chips SE',
            exchange: 'XETR',
            mic_code: 'XETR',
            exchange_timezone: 'Europe/Berlin',
            instrument_type: 'Common Stock',
            country: 'Germany',
            currency: 'EUR',
          },
        ],
        status: 'ok',
      }),
    )
    expect(await twelveData.search(vendor.fetch, 'made-up-key', 'EXC')).toEqual({
      kind: 'found',
      listings: [
        { symbol: 'EXC', name: 'Example Chips Inc', mic: 'XNGS', market: 'NASDAQ', currency: 'USD', type: 'Common Stock', freeCloses: true },
        { symbol: 'EXE', name: 'Example Chips SE', mic: 'XETR', market: 'XETR', currency: 'EUR', type: 'Common Stock', freeCloses: false },
      ],
    })
    expect(vendor.asked[0]).toMatch(/^https:\/\/api\.twelvedata\.com\/symbol_search\?symbol=EXC&outputsize=30&apikey=made-up-key$/)
    expect(await twelveData.search(answering(json(400, { code: 400, message: 'No data is available on the specified dates.', status: 'error' })).fetch, 'made-up-key', 'NONE')).toEqual({
      kind: 'found',
      listings: [],
    })
  })
})
