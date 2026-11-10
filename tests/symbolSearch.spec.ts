import { describe, expect, it } from 'vitest'

import { instrumentTexts, withListing } from '../src/apps/investments/holdings/presentation/instrumentForm'
import { createSymbolSearch } from '../src/apps/investments/prices/application/symbolSearch'
import type { SearchedListing } from '../src/apps/investments/prices/application/symbolSearch'
import type { VendorAnswer } from '../src/apps/investments/prices/application/priceVendor'
import { fakeVendorFetch } from '../src/apps/investments/prices/infrastructure/fake/fakeVendorAnswers'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'

const KEYS: Readonly<Record<string, string>> = { twelvedata: 'td-key-made-up', alphavantage: 'av-key-made-up', finnhub: 'fh-key-made-up' }

/** The search with the fake vendors and the keys given, keeping the host and path of each request. */
function searchWith(keys: Readonly<Record<string, string>>, answers: ReadonlyMap<string, VendorAnswer> = new Map()) {
  const asked: string[] = []
  const search = createSymbolSearch(PRICE_VENDORS, {
    async fetch(url) {
      const address = new URL(url)
      asked.push(`${address.hostname}${address.pathname} ${address.searchParams.get('function') ?? ''}`.trim())
      return [...answers].find(([part]) => url.includes(part))?.[1] ?? fakeVendorFetch(url)
    },
    pause: async () => {},
    key: (vendorId) => keys[vendorId] ?? null,
  })
  return { search, asked }
}

describe('the search of the instrument dialog', () => {
  it('asks Twelve Data and Finnhub, keeps Alpha Vantage’s day when they found something, and merges by symbol and market', async () => {
    const { search, asked } = searchWith(KEYS)
    const result = await search.search('abc')

    expect(asked.sort()).toEqual(['api.twelvedata.com/symbol_search', 'finnhub.io/api/v1/search'])
    expect(result.listings.map((listing) => [listing.symbol, listing.mic ?? listing.market, listing.foundBy, listing.sources, listing.proposedType])).toEqual([
      ['ABC', 'XNAS', ['Twelve Data'], ['twelvedata'], 'share'],
      ['ABC', null, ['Finnhub'], [], 'share'],
    ])
    expect(result.failures).toEqual([])
  })

  it('asks Alpha Vantage when the others found nothing, and says why a vendor found nothing', async () => {
    const nothing = { status: 200, text: JSON.stringify({ data: [], status: 'ok' }) }
    const { search, asked } = searchWith(
      KEYS,
      new Map([
        ['symbol_search', nothing],
        ['/api/v1/search', { status: 401, text: '{"error":"Invalid API key"}' }],
      ]),
    )
    const result = await search.search('xyz')

    expect(asked).toContain('www.alphavantage.co/query SYMBOL_SEARCH')
    expect(result.listings.map((listing) => [listing.symbol, listing.foundBy, listing.sources, listing.proposedType])).toEqual([
      ['XYZ', ['Alpha Vantage'], ['alphavantage'], 'share'],
      ['XYZ.DEX', ['Alpha Vantage'], ['alphavantage'], 'fund'],
    ])
    expect(result.failures).toEqual([{ vendor: 'Finnhub', reason: 'refused' }])
  })

  it('offers Twelve Data as a source only for a listing its free key prices', async () => {
    const result = await searchWith(KEYS).search.search('xyz')

    expect(result.listings.map((listing) => [listing.symbol, listing.mic, listing.sources])).toEqual([
      ['XYZ', 'XNAS', ['twelvedata']],
      ['XYZ', 'XETR', []],
      ['XYZ', null, []],
    ])
  })

  it('cannot search without a key of a vendor that searches', () => {
    expect(searchWith({}).search.canSearch()).toBe(false)
    expect(searchWith({ finnhub: KEYS.finnhub! }).search.canSearch()).toBe(true)
  })
})

describe('a listing picked in the instrument dialog', () => {
  const listing: SearchedListing = {
    symbol: 'XYZ.DEX',
    name: 'Example World UCITS ETF',
    mic: 'XETR',
    market: 'XETRA',
    currency: 'EUR',
    type: 'ETF',
    foundBy: ['Finnhub', 'Alpha Vantage'],
    sources: ['alphavantage'],
    proposedType: 'fund',
  }

  it('fills a blank symbol, the name, the proposed type, the exchange, the currency and the vendor that prices it with its symbol there', () => {
    expect(withListing(instrumentTexts(null), listing)).toMatchObject({
      symbol: 'XYZ.DEX',
      name: 'Example World UCITS ETF',
      type: 'fund',
      exchange: 'XETR',
      currency: 'EUR',
      prices: 'alphavantage',
      sourceSymbol: 'XYZ.DEX',
    })
  })

  it('keeps a typed symbol and name, the source when no vendor of the listing prices it on a free key, and a type the quoting does not allow', () => {
    const typed = { ...instrumentTexts(null), symbol: 'XYZ', name: 'My world fund', prices: 'manual' as const }
    expect(withListing(typed, { ...listing, sources: [] })).toMatchObject({ symbol: 'XYZ', name: 'My world fund', prices: 'manual', sourceSymbol: '', type: 'fund' })
    expect(withListing({ ...typed, type: 'bond', quoted: 'percent' }, listing)).toMatchObject({ symbol: 'XYZ', type: 'bond', prices: 'alphavantage', sourceSymbol: 'XYZ.DEX' })
  })

  it('leaves Twelve Data off a European listing its search found, as its free key prices none', () => {
    const european: SearchedListing = { ...listing, symbol: 'XYZ', foundBy: ['Twelve Data'], sources: [], type: 'ETF' }
    expect(withListing(instrumentTexts(null), european)).toMatchObject({ symbol: 'XYZ', prices: 'twelvedata', sourceSymbol: '', exchange: 'XETR' })
  })

  it('keeps the source already chosen when it is one of the vendors that price the listing', () => {
    const both: SearchedListing = { ...listing, sources: ['twelvedata', 'alphavantage'] }
    expect(withListing({ ...instrumentTexts(null), prices: 'alphavantage' }, both)).toMatchObject({ prices: 'alphavantage', sourceSymbol: 'XYZ.DEX' })
  })
})
