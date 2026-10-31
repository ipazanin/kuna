import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { PortfolioSources } from '../domain/holding'
import { portfolioFigures } from '../domain/portfolioFigures'
import type { PortfolioFigures } from '../domain/portfolioFigures'
import { pricesDay } from '../../prices/application/pricesUpdate'
import { emptyPricesFile } from '../../prices/domain/pricesFile'
import { pricesFileBook, pricesFileRateBook } from '../../prices/domain/pricesFileBooks'
import { usePrices } from '../../prices/presentation/usePrices'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'

const { state } = useInvestmentsBooks()
const prices = usePrices()

/** Waits for this browser's copy of the prices file to be read. Without one only the prices entered by hand count. */
const sources = computed((): PortfolioSources | null => {
  const book = state.workbook?.book
  if (book === undefined || state.choice === null || prices.state.investmentsFileId !== state.choice.id) {
    return null
  }
  const file = prices.state.copy?.file ?? emptyPricesFile()
  return { book, prices: pricesFileBook(file, book.prices), rates: pricesFileRateBook(file), today: pricesDay(new Date().toISOString()) }
})

const figures = computed(() => (sources.value === null ? null : portfolioFigures(sources.value)))

export interface Portfolio {
  /** The Investments file on screen with its prices, on today's day in Zagreb, or null while either is being read. */
  readonly sources: ComputedRef<PortfolioSources | null>
  readonly figures: ComputedRef<PortfolioFigures | null>
}

/** The figures of the Investments file on screen, worked out once for every screen and the home card. */
export function usePortfolio(): Portfolio {
  return { sources, figures }
}
