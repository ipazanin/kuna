import { describe, expect, it } from 'vitest'

import { exposureOf } from '../src/apps/investments/holdings/domain/exposure'
import { factWork } from '../src/apps/investments/prices/application/factFetch'
import { fetchPrices, pacedFetch } from '../src/apps/investments/prices/application/priceFetch'
import { keylessVendors, pricesFetchVerdict } from '../src/apps/investments/prices/application/pricesUpdate'
import type { PriceFetchScope } from '../src/apps/investments/prices/application/priceFetch'
import type { PriceFetchPorts } from '../src/apps/investments/prices/application/pricesPorts'
import type { VendorAnswer } from '../src/apps/investments/prices/application/priceVendor'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook'
import { NO_FETCHED_FACTS, decodePricesFile, emptyPricesFile, encodePricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import type { PricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { fakeVendorFetch } from '../src/apps/investments/prices/infrastructure/fake/fakeVendorAnswers'
import { alphaVantage } from '../src/apps/investments/prices/infrastructure/vendors/alphaVantage'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'
import { words } from '../src/apps/investments/prices/presentation/words'
import { plural } from '../src/shared/text/translation'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { countryOf } from '../src/apps/investments/workbook/domain/mixGroup'
import { fundFact, profileFact } from './fixtures/facts'
import { USD, account, book, cashMovement, decimal, dividend, instrument, trade } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const BROKER = account('broker', 'Broker')
/** Untyped, so its type comes from a search of Twelve Data. The fake Finnhub keeps its profile by ISIN for paid keys. */
const PAYER = instrument('def', { name: 'Example Dividend Co', currency: USD, isin: 'US000000DEF2' })
/** A fund priced by hand, so nothing searches it, whose fund profile comes from Alpha Vantage. */
const MONEY_FUND = instrument('emf', { name: 'Example Money Fund', type: 'fund', class: 'money-market', prices: 'manual', sourceSymbol: '', country: countryOf('europe') })
/** Typed in full, so only its company profile is asked for, by symbol as it has no ISIN. */
const TYPED = instrument('ghi', { name: 'Example Typed Co', type: 'share', currency: USD, sector: 'energy', country: countryOf('US') })
/** Sold in full, so nothing is asked about it either. */
const SOLD = instrument('jkl', { name: 'Example Sold Co', currency: USD })

/** Made-up records: three holdings held, one sold, and a dividend of the payer in July 2026, with the money fund as given. */
function records(moneyFund = MONEY_FUND): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [PAYER, moneyFund, TYPED, SOLD],
    cashMovements: [cashMovement('deposit', BROKER, '2026-01-02', '20000')],
    trades: [
      trade('buy', BROKER, PAYER, '2026-01-05', '40', '48', '1', '1.08'),
      trade('buy', BROKER, moneyFund, '2026-01-05', '100', '10', '0'),
      trade('buy', BROKER, TYPED, '2026-01-05', '10', '100', '1', '1.08'),
      trade('buy', BROKER, SOLD, '2026-01-05', '10', '20', '1', '1.08'),
      trade('sell', BROKER, SOLD, '2026-03-02', '10', '22', '1', '1.09'),
    ],
    income: [dividend(BROKER, PAYER, '2026-07-15', '13.30', '2.00', '1.0862')],
  })
}

const KEYS: Readonly<Record<string, string>> = { twelvedata: 'td-key-made-up', alphavantage: 'av-key-made-up', finnhub: 'fh-key-made-up' }

interface Browser {
  /** Each request's address, in order. */
  readonly asked: string[]
  text: string
  run(day: string, scope?: PriceFetchScope): Promise<PricesFile>
}

/** One browser with every key, the made-up records and the fake vendors, with an answer of its own for any address that holds a given text. */
function browser(answers: ReadonlyMap<string, VendorAnswer> = new Map(), keys: Readonly<Record<string, string>> = KEYS, held: () => InvestmentBook = records): Browser {
  const self: Browser = {
    asked: [],
    text: encodePricesFile(emptyPricesFile()),
    async run(day, scope) {
      self.asked.length = 0
      const ports: PriceFetchPorts = {
        async fetch(url) {
          self.asked.push(url)
          return [...answers].find(([part]) => url.includes(part))?.[1] ?? fakeVendorFetch(url)
        },
        pause: async () => {},
        key: (vendorId) => keys[vendorId] ?? null,
        investments: held,
        readPrices: async () => self.text,
        async writePrices(written) {
          self.text = written
        },
        progress: () => {},
      }
      const outcome = await fetchPrices(ports, PRICE_VENDORS, { at: `${day}T07:41:00.000Z`, day }, scope)
      if (outcome.kind !== 'written') throw new Error(outcome.reason)
      const read = decodePricesFile(self.text)
      if (read.kind !== 'read') throw new Error(read.reason)
      return read.file
    },
  }
  return self
}

/** The facts requests among the addresses asked, as the vendor's path or function and what was asked. */
function factsAsked(asked: readonly string[]): string[] {
  return asked.flatMap((url) => {
    const address = new URL(url)
    const query = address.searchParams
    if (address.hostname === 'finnhub.io') return [`finnhub ${address.pathname.split('/').at(-1)} ${query.get('isin') ?? query.get('symbol') ?? query.get('q')}`]
    if (address.pathname === '/symbol_search') return [`twelvedata symbol_search ${query.get('symbol')}`]
    const asking = query.get('function')
    return asking === null || asking.startsWith('TIME_SERIES') ? [] : [`alphavantage ${asking} ${query.get('symbol') ?? query.get('keywords')}`]
  })
}

/** A Finnhub profile of the payer, as a paid key would get it. */
const PAYER_PROFILE: VendorAnswer = { status: 200, text: JSON.stringify({ finnhubIndustry: 'Food Products', country: 'US', name: 'Example Dividend Co' }) }

/** The fund profile the fake Alpha Vantage gives the money fund. */
const MONEY_FUND_PROFILE = fundFact('2026-11-02', {
  expenseRatio: '0.0015',
  netAssets: '2450000000',
  inception: '2012-03-19',
  leveraged: 'NO',
  holdings: 48,
  dividendYield: '0.031',
  sectors: [
    ['FINANCIALS', '0.900'],
    ['INDUSTRIALS', '0.100'],
  ],
})

const ALPHA_VANTAGE_DAY_OUT = {
  status: 200,
  text: JSON.stringify({ Information: 'We have detected your API key as made-up and our standard API rate limit is 25 requests per day. Please subscribe to any of the premium plans.' }),
}

describe('the facts a day’s fetch asks for after the closes', () => {
  it('asks each fact once, in order, of the holdings held: the type, the profiles, the fund profile and the dividends', async () => {
    const it = browser()
    const file = await it.run('2026-11-02')

    expect(factsAsked(it.asked)).toEqual(['twelvedata symbol_search DEF', 'finnhub profile2 US000000DEF2', 'finnhub profile2 GHI', 'alphavantage ETF_PROFILE EMF', 'alphavantage DIVIDENDS DEF'])
    expect(file.facts).toEqual({
      types: { 'twelvedata:DEF': { asked: '2026-11-02', type: 'Common Stock' } },
      profiles: {
        'finnhub:US000000DEF2': profileFact('2026-11-02', { failed: 'not-on-free-key' }),
        'finnhub:GHI': profileFact('2026-11-02', { country: 'US', exchange: 'NEW YORK STOCK EXCHANGE, INC.', currency: 'USD' }),
      },
      funds: { 'alphavantage:EMF': MONEY_FUND_PROFILE },
      // The July payment is before the day asked, so only the announced one is kept.
      dividends: { 'alphavantage:DEF': { asked: '2026-11-02', dividends: [['2026-12-28', '2027-01-12', '0.34']] } },
    })
    expect(file.lastFetch).toMatchObject({ factsAsked: 5, factsLeft: 0 })
  })

  it('reads a profile once, so a second fetch asks only the refused one again, and asks for the dividends again in the next month', async () => {
    const it = browser()
    await it.run('2026-11-02')
    // The fake Finnhub keeps the payer's profile for paid keys, a refusal asked again at each day's fetch.
    await it.run('2026-11-03')
    expect(factsAsked(it.asked)).toEqual(['finnhub profile2 US000000DEF2'])
    await it.run('2026-12-01')
    expect(factsAsked(it.asked)).toEqual(['finnhub profile2 US000000DEF2', 'alphavantage DIVIDENDS DEF'])
  })

  it('asks a profile and a fund profile again once they are 90 days old, and not at 89 days', async () => {
    const it = browser()
    await it.run('2026-11-02')
    await it.run('2027-01-30')
    expect(factsAsked(it.asked)).toEqual(['finnhub profile2 US000000DEF2', 'alphavantage DIVIDENDS DEF'])
    const file = await it.run('2027-01-31')
    expect(factsAsked(it.asked)).toEqual(['finnhub profile2 US000000DEF2', 'finnhub profile2 GHI', 'alphavantage ETF_PROFILE EMF'])
    expect(file.facts.funds['alphavantage:EMF']?.asked).toBe('2027-01-31')
  })

  it('puts the fetched weights and the profile in the sector mix with the vendor that gave each, and the profile’s country ahead of the ISIN', async () => {
    const facts = fetchedFactsBook((await browser(new Map([['isin=US000000DEF2', PAYER_PROFILE]])).run('2026-11-02')).facts)
    expect(exposureOf(MONEY_FUND, 'sector', records(), facts)).toEqual({
      from: { kind: 'fund-weights', vendor: 'alphavantage' },
      lines: [
        { group: 'financials', percent: decimal('90') },
        { group: 'industrials', percent: decimal('10') },
      ],
    })
    expect(exposureOf(PAYER, 'sector', records(), facts)).toEqual({ from: { kind: 'profile', vendor: 'finnhub' }, lines: [{ group: 'consumer-staples', percent: decimal('100') }] })
    expect(exposureOf(PAYER, 'country', records(), facts)).toEqual({ from: { kind: 'profile', vendor: 'finnhub' }, lines: [{ group: 'US', percent: decimal('100') }] })
    expect(facts.typeOf(PAYER)).toBe('share')
  })

  it('keeps a profile Finnhub keeps for paid keys as not on the free key, which the holding shows, and asks it again at the next day’s fetch', async () => {
    const it = browser()
    const file = await it.run('2026-11-02')
    expect(file.facts.profiles['finnhub:US000000DEF2']).toEqual(profileFact('2026-11-02', { failed: 'not-on-free-key' }))
    expect(fetchedFactsBook(file.facts).problemsOf(PAYER)).toEqual([{ vendor: 'finnhub', fact: 'profile', asked: 'US000000DEF2', askedOn: civil('2026-11-02'), failure: 'not-on-free-key' }])
    expect(exposureOf(PAYER, 'country', records(), fetchedFactsBook(file.facts))).toEqual({ from: { kind: 'isin' }, lines: [{ group: 'US', percent: decimal('100') }] })
    await it.run('2026-11-02')
    expect(factsAsked(it.asked)).not.toContain('finnhub profile2 US000000DEF2')
    await it.run('2026-11-03')
    expect(factsAsked(it.asked)).toContain('finnhub profile2 US000000DEF2')
  })

  it('asks no fund weights of a holding a profile placed, and no profile without a key, which the file notes', async () => {
    const it = browser(new Map(), { twelvedata: KEYS.twelvedata!, alphavantage: KEYS.alphavantage! })
    const file = await it.run('2026-11-02')
    // Without Finnhub's profile the payer's sector is not known, but Twelve Data's search made it a share, which has no fund weights.
    expect(factsAsked(it.asked)).toEqual(['twelvedata symbol_search DEF', 'alphavantage ETF_PROFILE EMF', 'alphavantage DIVIDENDS DEF'])
    expect(file.lastFetch).toMatchObject({ factsKeyless: ['finnhub'] })
  })

  it('has a browser with the Finnhub key fetch again the day a browser without it fetched first', async () => {
    const phone = browser(new Map(), { twelvedata: KEYS.twelvedata!, alphavantage: KEYS.alphavantage! })
    const first = await phone.run('2026-11-02')
    const moment = { writtenAt: first.writtenAt, today: civil('2026-11-02'), needed: [], running: false, askAgain: [] }
    expect(pricesFetchVerdict({ ...moment, hasKey: (vendorId) => vendorId !== 'finnhub', keyless: keylessVendors(first) })).toBe('fetched-today')
    expect(pricesFetchVerdict({ ...moment, hasKey: () => true, keyless: keylessVendors(first) })).toBe('due')

    const laptop = browser()
    laptop.text = phone.text
    const second = await laptop.run('2026-11-02')
    expect(factsAsked(laptop.asked)).toEqual(['finnhub profile2 US000000DEF2', 'finnhub profile2 GHI'])
    expect(keylessVendors(second)).toEqual([])
    expect(pricesFetchVerdict({ ...moment, writtenAt: second.writtenAt, hasKey: () => true, keyless: keylessVendors(second) })).toBe('fetched-today')
  })

  it('asks a fund profile of a fund whose sector is typed, and no profile of an instrument no search can type', async () => {
    const typedFund = browser(new Map(), KEYS, () => records({ ...MONEY_FUND, sector: 'financials' }))
    await typedFund.run('2026-11-02')
    expect(factsAsked(typedFund.asked)).toContain('alphavantage ETF_PROFILE EMF')

    // Priced by hand, so nothing tells whether it is a share or a fund domiciled where its ISIN says.
    const unknown = browser(new Map(), KEYS, () => records({ ...MONEY_FUND, type: null, isin: 'IE000000EMF3', country: null }))
    await unknown.run('2026-11-02')
    expect(factsAsked(unknown.asked)).not.toContain('finnhub profile2 IE000000EMF3')
    expect(factsAsked(unknown.asked)).toContain('alphavantage ETF_PROFILE EMF')
  })

  it('keeps a fund profile the vendor does not know and a profile it refused as failed facts, and asks only the refused ones again the next day', async () => {
    const unknown = { status: 200, text: JSON.stringify({ 'Error Message': 'Invalid API call.' }) }
    const it = browser(
      new Map([
        ['function=ETF_PROFILE', unknown],
        ['/stock/profile2', { status: 401, text: JSON.stringify({ error: 'Invalid API key.' }) }],
      ]),
    )
    const file = await it.run('2026-11-02')
    expect(file.facts.funds).toEqual({ 'alphavantage:EMF': fundFact('2026-11-02', { failed: 'unknown-symbol' }) })
    expect(file.facts.profiles).toEqual({
      'finnhub:US000000DEF2': profileFact('2026-11-02', { failed: 'refused' }),
      'finnhub:GHI': profileFact('2026-11-02', { failed: 'refused' }),
    })
    await it.run('2026-11-03')
    expect(factsAsked(it.asked)).toEqual(['finnhub profile2 US000000DEF2', 'finnhub profile2 GHI'])
  })

  it('keeps the fund profile that met Alpha Vantage’s daily limit as a warning, and asks it and the facts it never asked for tomorrow', async () => {
    const it = browser(new Map([['function=ETF_PROFILE', ALPHA_VANTAGE_DAY_OUT]]))
    const file = await it.run('2026-11-02')

    // The fund profile got the daily limit, and the dividends were not asked, since Alpha Vantage stopped for the day.
    expect(factsAsked(it.asked)).toEqual(['twelvedata symbol_search DEF', 'finnhub profile2 US000000DEF2', 'finnhub profile2 GHI', 'alphavantage ETF_PROFILE EMF'])
    expect(file.lastFetch).toMatchObject({ factsAsked: 4, factsLeft: 1 })
    expect(`${plural(words.lastFacts(4), 4)} ${plural(words.factsLeft(1), 1)}`).toBe("Asked for 4 facts about the holdings. 1 is left for tomorrow by a vendor's daily limit.")
    expect(file.facts.funds).toEqual({ 'alphavantage:EMF': fundFact('2026-11-02', { failed: 'limit' }) })

    const tomorrow = browser()
    tomorrow.text = it.text
    await tomorrow.run('2026-11-03')
    expect(factsAsked(tomorrow.asked)).toEqual(['finnhub profile2 US000000DEF2', 'alphavantage ETF_PROFILE EMF', 'alphavantage DIVIDENDS DEF'])
  })

  it('leaves the facts after the request that spends Kuna’s own daily count of Alpha Vantage to tomorrow, unasked and with no warning', async () => {
    const sent: string[] = []
    const pacing = { sentAt: Array.from({ length: alphaVantage.limits.perDay! - 1 }, () => 0), stopped: false }
    const fetch = pacedFetch({ fetch: async (url) => (sent.push(url), fakeVendorFetch(url)), pause: async () => {} }, alphaVantage, { elapsed: 0 }, pacing)
    const work = factWork([{ vendor: alphaVantage, key: 'av-key-made-up', pacing, fetch }], NO_FETCHED_FACTS, records(), '2026-11-02')
    for (const { ask } of work.asks) await ask()

    // With no search to type it, the payer's fund profile is the day's last request, so the money fund's and the payer's dividends wait for tomorrow.
    expect(factsAsked(sent)).toEqual(['alphavantage ETF_PROFILE DEF'])
    expect(Object.keys(work.facts().funds)).toEqual(['alphavantage:DEF'])
    expect(work.facts().funds['alphavantage:DEF']?.failed).toBeNull()
    expect(work.facts().dividends).toEqual({})
    expect(work.counts()).toMatchObject({ asked: 1, left: 2 })
  })

  it('keeps no fact a server error answered, and asks it again the next day', async () => {
    const it = browser(new Map([['/stock/profile2', { status: 503, text: 'Service Unavailable' }]]))
    const file = await it.run('2026-11-02')
    expect(file.facts.profiles).toEqual({})

    const tomorrow = browser()
    tomorrow.text = it.text
    await tomorrow.run('2026-11-03')
    expect(factsAsked(tomorrow.asked)).toEqual(['finnhub profile2 US000000DEF2', 'finnhub profile2 GHI'])
  })

  it('keeps Alpha Vantage’s answer to a bad key as the key refused, not as a symbol it does not know', async () => {
    const it = browser(new Map([['function=ETF_PROFILE', { status: 200, text: JSON.stringify({ 'Error Message': 'the parameter apikey is invalid or missing.' }) }]]))
    const file = await it.run('2026-11-02')
    expect(file.facts.funds).toEqual({ 'alphavantage:EMF': fundFact('2026-11-02', { failed: 'refused' }) })
  })

  it('asks for facts on a day’s fetch only, never on a fetch of a few series or of the rates, which keeps the day’s counts', async () => {
    const it = browser(new Map([['function=ETF_PROFILE', ALPHA_VANTAGE_DAY_OUT]]))
    const day = await it.run('2026-11-02')
    const file = await it.run('2026-11-02', { kind: 'series', keys: ['twelvedata:DEF'] })
    expect(factsAsked(it.asked)).toEqual([])
    expect(file.lastFetch).toMatchObject({ factsAsked: day.lastFetch!.factsAsked, factsLeft: day.lastFetch!.factsLeft })
    await it.run('2026-11-02', { kind: 'rates', wanted: { currencies: ['SEK'], from: '2026-01-01' } })
    expect(factsAsked(it.asked)).toEqual([])
  })

  it('asks one holding’s facts again when asked, though they are fresh, with no closes, and keeps the day’s time and counts', async () => {
    const it = browser()
    const day = await it.run('2026-11-02')

    const fund = await it.run('2026-11-03', { kind: 'facts', instrument: MONEY_FUND.id })
    expect(it.asked.map((url) => new URL(url).searchParams.get('function'))).toEqual(['ETF_PROFILE'])
    expect(fund.facts.funds['alphavantage:EMF']).toEqual({ ...MONEY_FUND_PROFILE, asked: '2026-11-03' })
    expect([fund.writtenAt, fund.lastFetch, fund.series]).toEqual([day.writtenAt, day.lastFetch, day.series])

    const payer = await it.run('2026-11-03', { kind: 'facts', instrument: PAYER.id })
    expect(factsAsked(it.asked)).toEqual(['finnhub profile2 US000000DEF2'])
    expect(it.asked).toHaveLength(1)
    expect(payer.facts.profiles['finnhub:GHI']?.asked).toBe('2026-11-02')
  })
})
