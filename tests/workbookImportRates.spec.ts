import { computed, shallowReactive, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { RatesWanted } from '../src/apps/investments/prices/domain/priceDemand'
import type { RateBook } from '../src/apps/investments/prices/domain/rateBook'
import { NO_RATES } from '../src/apps/investments/prices/domain/rateBook'
import { sampleWorkbookFile } from '../src/apps/investments/imports/infrastructure/fake/sampleWorkbook'
import { book, USD, rateBookOf } from './fixtures/investments'

/** The page's prices as a spec drives them: the rates they hold, and a fetch of rates that brings some or fails. */
const page = vi.hoisted(() => ({
  rates: null as unknown as { value: RateBook },
  asked: [] as RatesWanted[],
  fetchBrings: null as RateBook | null,
}))

vi.mock('../src/apps/investments/holdings/presentation/usePortfolio', () => ({
  usePortfolio: () => ({ sources: computed(() => ({ rates: page.rates.value })) }),
}))
vi.mock('../src/apps/investments/prices/presentation/usePrices', () => ({
  usePrices: () => ({
    state: shallowReactive({ fetching: null }),
    async fetchRates(wanted: RatesWanted) {
      page.asked.push(wanted)
      if (page.fetchBrings === null) return { kind: 'failed', message: 'no answer from the ECB' }
      page.rates.value = page.fetchBrings
      return { kind: 'written', file: null }
    },
  }),
}))
vi.mock('../src/apps/investments/prices/presentation/useSplitLookup', () => ({
  useSplitLookup: () => ({ vendorName: 'Alpha Vantage', hasKey: () => false, lookUp: async () => new Map() }),
}))
vi.mock('../src/apps/investments/workbook/application/investmentsStore', () => ({
  useInvestmentsBooks: () => ({ state: shallowReactive({ workbook: { book: book({}) } }) }),
}))

const { useWorkbookImport } = await import('../src/apps/investments/imports/presentation/useWorkbookImport')

const DOLLAR_RATES = rateBookOf(new Map([[USD, [['2024-12-31', '1.04']]]]))

describe('a workbook whose foreign rows have no ECB rate in the prices file yet', () => {
  it('fetches the rates first, from its earliest foreign row, and then shows the steps', async () => {
    page.rates = shallowRef(NO_RATES)
    page.asked.length = 0
    page.fetchBrings = DOLLAR_RATES
    const workbookImport = useWorkbookImport()
    await workbookImport.load('example-portfolio.xlsx', () => sampleWorkbookFile())

    expect(page.asked).toEqual([{ currencies: ['USD'], from: '2025-01-06' }])
    expect(workbookImport.ratesFetch.value).toBeNull()
    expect(workbookImport.ready.value).toBe(true)
    expect(workbookImport.settled.value?.dryRun.entries.some((entry) => entry.outcome.kind === 'waiting' && entry.outcome.reason.kind === 'no-rate')).toBe(false)
  })

  it('says the fetch failed and writes nothing, not even the rows in euros, until a fetch brings them', async () => {
    page.rates = shallowRef(NO_RATES)
    page.fetchBrings = null
    const workbookImport = useWorkbookImport()
    await workbookImport.load('example-portfolio.xlsx', () => sampleWorkbookFile())

    expect(workbookImport.ratesFetch.value).toEqual({ kind: 'failed', currencies: ['USD'], from: '2025-01-06' })
    expect(workbookImport.ready.value).toBe(false)
    expect(workbookImport.settled.value).toBeNull()

    page.fetchBrings = DOLLAR_RATES
    await workbookImport.fetchRates()
    expect(workbookImport.ready.value).toBe(true)
    expect(workbookImport.settled.value).not.toBeNull()
  })

  it('fetches nothing when the prices file holds every rate the rows need', async () => {
    page.rates = shallowRef(DOLLAR_RATES)
    page.asked.length = 0
    const workbookImport = useWorkbookImport()
    await workbookImport.load('example-portfolio.xlsx', () => sampleWorkbookFile())
    expect(page.asked).toEqual([])
    expect(workbookImport.ready.value).toBe(true)
  })
})
