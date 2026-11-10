import { spanOf } from './scenarioComparison'
import { words } from './words'
import type { OfferTexts } from '../domain/offerTexts'
import { typedTerm } from '../../bankLoans/domain/typedTerm'
import { fractionOf, typedRate } from '../../bankLoans/domain/yearlyRate'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { typedAmount } from '../../../../shared/money/typedAmount'

/** The name a blank one becomes, such as "€100,000.00 at 4% over 10 y", or empty until the figures are typed. */
export function offerAutoName(texts: OfferTexts): string {
  const principal = typedAmount(texts.principal)
  const rate = typedRate(texts.rate)
  const instalments = typedTerm(texts.years, texts.months)
  return principal === null || rate === null || instalments === null ? '' : words.editor.autoName(formatMoney(principal), formatRate(fractionOf(rate)), spanOf(instalments))
}
