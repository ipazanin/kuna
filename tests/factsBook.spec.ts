import { describe, expect, it } from 'vitest'

import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook'
import { NO_FETCHED_FACTS, OLDER_SHAPE_ASKED } from '../src/apps/investments/prices/domain/pricesFile'
import type { FetchedFacts } from '../src/apps/investments/prices/domain/pricesFile'
import { countryOf } from '../src/apps/investments/workbook/domain/mixGroup'
import { fundFact, profileFact } from './fixtures/facts'
import { USD, decimal, instrument } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const WORLD = instrument('world', { name: 'Example World ETF', type: 'fund', prices: 'alphavantage', sourceSymbol: 'XYZ.DEX' })
const PAYER = instrument('def', { name: 'Example Dividend Co', type: 'share', currency: USD, isin: 'US000000DEF2' })
const TECH = instrument('tech', { name: 'Example Tech', type: 'share', currency: USD, isin: 'XX000000ABC1' })

function factsWith(facts: Partial<FetchedFacts>) {
  return fetchedFactsBook({ ...NO_FETCHED_FACTS, ...facts })
}

describe('the problems a holding’s facts show', () => {
  it('gives empty for a fund profile with nothing in it, and the failure for a profile the vendor refused', () => {
    const facts = factsWith({
      profiles: { 'finnhub:US000000DEF2': profileFact('2026-11-02', { failed: 'not-on-free-key' }) },
      funds: { 'alphavantage:XYZ.DEX': fundFact('2026-11-02') },
    })

    expect(facts.problemsOf(WORLD)).toEqual([{ vendor: 'alphavantage', fact: 'fund', asked: 'XYZ.DEX', askedOn: civil('2026-11-02'), failure: 'empty' }])
    expect(facts.problemsOf(PAYER)).toEqual([{ vendor: 'finnhub', fact: 'profile', asked: 'US000000DEF2', askedOn: civil('2026-11-02'), failure: 'not-on-free-key' }])
  })

  it('gives nothing for a share’s fund profile, a fund’s company profile or a fact with something in it', () => {
    const facts = factsWith({
      profiles: { 'finnhub:IE00000WORLD': profileFact('2026-11-02', { failed: 'refused' }), 'finnhub:XX000000ABC1': profileFact('2026-11-02', { country: 'US' }) },
      funds: { 'alphavantage:DEF': fundFact('2026-11-02', { failed: 'unknown-symbol' }), 'alphavantage:TECH': fundFact('2026-11-02') },
    })

    expect(facts.problemsOf(PAYER)).toEqual([])
    expect(facts.problemsOf(TECH)).toEqual([])
    expect(facts.problemsOf({ ...WORLD, isin: 'IE00000WORLD' })).toEqual([])
  })

  it('gives no problem of a holding with no type known, which may be a share a fund profile cannot fit', () => {
    const facts = factsWith({ funds: { 'alphavantage:XYZ.DEX': fundFact('2026-11-02', { failed: 'unreadable' }) } })

    expect(facts.problemsOf({ ...WORLD, type: null })).toEqual([])
  })

  it('gives no problem of a fact read from an older prices file, which the next fetch asks again', () => {
    const facts = factsWith({ funds: { 'alphavantage:XYZ.DEX': fundFact(OLDER_SHAPE_ASKED) }, profiles: { 'finnhub:US000000DEF2': profileFact(OLDER_SHAPE_ASKED) } })

    expect([facts.problemsOf(WORLD), facts.problemsOf(PAYER)]).toEqual([[], []])
  })
})

describe('a fund profile in Kuna’s words', () => {
  it('turns an expense ratio of 0.0019 into a TER of 0.19 percent and YES into leveraged', () => {
    const facts = factsWith({
      funds: {
        'alphavantage:XYZ.DEX': fundFact('2026-11-02', { expenseRatio: '0.0019', netAssets: '18200000000', inception: '2019-07-23', leveraged: 'YES', holdings: 120 }),
      },
    })

    expect(facts.fundProfileOf(WORLD)).toEqual({
      vendor: 'alphavantage',
      ter: decimal('0.19'),
      netAssets: decimal('18200000000'),
      inception: civil('2019-07-23'),
      leveraged: true,
      holdings: 120,
    })
  })

  it('reads no as not leveraged, any other word as not known, and no holdings as none', () => {
    const leveragedAs = (leveraged: string) => factsWith({ funds: { 'alphavantage:XYZ.DEX': fundFact('2026-11-02', { leveraged, holdings: 0 }) } }).fundProfileOf(WORLD)

    expect(leveragedAs(' no ')).toMatchObject({ leveraged: false, holdings: null, ter: null })
    expect(leveragedAs('PARTLY')).toMatchObject({ leveraged: null })
  })

  it('has no fund profile for an empty or failed fund fact', () => {
    expect(factsWith({ funds: { 'alphavantage:XYZ.DEX': fundFact('2026-11-02') } }).fundProfileOf(WORLD)).toBeNull()
    expect(factsWith({ funds: { 'alphavantage:XYZ.DEX': fundFact('2026-11-02', { failed: 'limit' }) } }).fundProfileOf(WORLD)).toBeNull()
  })
})

describe('a company profile in Kuna’s words', () => {
  it('gives the exchange, the market cap in the currency of the filings and the IPO day', () => {
    const facts = factsWith({
      profiles: {
        'finnhub:XX000000ABC1': profileFact('2026-11-02', {
          industry: 'Technology',
          country: 'US',
          exchange: 'NASDAQ NMS - GLOBAL MARKET',
          marketCap: '2125400.5',
          currency: 'USD',
          ipo: '2004-08-19',
        }),
      },
    })

    expect(facts.profileOf(TECH)).toEqual({
      vendor: 'finnhub',
      sector: 'information-technology',
      country: countryOf('US'),
      exchange: 'NASDAQ NMS - GLOBAL MARKET',
      marketCap: { amount: decimal('2125400.5'), currency: USD },
      ipo: civil('2004-08-19'),
    })
  })

  it('has no profile for one the vendor refused or one with nothing in it, and no market cap of zero', () => {
    expect(factsWith({ profiles: { 'finnhub:US000000DEF2': profileFact('2026-11-02', { failed: 'not-on-free-key' }) } }).profileOf(PAYER)).toBeNull()
    expect(factsWith({ profiles: { 'finnhub:US000000DEF2': profileFact('2026-11-02') } }).profileOf(PAYER)).toBeNull()
    expect(factsWith({ profiles: { 'finnhub:US000000DEF2': profileFact('2026-11-02', { marketCap: '0', currency: 'USD', country: 'US' }) } }).profileOf(PAYER)).toMatchObject({
      marketCap: null,
      country: 'US',
    })
  })
})
