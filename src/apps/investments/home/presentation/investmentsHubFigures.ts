import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import { plural } from '../../../../shared/text/translation'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { INVESTMENTS_OVERVIEW_ROUTE } from '../../overview/presentation/investmentLinks'
import { words } from './words'

/** The portfolio's value for Kuna's Overview, and the held instruments with no price that it leaves out. */
export function investmentsHubFigures(figures: Pick<PortfolioFigures, 'value' | 'unpriced'>): HubFigures<CountedHubPart> {
  const unpriced = figures.unpriced.length
  return {
    parts: [{ label: words.investmentsValue, cents: figures.value, side: 'has', caption: null, to: INVESTMENTS_OVERVIEW_ROUTE }],
    notes: unpriced === 0 ? [] : [plural(words.unpriced(unpriced), unpriced)],
  }
}
