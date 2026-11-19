import type { Money } from '../../../../shared/money/money'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'

/** What Investments adds to the sum on Net worth: what the portfolio is worth, on the side of what you have. */
export interface InvestmentsNetWorthPart {
  readonly side: 'has'
  readonly cents: Money
}

/** The portfolio's value as the one part Investments adds to Net worth. A held instrument with no price counts as nothing. */
export function investmentsNetWorthParts(figures: Pick<PortfolioFigures, 'value'>): InvestmentsNetWorthPart[] {
  return [{ side: 'has', cents: figures.value }]
}
