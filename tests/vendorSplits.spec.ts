import { describe, expect, it } from 'vitest'

import { createSplitLookup } from '../src/apps/investments/prices/application/splitLookup'
import type { VendorFetch } from '../src/apps/investments/prices/application/priceVendor'
import { splitRatioOf } from '../src/apps/investments/prices/domain/splitFactor'
import { fakeVendorFetch } from '../src/apps/investments/prices/infrastructure/fake/fakeVendorAnswers'
import { alphaVantage } from '../src/apps/investments/prices/infrastructure/vendors/alphaVantage'

/** A fetch that answers every request with the same body, keeping the addresses asked for. */
function answering(status: number, body: unknown): { fetch: VendorFetch; asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    fetch: async (url) => {
      asked.push(url)
      return { status, text: typeof body === 'string' ? body : JSON.stringify(body) }
    },
  }
}

describe('a split factor', () => {
  it('is a split only as a ratio of small whole numbers', () => {
    expect([4, 1.5, 0.1, 2, 0.3333, 0.01].map(splitRatioOf)).toEqual([
      { newUnits: 4, oldUnits: 1 },
      { newUnits: 3, oldUnits: 2 },
      { newUnits: 1, oldUnits: 10 },
      { newUnits: 2, oldUnits: 1 },
      { newUnits: 1, oldUnits: 3 },
      { newUnits: 1, oldUnits: 100 },
    ])
    // A price adjustment, such as a spin-off shown as a factor, is no split even where 91 for 87 comes close.
    expect([1.046, 1, 0, -2, 1.0001].map(splitRatioOf)).toEqual([null, null, null, null, null])
  })
})

describe("Alpha Vantage's splits", () => {
  it('reads the documented answer, leaving out a factor that is no split, and asks with the key', async () => {
    const { fetch, asked } = answering(200, {
      symbol: 'IBM',
      data: [
        { effective_date: '2021-11-04', split_factor: '1.0460' },
        { effective_date: '1999-05-27', split_factor: '2.0000' },
      ],
    })
    expect(await alphaVantage.splits(fetch, 'MADEUPKEY01', 'IBM')).toEqual({ kind: 'splits', splits: [{ date: '1999-05-27', newUnits: '2', oldUnits: '1' }] })
    expect(asked).toEqual(['https://www.alphavantage.co/query?function=SPLITS&symbol=IBM&apikey=MADEUPKEY01'])
  })

  it('answers as the closes do for a limit note, a premium note, an unknown symbol, an answer it cannot read and no key', async () => {
    const cases: [number, unknown, string][] = [
      [200, { Information: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.' }, 'limit'],
      [200, { Information: 'This is a premium endpoint.' }, 'not-on-free-key'],
      [200, { 'Error Message': 'Invalid API call.' }, 'unknown-symbol'],
      [200, { symbol: 'IBM', data: [{ effective_date: 'soon', split_factor: '2.0000' }] }, 'unreadable'],
      [200, 'not json', 'unreadable'],
      [429, '', 'limit'],
    ]
    for (const [status, body, reason] of cases) {
      expect(await alphaVantage.splits(answering(status, body).fetch, 'MADEUPKEY01', 'IBM')).toEqual({ kind: 'failed', reason })
    }
    expect(await alphaVantage.splits(answering(200, {}).fetch, null, 'IBM')).toEqual({ kind: 'failed', reason: 'no-key' })
  })
})

describe('the split lookup', () => {
  it("asks the fake build's vendor for each symbol, counting each, and the made-up workbook's split is listed", async () => {
    const lookup = createSplitLookup(alphaVantage, { fetch: fakeVendorFetch, pause: async () => {}, key: () => 'MADEUPKEY01' })
    const counted: [number, number][] = []
    const found = await lookup.lookUp(['ABC', 'DEF'], (asked, of) => counted.push([asked, of]))
    expect([...found]).toEqual([
      ['ABC', { kind: 'splits', splits: [{ date: '2025-06-10', newUnits: '2', oldUnits: '1' }] }],
      ['DEF', { kind: 'splits', splits: [] }],
    ])
    expect(counted).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ])
  })

  it('asks nothing without a key', async () => {
    const { fetch, asked } = answering(200, { data: [] })
    const lookup = createSplitLookup(alphaVantage, { fetch, pause: async () => {}, key: () => null })
    expect(lookup.hasKey()).toBe(false)
    expect([...(await lookup.lookUp(['ABC'], () => {}))]).toEqual([])
    expect(asked).toEqual([])
  })

  it("counts every request against the vendor's limit a day, however many lookups ask", async () => {
    const { fetch, asked } = answering(200, { symbol: 'ABC', data: [] })
    const lookup = createSplitLookup(alphaVantage, { fetch, pause: async () => {}, key: () => 'MADEUPKEY01' })
    const symbols = Array.from({ length: 20 }, (_, index) => `S${index}`)
    await lookup.lookUp(symbols, () => {})
    const second = await lookup.lookUp(symbols, () => {})
    expect(asked).toHaveLength(alphaVantage.limits.perDay!)
    expect(second.get('S19')).toEqual({ kind: 'failed', reason: 'limit' })
  })
})
