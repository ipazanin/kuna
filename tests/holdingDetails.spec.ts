import { describe, expect, it } from 'vitest'

import type { HoldingFigures, PortfolioSources, Valuation } from '../src/apps/investments/holdings/domain/holding'
import { holdingDetails } from '../src/apps/investments/holdings/presentation/holdingDetails'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook'
import { NO_FETCHED_FACTS } from '../src/apps/investments/prices/domain/pricesFile'
import type { FundMixLine } from '../src/apps/investments/workbook/domain/fundMix'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import { FUND_MIX_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { countryOf } from '../src/apps/investments/workbook/domain/mixGroup'
import type { FundMixGroup } from '../src/apps/investments/workbook/domain/mixGroup'
import { DECIMAL_ZERO } from '../src/shared/money/decimal'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { fundFact, profileFact } from './fixtures/facts'
import { USD, book, decimal, instrument, priceBookOf, rateBookOf } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const NOTHING_FETCHED = fetchedFactsBook(NO_FETCHED_FACTS)

const VALUED: Valuation = { close: { date: civil('2026-10-29'), price: decimal('100'), byHand: false }, price: decimal('100'), rate: null, foreignValue: decimal('1000'), value: euros(1000) }

type Held = Pick<HoldingFigures, 'instrument' | 'quantity' | 'valuation'>

/** Ten units of it valued at €1,000.00, with no price, or none held. */
function held(what: Instrument, valuation: Valuation | null = VALUED): Held {
  return { instrument: what, quantity: decimal('10'), valuation }
}

/** The records with the closes given, on 29 October 2026. */
function sources(records: InvestmentBook, closes: ReadonlyMap<Instrument, readonly CloseRow[]> = new Map()): PortfolioSources {
  return { book: records, prices: priceBookOf(closes), rates: rateBookOf(new Map()), today: civil('2026-10-29') }
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
    const details = holdingDetails(held(SHARE), sources(book({})), NOTHING_FETCHED)

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

  it('says a share’s sector and country came from its company profile at the vendor that gave it, or its country from its ISIN', () => {
    const untold = { ...SHARE, sector: null, country: null }
    const profiled = fetchedFactsBook({ ...NO_FETCHED_FACTS, profiles: { 'finnhub:US0000000001': profileFact('2026-10-29', { industry: 'Semiconductors', country: 'US' }) } })

    expect(factsOf(holdingDetails(held(untold), sources(book({})), profiled)).slice(2, 4)).toEqual([
      ['Sector', 'Information technology', 'Company profile from Finnhub'],
      ['Country or region', 'United States', 'Company profile from Finnhub'],
    ])
    expect(factsOf(holdingDetails(held(untold), sources(book({})), NOTHING_FETCHED)).slice(2, 4)).toEqual([
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
    const details = holdingDetails(held(FUND), sources(book({ fundMixes: lines })), NOTHING_FETCHED)

    expect(factsOf(details)).toEqual([
      ['Type', 'Fund or ETF', 'You typed it'],
      ['Class', 'Stocks', 'You typed it'],
      ['Sector', '4 sectors', 'Its mix, as you typed it'],
      ['Country or region', '2 countries or regions', 'Its mix, as you typed it'],
      ['Domicile', 'Ireland', 'From its ISIN'],
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
      funds: {
        'alphavantage:FUND.DEX': fundFact('2026-10-29', {
          sectors: [
            ['FINANCIALS', '0.9'],
            ['INDUSTRIALS', '0.1'],
          ],
        }),
      },
    })
    const details = holdingDetails(held({ ...FUND, country: countryOf('europe'), ter: null, distribution: null }), sources(book({})), weighted)

    expect(factsOf(details).filter(([label]) => ['Sector', 'Country or region', 'TER', 'Dividends'].includes(label))).toEqual([
      ['Sector', '2 sectors', 'Fund weights from Alpha Vantage'],
      ['Country or region', 'Europe', 'You typed it'],
      ['TER', 'Not known', 'Type it with Change'],
      ['Dividends', 'Not known', 'Type it with Change'],
    ])
    expect(details.rings).toEqual(['sector'])
  })

  it('asks for a fund’s mix when nothing spreads it, and names a price entered by hand', () => {
    const details = holdingDetails(held({ ...FUND, prices: 'manual', sourceSymbol: '' }), sources(book({})), NOTHING_FETCHED)

    expect(details.rings).toEqual([])
    expect(details.ringsWaitFor).toBe('mix')
    expect(factsOf(details).at(-1)).toEqual(['Price source', 'Entered by hand', 'You typed it'])
  })

  it('says an untyped instrument’s type is not known, or names the vendor whose search gave it', () => {
    const untyped = instrument('mystery', { name: 'Example Mystery' })
    const searched = fetchedFactsBook({ ...NO_FETCHED_FACTS, types: { 'twelvedata:MYSTERY': { asked: '2026-10-29', type: 'Common Stock' } } })

    expect(factsOf(holdingDetails(held(untyped), sources(book({})), NOTHING_FETCHED)).slice(0, 5)).toEqual([
      ['Type', 'Not known', 'Type it with Change'],
      ['Class', 'Stocks', 'You typed it'],
      ['Sector', 'Not known', 'Type it with Change'],
      ['Country or region', 'Not known', 'Type it with Change'],
      ['ISIN', 'Not known', 'Type it with Change'],
    ])
    expect(factsOf(holdingDetails(held(untyped), sources(book({})), searched))[0]).toEqual(['Type', 'Share', 'From a search at Twelve Data'])
  })

  it('waits for the price of a fund held with a mix but no close, and draws no ring of a fund no longer held', () => {
    const lines = mixLines(FUND, 'sector', [
      ['information-technology', '60'],
      ['financials', '40'],
    ])

    const unpriced = holdingDetails(held(FUND, null), sources(book({ fundMixes: lines })), NOTHING_FETCHED)
    expect(unpriced.rings).toEqual([])
    expect(unpriced.ringsWaitFor).toBe('price')
    const closed = holdingDetails(sold(FUND), sources(book({ fundMixes: lines })), NOTHING_FETCHED)
    expect(closed.rings).toEqual([])
    expect(closed.ringsWaitFor).toBeNull()
    expect(factsOf(closed)[2]).toEqual(['Sector', '2 sectors', 'Its mix, as you typed it'])
  })

  it('leaves out the sector, country and ISIN of physical gold and a coin unless they are typed', () => {
    const gold = instrument('gold-bar', { name: 'Example Gold Bar', type: 'gold', class: 'gold', prices: 'manual', sourceSymbol: '' })
    const coin = instrument('coin', { name: 'Example Coin', type: 'crypto', class: 'crypto' })

    expect(factsOf(holdingDetails(held(gold), sources(book({})), NOTHING_FETCHED)).map(([label]) => label)).toEqual(['Type', 'Class', 'Price source'])
    expect(factsOf(holdingDetails(held(coin), sources(book({})), NOTHING_FETCHED)).map(([label]) => label)).toEqual(['Type', 'Class', 'Price source'])
    expect(factsOf(holdingDetails(held({ ...coin, country: countryOf('US'), isin: 'XX0000000003' }), sources(book({})), NOTHING_FETCHED)).map(([label]) => label)).toEqual([
      'Type',
      'Class',
      'Country or region',
      'ISIN',
      'Price source',
    ])
  })
})

describe('the fetched facts a holding’s page shows', () => {
  const WORLD = instrument('world', { name: 'Example World ETF', type: 'fund', isin: 'IE00000WORLD', prices: 'alphavantage', sourceSymbol: 'XYZ.DEX' })
  const TECH = instrument('tech', { name: 'Example Tech', type: 'share', currency: USD, isin: 'XX000000ABC1', sector: 'information-technology', country: countryOf('US') })

  function labelled(details: ReturnType<typeof holdingDetails>, label: string): readonly [string, string, string | undefined] | undefined {
    return factsOf(details).find(([found]) => found === label)
  }

  it('shows a fund’s domicile from an IE ISIN, and none from a prefix that is no country', () => {
    expect(labelled(holdingDetails(held(WORLD), sources(book({})), NOTHING_FETCHED), 'Domicile')).toEqual(['Domicile', 'Ireland', 'From its ISIN'])
    expect(labelled(holdingDetails(held({ ...WORLD, isin: 'XS0000000001' }), sources(book({})), NOTHING_FETCHED), 'Domicile')).toBeUndefined()
    expect(labelled(holdingDetails(held(TECH), sources(book({})), NOTHING_FETCHED), 'Domicile')).toBeUndefined()
  })

  it('shows a fetched TER with the vendor that gave it, and a typed TER ahead of it', () => {
    const fetched = fetchedFactsBook({ ...NO_FETCHED_FACTS, funds: { 'alphavantage:XYZ.DEX': fundFact('2026-10-29', { expenseRatio: '0.0019' }) } })

    expect(labelled(holdingDetails(held(WORLD), sources(book({})), fetched), 'TER')).toEqual(['TER', '0.19%', 'Fund profile from Alpha Vantage'])
    expect(labelled(holdingDetails(held({ ...WORLD, ter: decimal('0.22') }), sources(book({})), fetched), 'TER')).toEqual(['TER', '0.22%', 'You typed it'])
  })

  it('shows a fund’s size, start and holdings from its fund profile', () => {
    const fetched = fetchedFactsBook({
      ...NO_FETCHED_FACTS,
      funds: { 'alphavantage:XYZ.DEX': fundFact('2026-10-29', { netAssets: '18200000000', inception: '2019-07-23', holdings: 120 }) },
    })
    const details = holdingDetails(held(WORLD), sources(book({})), fetched)

    expect(factsOf(details).filter(([label]) => ['Fund size', 'Started', 'Holdings'].includes(label))).toEqual([
      ['Fund size', '18.2bn', 'From Alpha Vantage, no currency stated'],
      ['Started', '23 Jul 2019', 'Fund profile from Alpha Vantage'],
      ['Holdings', '120 holdings', 'Listed by Alpha Vantage, maybe not all'],
    ])
  })

  it('shows a share’s exchange, market cap about the vendor’s figure in millions, and IPO from its company profile', () => {
    const profiled = fetchedFactsBook({
      ...NO_FETCHED_FACTS,
      profiles: {
        'finnhub:XX000000ABC1': profileFact('2026-10-29', { exchange: 'NASDAQ NMS - GLOBAL MARKET', marketCap: '2125400.5', currency: 'USD', ipo: '2004-08-19' }),
      },
    })
    const details = holdingDetails(held(TECH), sources(book({})), profiled)

    expect(factsOf(details).filter(([label]) => ['Exchange', 'Market cap', 'Listed since'].includes(label))).toEqual([
      ['Exchange', 'NASDAQ NMS - GLOBAL MARKET', 'Company profile from Finnhub'],
      ['Market cap', 'About $2.1tn', 'From Finnhub, approximate'],
      ['Listed since', '19 Aug 2004', 'Company profile from Finnhub'],
    ])
    expect(labelled(holdingDetails(held({ ...TECH, exchange: 'XNAS' }), sources(book({})), profiled), 'Exchange')).toBeUndefined()
  })

  it('gives the 52-week range of the closes, since the first close when they start inside the year, and up to the last of a holding sold', () => {
    const closes = new Map([
      [
        TECH,
        [
          ['2026-06-01', '120'],
          ['2026-07-15', '95.5'],
          ['2026-09-01', '150.25'],
          ['2026-10-29', '140'],
        ] as const,
      ],
    ])

    expect(labelled(holdingDetails(held(TECH), sources(book({}), closes), NOTHING_FETCHED), '52-week range')).toEqual(['52-week range', '$95.50 to $150.25', 'Since 1 Jun 2026, under a year'])
    const soldCloses = new Map([[TECH, closes.get(TECH)!.slice(0, 3)]])
    expect(labelled(holdingDetails(sold(TECH), sources(book({}), soldCloses), NOTHING_FETCHED), '52-week range')).toEqual([
      '52-week range',
      '$95.50 to $150.25',
      '1 Jun 2026 to 1 Sep 2026, under a year',
    ])
  })

  it('warns of a fund its vendor says is leveraged, and of no other', () => {
    const leveragedAs = (word: string) => fetchedFactsBook({ ...NO_FETCHED_FACTS, funds: { 'alphavantage:XYZ.DEX': fundFact('2026-10-29', { leveraged: word }) } })

    expect(holdingDetails(held(WORLD), sources(book({})), leveragedAs('YES')).leveraged).toBe(
      'Alpha Vantage says this fund is leveraged. It aims at a multiple of its index’s daily move, so over months its return can stray far from that multiple.',
    )
    expect(holdingDetails(held(WORLD), sources(book({})), leveragedAs('NO')).leveraged).toBeNull()
  })

  it('names each fact a vendor sent nothing usable for, with the vendor, what was asked and why', () => {
    const PAYER = instrument('def', { name: 'Example Dividend Co', type: 'share', currency: USD, isin: 'US000000DEF2' })
    const facts = fetchedFactsBook({
      ...NO_FETCHED_FACTS,
      profiles: { 'finnhub:US000000DEF2': profileFact('2026-10-29', { failed: 'not-on-free-key' }) },
      funds: { 'alphavantage:XYZ.DEX': fundFact('2026-10-29') },
    })

    expect(holdingDetails(held(WORLD), sources(book({})), facts).problems).toEqual({
      sentences: ['Alpha Vantage sent no fund profile for XYZ.DEX'],
      vendors: [{ id: 'alphavantage', name: 'Alpha Vantage' }],
      askedOn: civil('2026-10-29'),
      asksAgainOn: civil('2027-01-27'),
    })
    expect(holdingDetails(held(PAYER), sources(book({})), facts).problems).toMatchObject({
      sentences: ['Finnhub refused the company profile for US000000DEF2: it needs a paid key'],
      // A refusal is asked again at the next day's fetch, where an empty answer waits 90 days.
      asksAgainOn: civil('2026-10-30'),
    })
    expect(holdingDetails(held(TECH), sources(book({})), facts).problems).toBeNull()
    expect(holdingDetails(sold(WORLD), sources(book({})), facts).problems).toBeNull()
  })

  it('says a vendor sent a message instead of the fact', () => {
    const facts = fetchedFactsBook({ ...NO_FETCHED_FACTS, funds: { 'alphavantage:XYZ.DEX': fundFact('2026-10-29', { failed: 'message' }) } })

    expect(holdingDetails(held(WORLD), sources(book({})), facts).problems?.sentences).toEqual(['Alpha Vantage sent a message instead of a fund profile for XYZ.DEX'])
  })
})
