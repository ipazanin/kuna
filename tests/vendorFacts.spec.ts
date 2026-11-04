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
  it('asks profile2 by ISIN with the key as token, and reads the industry, country, exchange, market cap as text, currency and IPO', async () => {
    const vendor = answering(
      json(200, {
        country: 'US',
        currency: 'USD',
        exchange: 'NASDAQ NMS - GLOBAL MARKET',
        finnhubIndustry: 'Semiconductors',
        ipo: '2004-08-19',
        marketCapitalization: 2125400.5,
        name: 'Example Chips Inc',
        shareOutstanding: 13950.2,
        ticker: 'EXC',
      }),
    )
    expect(await finnhub.profile(vendor.fetch, 'made-up-key', { isin: 'US0000000001', symbol: 'EXC' })).toEqual({
      kind: 'profile',
      industry: 'Semiconductors',
      country: 'US',
      exchange: 'NASDAQ NMS - GLOBAL MARKET',
      marketCap: '2125400.5',
      currency: 'USD',
      ipo: '2004-08-19',
    })
    expect(vendor.asked).toEqual(['https://finnhub.io/api/v1/stock/profile2?isin=US0000000001&token=made-up-key'])
  })

  it('asks by symbol without an ISIN, and reads an empty answer as a profile of nulls', async () => {
    const vendor = answering(json(200, {}))
    expect(await finnhub.profile(vendor.fetch, 'made-up-key', { isin: null, symbol: 'EXC' })).toEqual({
      kind: 'profile',
      industry: null,
      country: null,
      exchange: null,
      marketCap: null,
      currency: null,
      ipo: null,
    })
    expect(vendor.asked[0]).toContain('/stock/profile2?symbol=EXC&')
  })

  it('reads a market cap of zero, below zero or as text as none', async () => {
    const marketCapOf = async (marketCapitalization: unknown) =>
      ((await finnhub.profile(answering(json(200, { marketCapitalization })).fetch, 'made-up-key', { isin: null, symbol: 'EXC' })) as { readonly marketCap?: unknown }).marketCap
    expect(await marketCapOf(0)).toBeNull()
    expect(await marketCapOf(-5)).toBeNull()
    expect(await marketCapOf('2125400.5')).toBeNull()
    expect(await marketCapOf(1415993)).toBe('1415993')
  })

  it('reads a bad key as refused, a paid endpoint as for paid keys, 429 as the limit and a server error as no answer', async () => {
    const ask = (answer: VendorAnswer) => finnhub.profile(answering(answer).fetch, 'made-up-key', { isin: null, symbol: 'EXC' })
    expect(await ask(json(401, { error: 'Invalid API key' }))).toEqual({ kind: 'failed', reason: 'refused' })
    expect(await ask(json(403, { error: "You don't have access to this resource." }))).toEqual({ kind: 'failed', reason: 'not-on-free-key' })
    expect(await ask(json(429, { error: 'API limit reached.' }))).toEqual({ kind: 'failed', reason: 'limit' })
    expect(await ask({ status: 503, text: 'Service Unavailable' })).toEqual({ kind: 'failed', reason: 'no-answer' })
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

describe("Alpha Vantage's fund profiles, dividends and search", () => {
  it('reads every part of an ETF_PROFILE answer and counts its holdings', async () => {
    const vendor = answering(
      json(200, {
        net_assets: '18200000000',
        net_expense_ratio: '0.0019',
        portfolio_turnover: '0.04',
        dividend_yield: '0.0145',
        inception_date: '2019-07-23',
        leveraged: 'NO',
        sectors: [
          { sector: 'INFORMATION TECHNOLOGY', weight: '0.251' },
          { sector: 'HEALTHCARE', weight: '0.1' },
        ],
        holdings: [
          { symbol: 'EXA', description: 'EXAMPLE HOLDING A', weight: '0.05' },
          { symbol: 'EXB', description: 'EXAMPLE HOLDING B', weight: '0.04' },
          { symbol: 'EXC', description: 'EXAMPLE HOLDING C', weight: '0.03' },
        ],
      }),
    )
    expect(await alphaVantage.fundProfile(vendor.fetch, 'av-key-made-up', 'EXF')).toEqual({
      kind: 'fund-profile',
      expenseRatio: '0.0019',
      netAssets: '18200000000',
      inception: '2019-07-23',
      leveraged: 'NO',
      holdings: 3,
      dividendYield: '0.0145',
      sectors: [
        ['INFORMATION TECHNOLOGY', '0.251'],
        ['HEALTHCARE', '0.1'],
      ],
    })
    expect(new URL(vendor.asked[0]!).searchParams.get('function')).toBe('ETF_PROFILE')
  })

  it('reads an empty ETF_PROFILE answer as a fund profile with nothing in it, and leaves out a part it cannot read', async () => {
    expect(await alphaVantage.fundProfile(answering(json(200, {})).fetch, 'av-key-made-up', 'EXC')).toEqual({
      kind: 'fund-profile',
      expenseRatio: null,
      netAssets: null,
      inception: null,
      leveraged: null,
      holdings: null,
      dividendYield: null,
      sectors: [],
    })
    const partlyUnread = {
      net_expense_ratio: 'None',
      inception_date: '2019-02-30',
      holdings: [],
      sectors: [
        { sector: 'ENERGY', weight: 0.5 },
        { sector: 'FINANCIALS', weight: '0.5' },
      ],
    }
    expect(await alphaVantage.fundProfile(answering(json(200, partlyUnread)).fetch, 'av-key-made-up', 'EXF')).toMatchObject({
      expenseRatio: null,
      inception: null,
      holdings: null,
      sectors: [['FINANCIALS', '0.5']],
    })
    expect(await alphaVantage.fundProfile(answering(json(200, { holdings: 'many' })).fetch, 'av-key-made-up', 'EXF')).toEqual({ kind: 'failed', reason: 'unreadable' })
  })

  it('reads a premium note on ETF_PROFILE as for paid keys, a daily note as the limit, a bad key as refused, and any other note as a message', async () => {
    const premium = json(200, {
      Information: 'Thank you for using Alpha Vantage! This is a premium endpoint. You may subscribe to any of the premium plans to instantly unlock all premium endpoints.',
    })
    expect(await alphaVantage.fundProfile(answering(premium).fetch, 'av-key-made-up', 'EXF')).toEqual({ kind: 'failed', reason: 'not-on-free-key' })
    const day = json(200, { Information: 'Our standard API rate limit is 25 requests per day. Please subscribe to any of the premium plans.' })
    expect(await alphaVantage.fundProfile(answering(day).fetch, 'av-key-made-up', 'EXF')).toEqual({ kind: 'failed', reason: 'limit' })
    const badKey = json(200, { 'Error Message': 'the parameter apikey is invalid or missing.' })
    expect(await alphaVantage.fundProfile(answering(badKey).fetch, 'av-key-made-up', 'EXF')).toEqual({ kind: 'failed', reason: 'refused' })
    const other = json(200, { Information: 'The demo key is for demo purposes only. Please claim your free API key.' })
    expect(await alphaVantage.fundProfile(answering(other).fetch, 'av-key-made-up', 'EXF')).toEqual({ kind: 'failed', reason: 'message' })
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
