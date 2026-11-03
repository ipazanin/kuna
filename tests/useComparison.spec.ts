import { computed, createApp, shallowReactive, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { comparedInstrument } from '../src/apps/investments/compare/domain/comparedLine'
import type { PortfolioSources } from '../src/apps/investments/holdings/domain/holding'
import type { ComparedPick } from '../src/apps/investments/compare/domain/comparedLine'
import type { ComparedListing } from '../src/apps/investments/prices/domain/priceDemand'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { USD, book, priceBookOf, rateBookOf } from './fixtures/investments'
import { civil } from './fixtures/ledger'

/** The page's portfolio and prices as a spec drives them, with each fetch a comparison asks for. */
const page = vi.hoisted(() => ({
  sources: null as unknown as { value: PortfolioSources | null },
  asked: [] as ComparedListing[],
}))

vi.mock('../src/apps/investments/holdings/presentation/usePortfolio', () => ({
  usePortfolio: () => ({ sources: computed(() => page.sources.value) }),
}))
vi.mock('../src/apps/investments/prices/presentation/usePrices', () => ({
  usePrices: () => ({
    state: shallowReactive({ copy: { file: { series: {}, splits: [], failures: [] } } }),
    async fetchCompared(compared: ComparedListing) {
      page.asked.push(compared)
      return { kind: 'current' }
    },
  }),
}))

const { useComparison } = await import('../src/apps/investments/compare/presentation/useComparison')

// A made-up dollar ticker, EXQ, at $1.10 and then $1.20.
const ticker = comparedInstrument({ source: 'twelvedata', symbol: 'EXQ' }, USD)
const DOLLAR_RATES = rateBookOf(
  new Map([
    [
      USD,
      [
        ['2026-01-30', '1.10'],
        ['2026-02-27', '1.20'],
      ],
    ],
  ]),
)
function sourcesWith(rates: PortfolioSources['rates']): PortfolioSources {
  return {
    book: book({}),
    prices: priceBookOf(
      new Map([
        [
          ticker,
          [
            ['2026-01-30', '1.10'],
            ['2026-02-27', '1.20'],
          ],
        ],
      ]),
    ),
    rates,
    today: civil('2026-02-27'),
  }
}

const FOUND: ComparedPick = { source: 'twelvedata', symbol: 'EXQ', currency: 'USD' }

async function comparisonOn(days: { value: readonly CivilDate[] }, reading: 'as-quoted' | 'in-euros', address = '/investments/performance?period=all') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/investments/performance', component: { render: () => null } }] })
  await router.push(address)
  const app = createApp({}).use(router)
  return { router, comparison: app.runWithContext(() => useComparison(() => days.value, reading)) }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('Compare with on a chart', () => {
  it('keeps the pick only in the address, asks its closes from the first day, and Remove clears it', async () => {
    page.sources = shallowRef(sourcesWith(DOLLAR_RATES))
    page.asked.length = 0
    const days = shallowRef([civil('2026-01-30'), civil('2026-02-27')])
    const { router, comparison } = await comparisonOn(days, 'in-euros')

    comparison.pick(FOUND)
    await settle()
    expect(router.currentRoute.value.query).toEqual({ period: 'all', compare: 'twelvedata:EXQ' })
    expect(page.asked).toEqual([{ source: 'twelvedata', symbol: 'EXQ', currency: 'USD', from: '2026-01-30' }])
    // $1.10 ÷ 1.10 and $1.20 ÷ 1.20 are €1.00 both days.
    expect(comparison.line.value).toEqual({ name: 'EXQ', change: [0, 0] })

    comparison.remove()
    await settle()
    expect(router.currentRoute.value.query).toEqual({ period: 'all' })
    expect(comparison.line.value).toBeNull()
  })

  it("asks again from the new first day when the chart's period moves", async () => {
    page.sources = shallowRef(sourcesWith(DOLLAR_RATES))
    page.asked.length = 0
    const days = shallowRef([civil('2026-02-27')])
    const { comparison } = await comparisonOn(days, 'as-quoted')
    comparison.pick(FOUND)
    await settle()

    days.value = [civil('2026-01-30'), civil('2026-02-27')]
    await settle()
    expect(page.asked.map((asked) => asked.from)).toEqual(['2026-02-27', '2026-01-30'])
  })

  it('knows the currency of a named fund the address compares with, with nothing picked on the page', async () => {
    page.sources = shallowRef(sourcesWith(DOLLAR_RATES))
    page.asked.length = 0
    const days = shallowRef([civil('2026-01-30'), civil('2026-02-27')])
    const { comparison } = await comparisonOn(days, 'in-euros', '/investments/performance?compare=twelvedata:SPY')
    await settle()

    expect(page.asked).toEqual([{ source: 'twelvedata', symbol: 'SPY', currency: 'USD', from: '2026-01-30' }])
    expect(comparison.note.value).toBe('No close of SPY for 30 Jan 2026, so it has no line.')
  })

  it('says a line in euros waits for an ECB rate when the closes are in but the rates are not', async () => {
    page.sources = shallowRef(sourcesWith(rateBookOf(new Map())))
    const days = shallowRef([civil('2026-01-30'), civil('2026-02-27')])
    const { comparison } = await comparisonOn(days, 'in-euros')
    comparison.pick(FOUND)
    await settle()
    expect(comparison.line.value).toBeNull()
    expect(comparison.note.value).toBe('No ECB rate of USD for 30 Jan 2026, so EXQ has no line in euros.')
  })
})
