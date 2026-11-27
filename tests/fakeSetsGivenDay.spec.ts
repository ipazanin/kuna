import { afterEach, describe, expect, it, vi } from 'vitest'

import { fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices'
import type { FakePricesVariant } from '../src/apps/investments/prices/infrastructure/fake/fakePrices'
import { fakeInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments'
import type { FakeInvestmentsVariant } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments'
import { ratesNeeded } from '../src/apps/spending/rates/domain/ratesNeeded'
import { FAKE_SPENDING_SETS, fakeBeforeItemsDocument, fakeSpendingDocument, fakeStarterDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { everydayRates } from '../src/shared/rates/domain/ratesState'
import { fakeRatesState } from '../src/shared/rates/infrastructure/fake/fakeRatesState'
import { civil } from './fixtures/ledger'

const SAVED_AT = '2026-01-01T00:00:00.000Z'

const DAY = civil('2027-06-01')

/** A wall clock months before the given day and one after it, near Zagreb's midnight. */
const WALL_CLOCKS = ['2026-11-20T22:59:00.000Z', '2027-09-03T23:01:00.000Z']

const INVESTMENTS_VARIANTS: readonly FakeInvestmentsVariant[] = ['sample', 'cash-below-zero', 'young', 'mail', 'mail-typed', 'mail-known', 'mail-symbol', 'sale-2023']

const PRICES_VARIANTS: readonly FakePricesVariant[] = ['sample', 'late-prices', 'no-benchmark']

async function onEachWallClock(build: () => unknown): Promise<unknown[]> {
  vi.useFakeTimers({ toFake: ['Date'] })
  const built: unknown[] = []
  for (const wallClock of WALL_CLOCKS) {
    vi.setSystemTime(new Date(wallClock))
    built.push(await build())
  }
  return built
}

afterEach(() => {
  vi.useRealTimers()
})

describe('a fake set given a day', () => {
  it.each(FAKE_SPENDING_SETS)('builds the %s Spending set and its fake rates the same on any wall clock day', async (set) => {
    const [first, second] = await onEachWallClock(async () => {
      const document = fakeSpendingDocument(SAVED_AT, set, DAY, 'linked')
      const book = SPENDING_DOCUMENT.read({
        meta: { id: 'fake', source: 'browser', title: 'kuna-spending.json', syncedAt: SAVED_AT, lastExportedAt: null, unexportedSince: null },
        revision: '1',
        document,
      }).workbook
      const demand = ratesNeeded(book)
      const everyday = everydayRates(await fakeRatesState(demand, DAY))
      const rates = [...demand.keys()].map((currency) => [currency, everyday.newestDay(currency), everyday.unitsPerEuroOnOrBefore(currency, DAY)])
      return { document, rates }
    })
    expect(second).toEqual(first)
  })

  it('builds the starter and the before-items Spending files the same on any wall clock day', async () => {
    const [first, second] = await onEachWallClock(() => [fakeStarterDocument(SAVED_AT, 'linked', DAY), fakeBeforeItemsDocument(SAVED_AT, DAY), fakeBeforeItemsDocument(SAVED_AT, DAY, true)])
    expect(second).toEqual(first)
  })

  it.each(INVESTMENTS_VARIANTS)('builds the %s Investments set the same on any wall clock day', async (variant) => {
    const [first, second] = await onEachWallClock(() => fakeInvestmentsDocument(SAVED_AT, variant, DAY))
    expect(second).toEqual(first)
  })

  it.each(PRICES_VARIANTS)('builds the %s prices file the same on any wall clock day', async (variant) => {
    const [first, second] = await onEachWallClock(() => fakePricesFile(variant, DAY))
    expect(second).toEqual(first)
  })
})
