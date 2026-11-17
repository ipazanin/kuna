import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { PortfolioSources } from '../domain/holding'
import { portfolioFigures } from '../domain/portfolioFigures'
import type { PortfolioFigures } from '../domain/portfolioFigures'
import { fetchedFactsBook } from '../../prices/domain/factsBook'
import type { FactsBook } from '../../prices/domain/factsBook'
import { emptyPricesFile } from '../../prices/domain/pricesFile'
import { pricesFileBook, pricesFileRateBook } from '../../prices/domain/pricesFileBooks'
import { quotedPriceBook } from '../../prices/domain/todaysQuotes'
import { usePrices } from '../../prices/presentation/usePrices'
import { zagrebDay } from '../../prices/presentation/zagrebDay'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'

const { state } = useInvestmentsBooks()
const prices = usePrices()
const today = zagrebDay()

/**
 * Waits for this browser's copy of the prices file to be read. Without one only the prices entered by hand count. The
 * quotes Fetch today brought count on their own day only, so a page left open past midnight drops them.
 */
const sources = computed((): PortfolioSources | null => {
  const book = state.workbook?.book
  if (book === undefined || state.choice === null || prices.state.investmentsFileId !== state.choice.id) {
    return null
  }
  const file = prices.state.copy?.file ?? emptyPricesFile()
  const quoted = prices.state.quoted
  const stored = pricesFileBook(file, book.prices)
  return { book, prices: quoted !== null && quoted.day === today.value ? quotedPriceBook(stored, quoted.quotes) : stored, rates: pricesFileRateBook(file), today: today.value }
})

const figures = computed(() => (sources.value === null ? null : portfolioFigures(sources.value)))

const facts = computed(() => fetchedFactsBook((prices.state.copy?.file ?? emptyPricesFile()).facts))

export interface Portfolio {
  /** The Investments file on screen with its prices, on today's day in Zagreb, or null while either is being read. */
  readonly sources: ComputedRef<PortfolioSources | null>
  readonly figures: ComputedRef<PortfolioFigures | null>
  /** What the vendors answered about the instruments, as this browser's copy of the prices file holds it. */
  readonly facts: ComputedRef<FactsBook>
}

/** The figures of the Investments file on screen, worked out once for every screen and the home card. */
export function usePortfolio(): Portfolio {
  return { sources, figures, facts }
}
