import { describe, expect, it } from 'vitest'

import type { HoldingFigures, Valuation } from '../src/apps/investments/holdings/domain/holding'
import { holdingDetails } from '../src/apps/investments/holdings/presentation/holdingDetails'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook'
import { NO_FETCHED_FACTS } from '../src/apps/investments/prices/domain/pricesFile'
import type { FundMixLine } from '../src/apps/investments/workbook/domain/fundMix'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import { FUND_MIX_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { countryOf } from '../src/apps/investments/workbook/domain/mixGroup'
import type { FundMixGroup } from '../src/apps/investments/workbook/domain/mixGroup'
import { DECIMAL_ZERO } from '../src/shared/money/decimal'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { book, decimal, instrument } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const NOTHING_FETCHED = fetchedFactsBook(NO_FETCHED_FACTS)

const VALUED: Valuation = { close: { date: civil('2026-10-29'), price: decimal('100'), byHand: false }, price: decimal('100'), rate: null, foreignValue: decimal('1000'), value: euros(1000) }

type Held = Pick<HoldingFigures, 'instrument' | 'quantity' | 'valuation'>

/** Ten units of it valued at €1,000.00, with no price, or none held. */
function held(what: Instrument, valuation: Valuation | null = VALUED): Held {
  return { instrument: what, quantity: decimal('10'), valuation }
}

function sold(what: Instrument): Held {
  return { instrument: what, quantity: DECIMAL_ZERO, valuation: null }
}

function mixLines(fund: Instrument, mix: FundMixGroup['mix'], percents: readonly (readonly [string, string])[]): FundMixLine[] {
  return percents.map(([group, percent]) => ({
    id: recordIdOf(FUND_MIX_RECORDS, `${fund.symbol}-${mix}-${group}`),
    instrument: fund.id,
    slice: { mix, group } as FundMixGroup,
    percent: decimal(percent),
  }))
}

/** Each fact as its label, its value and where it came from. */
function factsOf(details: ReturnType<typeof holdingDetails>): (readonly [string, string, string | undefined])[] {
  return details.facts.map((fact) => [fact.label, fact.value, fact.caption] as const)
}

const SHARE = instrument('share', { name: 'Example Chips', type: 'share', isin: 'US0000000001', sector: 'information-technology', country: countryOf('US') })
const FUND = instrument('fund', { name: 'Example World Fund', type: 'fund', isin: 'IE0000000002', prices: 'alphavantage', sourceSymbol: 'FUND.DEX', ter: decimal('0.2'), distribution: 'accumulating' })

describe('what a holding’s page says the holding is', () => {
  it('names a share’s typed facts and its price source, with no fund facts and no ring', () => {
    const details = holdingDetails(held(SHARE), book({}), NOTHING_FETCHED)

    expect(factsOf(details)).toEqual([
      ['Type', 'Share', 'You typed it'],
      ['Class', 'Stocks', 'You typed it'],
      ['Sector', 'Information technology', 'You typed it'],
      ['Country or region', 'United States', 'You typed it'],
      ['ISIN', 'US0000000001', 'You typed it'],
      ['Price source', 'Twelve Data', 'As SHARE there'],
    ])
    expect(details.rings).toEqual([])
    expect(details.ringsWaitFor).toBeNull()
  })

  it('says a share’s sector and country came from its company profile, or its country from its ISIN', () => {
    const untold = { ...SHARE, sector: null, country: null }
    const profiled = fetchedFactsBook({ ...NO_FETCHED_FACTS, profiles: { 'finnhub:US0000000001': { asked: '2026-10-29', industry: 'Semiconductors', country: 'US' } } })

    expect(factsOf(holdingDetails(held(untold), book({}), profiled)).slice(2, 4)).toEqual([
      ['Sector', 'Information technology', 'Company profile, fetched'],
      ['Country or region', 'United States', 'Company profile, fetched'],
    ])
    expect(factsOf(holdingDetails(held(untold), book({}), NOTHING_FETCHED)).slice(2, 4)).toEqual([
      ['Sector', 'Not known', 'Type it with Change'],
      ['Country or region', 'United States', 'From its ISIN'],
    ])
  })

  it('counts the groups of a fund’s typed mix, rings both mixes, and names its TER and dividends', () => {
    const lines = [
      ...mixLines(FUND, 'sector', [
        ['information-technology', '40'],
        ['financials', '30'],
        ['health-care', '20'],
        ['industrials', '10'],
      ]),
      ...mixLines(FUND, 'country', [
        ['US', '70'],
        ['europe', '30'],
      ]),
    ]
    const details = holdingDetails(held(FUND), book({ fundMixes: lines }), NOTHING_FETCHED)

    expect(factsOf(details)).toEqual([
      ['Type', 'Fund or ETF', 'You typed it'],
      ['Class', 'Stocks', 'You typed it'],
      ['Sector', '4 sectors', 'Its mix, as you typed it'],
      ['Country or region', '2 countries or regions', 'Its mix, as you typed it'],
      ['ISIN', 'IE0000000002', 'You typed it'],
      ['TER', '0.20%', 'You typed it'],
      ['Dividends', 'Accumulating', 'You typed it'],
      ['Price source', 'Alpha Vantage', 'As FUND.DEX there'],
    ])
    expect(details.rings).toEqual(['sector', 'country'])
    expect(details.ringsWaitFor).toBeNull()
  })

  it('rings a fund’s fetched sector weights alone beside its typed region, and asks for what is not typed', () => {
    const weighted = fetchedFactsBook({
      ...NO_FETCHED_FACTS,
      sectors: {
        'alphavantage:FUND.DEX': {
          asked: '2026-10-29',
          sectors: [
            ['FINANCIALS', '0.9'],
            ['INDUSTRIALS', '0.1'],
          ],
        },
      },
    })
    const details = holdingDetails(held({ ...FUND, country: countryOf('europe'), ter: null, distribution: null }), book({}), weighted)

    expect(factsOf(details).filter(([label]) => ['Sector', 'Country or region', 'TER', 'Dividends'].includes(label))).toEqual([
      ['Sector', '2 sectors', 'Fund weights, fetched'],
      ['Country or region', 'Europe', 'You typed it'],
      ['TER', 'Not known', 'Type it with Change'],
      ['Dividends', 'Not known', 'Type it with Change'],
    ])
    expect(details.rings).toEqual(['sector'])
  })

  it('asks for a fund’s mix when nothing spreads it, and names a price entered by hand', () => {
    const details = holdingDetails(held({ ...FUND, prices: 'manual', sourceSymbol: '' }), book({}), NOTHING_FETCHED)

    expect(details.rings).toEqual([])
    expect(details.ringsWaitFor).toBe('mix')
    expect(factsOf(details).at(-1)).toEqual(['Price source', 'Entered by hand', 'You typed it'])
  })

  it('says an untyped instrument’s type is not known, or names the vendor whose search gave it', () => {
    const untyped = instrument('mystery', { name: 'Example Mystery' })
    const searched = fetchedFactsBook({ ...NO_FETCHED_FACTS, types: { 'twelvedata:MYSTERY': { asked: '2026-10-29', type: 'Common Stock' } } })

    expect(factsOf(holdingDetails(held(untyped), book({}), NOTHING_FETCHED)).slice(0, 5)).toEqual([
      ['Type', 'Not known', 'Type it with Change'],
      ['Class', 'Stocks', 'You typed it'],
      ['Sector', 'Not known', 'Type it with Change'],
      ['Country or region', 'Not known', 'Type it with Change'],
      ['ISIN', 'Not known', 'Type it with Change'],
    ])
    expect(factsOf(holdingDetails(held(untyped), book({}), searched))[0]).toEqual(['Type', 'Share', 'From a search at Twelve Data'])
  })

  it('waits for the price of a fund held with a mix but no close, and draws no ring of a fund no longer held', () => {
    const lines = mixLines(FUND, 'sector', [
      ['information-technology', '60'],
      ['financials', '40'],
    ])

    const unpriced = holdingDetails(held(FUND, null), book({ fundMixes: lines }), NOTHING_FETCHED)
    expect(unpriced.rings).toEqual([])
    expect(unpriced.ringsWaitFor).toBe('price')
    const closed = holdingDetails(sold(FUND), book({ fundMixes: lines }), NOTHING_FETCHED)
    expect(closed.rings).toEqual([])
    expect(closed.ringsWaitFor).toBeNull()
    expect(factsOf(closed)[2]).toEqual(['Sector', '2 sectors', 'Its mix, as you typed it'])
  })

  it('leaves out the sector, country and ISIN of physical gold and a coin unless they are typed', () => {
    const gold = instrument('gold-bar', { name: 'Example Gold Bar', type: 'gold', class: 'gold', prices: 'manual', sourceSymbol: '' })
    const coin = instrument('coin', { name: 'Example Coin', type: 'crypto', class: 'crypto' })

    expect(factsOf(holdingDetails(held(gold), book({}), NOTHING_FETCHED)).map(([label]) => label)).toEqual(['Type', 'Class', 'Price source'])
    expect(factsOf(holdingDetails(held(coin), book({}), NOTHING_FETCHED)).map(([label]) => label)).toEqual(['Type', 'Class', 'Price source'])
    expect(factsOf(holdingDetails(held({ ...coin, country: countryOf('US'), isin: 'XX0000000003' }), book({}), NOTHING_FETCHED)).map(([label]) => label)).toEqual([
      'Type',
      'Class',
      'Country or region',
      'ISIN',
      'Price source',
    ])
  })
})
