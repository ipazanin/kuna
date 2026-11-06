import type { PortfolioCheck } from '../domain/portfolioChecks'
import { groupName } from '../../holdings/presentation/mixDonut'
import type { CheckName } from '../../workbook/domain/checkSetting'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'
import { decimalText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { formatCostShare, formatDecimal, formatQuantity, formatShare } from '../../../../shared/money/moneyFormat'
import { pointsOfShare } from '../../../../shared/money/percent'
import { plural } from '../../../../shared/text/translation'

/** A check as the card lists it. */
export interface CheckLine {
  readonly check: CheckName
  readonly over: boolean
  readonly label: string
  readonly sentence: string
}

/** The most places a threshold keeps, as many as the file does. */
const THRESHOLD_PLACES = 12

/** A threshold as a check reads it, in percent, or in points for the gap to a target. */
export function thresholdText(check: CheckName, threshold: Decimal): string {
  const limit = formatQuantity(threshold, THRESHOLD_PLACES)
  return check === 'target-gap' ? plural(words.checks.points(limit), Number(decimalText(threshold))) : words.checks.percent(limit)
}

/**
 * Each check as a sentence naming what it measured, its share and its threshold, such as "Example Tech is 34.2% of the
 * value, over 20%". A group leads with its name and a colon, since a class or a sector such as Financials is plural.
 */
export function checkLines(checks: readonly PortfolioCheck[], book: Pick<InvestmentBook, 'accounts'>): CheckLine[] {
  const text = words.checks
  return checks.map((entry) => {
    const shown = thresholdText(entry.check, entry.threshold)
    const bound = entry.over ? text.overLimit(shown) : text.withinLimit(shown)
    const name =
      entry.subject.kind === 'holding' ? entry.subject.instrument.name : entry.subject.kind === 'group' ? groupName(entry.subject.slice.mix, entry.subject.slice.group, book) : text.labels.cash
    const sentence =
      entry.check === 'target-gap'
        ? text.gap(name, formatDecimal(pointsOfShare(entry.measured)), bound)
        : entry.check === 'costs'
          ? text.costs(formatCostShare(entry.measured), bound)
          : entry.check === 'sector' || entry.check === 'country'
            ? text.groupOfHoldings(name, formatShare(entry.measured), bound)
            : entry.subject.kind === 'group'
              ? text.groupOfValue(name, formatShare(entry.measured), bound)
              : text.ofValue(name, formatShare(entry.measured), bound)
    return { check: entry.check, over: entry.over, label: text.labels[entry.check], sentence }
  })
}
