import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import type { PortfolioSources } from '../../holdings/domain/holding'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'

const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()

/**
 * The portfolio as the home card and Kuna's Overview show it: what `shownOf` makes of its figures, a wait
 * while the file or this browser's copy of its prices is read, and nothing for a file with no transactions.
 */
export function shownPortfolio<Shown>(
  shownOf: (portfolio: { readonly book: InvestmentBook; readonly sources: PortfolioSources; readonly figures: PortfolioFigures }) => Shown,
): Shown | 'opening' | 'failed' | null {
  if (state.workbook !== null && hasTransactions(state.workbook.book) && (sources.value === null || figures.value === null)) {
    return 'opening'
  }
  return homeCardFigures(state, (workbook) =>
    sources.value === null || figures.value === null || !hasTransactions(workbook.book) ? null : shownOf({ book: workbook.book, sources: sources.value, figures: figures.value }),
  )
}
