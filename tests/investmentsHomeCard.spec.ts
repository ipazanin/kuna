import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'

import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { fetchTodayAction, homeAmounts } from '../src/apps/investments/home/presentation/investmentsHomeCard'
import { words } from '../src/apps/investments/home/presentation/words'
import { seriesKey } from '../src/apps/investments/prices/domain/pricesFile'
import { quotedPriceBook } from '../src/apps/investments/prices/domain/todaysQuotes'
import { fetchTodayOutcome } from '../src/apps/investments/prices/presentation/useFetchToday'
import type { FetchToday, FetchTodayOff } from '../src/apps/investments/prices/presentation/useFetchToday'
import { words as pricesWords } from '../src/apps/investments/prices/presentation/words'
import type { TodaysQuote } from '../src/apps/investments/prices/domain/todaysQuotes'
import { STOCK_B, WORKED_PRICES, WORKED_RATES, decimal, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-30')

/** A Fetch today quote of Stock B on 30 Oct 2026, the day after the newest worked close. */
const STOCK_B_QUOTE: TodaysQuote = { series: seriesKey(STOCK_B.prices, STOCK_B.sourceSymbol), day: TODAY, price: decimal('59'), at: '2026-10-30T15:40:00.000Z', marketOpen: true }

describe('the figures on the Investments home card', () => {
  const stored = portfolioFigures({ book: workedPortfolio(), prices: WORKED_PRICES, rates: WORKED_RATES, today: TODAY })

  it('shows Value and Total gain alone before any click today, as it did before Fetch today', () => {
    expect(homeAmounts(stored, false).map((amount) => amount.label)).toEqual([words.value, words.totalGain])
  })

  it('shows Today between them once a click brought a quote that counts', () => {
    // Stock B 15 × $59.00 at 1.12 (790.18) − 15 × $58.00 at 1.12 (776.79) = +13.39.
    const live = portfolioFigures({ book: workedPortfolio(), prices: quotedPriceBook(WORKED_PRICES, [STOCK_B_QUOTE]), rates: WORKED_RATES, today: TODAY })

    expect(homeAmounts(live, true)).toEqual([
      { label: words.value, cents: live.value },
      { label: words.today, cents: euros(13.39), tone: 'outcome' },
      { label: words.totalGain, cents: live.totalGain, tone: 'outcome' },
    ])
  })

  it('shows Last day once a click brought nothing newer than the closes, so the click still shows and the label stays true', () => {
    // 29 Oct against 28 Oct, as the Overview's Last day tile reads it.
    expect(homeAmounts(stored, true)[1]).toEqual({ label: words.lastDay, cents: euros(16.82), tone: 'outcome' })
  })
})

function fetchToday(blocked: FetchTodayOff | null, busy: boolean, outcome: string | null): FetchToday {
  return { blocked: computed(() => blocked), busy: computed(() => busy), outcome: ref(outcome), run: () => Promise.resolve() }
}

describe('Fetch today on the Investments home card', () => {
  it('says how many holdings got no price, in the words the Overview shows', async () => {
    const outcome = await fetchTodayOutcome(() => Promise.resolve({ quoted: { day: TODAY, quotes: [], askedOnce: [] }, asked: 3, failed: 2 }))

    expect(outcome).toBe('2 holdings got no price for today.')
  })

  it('says nothing once every holding got its price', async () => {
    expect(await fetchTodayOutcome(() => Promise.resolve({ quoted: { day: TODAY, quotes: [], askedOnce: [] }, asked: 3, failed: 0 }))).toBeNull()
  })

  it('says the prices were not fetched when the fetch fails, so the click never ends in an unhandled rejection', async () => {
    expect(await fetchTodayOutcome(() => Promise.reject(new Error('offline')))).toBe(pricesWords.run.failed)
  })

  it("puts the last click's words under the button", () => {
    expect(fetchTodayAction(fetchToday(null, false, '1 holding got no price for today.'))?.note).toBe('1 holding got no price for today.')
    expect(fetchTodayAction(fetchToday(null, false, null))?.note).toBeNull()
  })

  it('hides the button while a click would ask no vendor, and keeps it while a click is under way', () => {
    const allIn: FetchTodayOff = { line: pricesWords.today.allIn, opensPrices: false }

    expect(fetchTodayAction(fetchToday(allIn, false, null))).toBeNull()
    expect(fetchTodayAction(fetchToday(allIn, true, null))?.busy).toBe(true)
  })
})
