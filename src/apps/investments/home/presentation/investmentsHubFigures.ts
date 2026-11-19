import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import { plural } from '../../../../shared/text/translation'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { INVESTMENTS_OVERVIEW_ROUTE } from '../../overview/presentation/investmentLinks'
import { investmentsNetWorthParts } from '../domain/investmentsNetWorthParts'
import { words } from './words'

/** The portfolio's value for Net worth, and the held instruments with no price that it leaves out. */
export function investmentsHubFigures(figures: Pick<PortfolioFigures, 'value' | 'unpriced'>): HubFigures<CountedHubPart> {
  const unpriced = figures.unpriced.length
  return {
    parts: investmentsNetWorthParts(figures).map((part) => ({ ...part, key: 'investments value', label: words.investmentsValue, caption: null, to: INVESTMENTS_OVERVIEW_ROUTE })),
    notes: unpriced === 0 ? [] : [plural(words.unpriced(unpriced), unpriced)],
  }
}
