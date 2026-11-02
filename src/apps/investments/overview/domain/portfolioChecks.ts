import type { HoldingMix, HoldingMixes } from '../../holdings/domain/holdingMix'
import { heldHoldings } from '../../holdings/domain/holdingsList'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { placedValue, targetGaps, targetedMix } from '../../holdings/domain/targetMix'
import type { RecentCosts } from '../../income/domain/yearlyCosts'
import { CHECKS, CHECK_DEFAULTS } from '../../workbook/domain/checkSetting'
import type { CheckName, CheckSetting } from '../../workbook/domain/checkSetting'
import type { Instrument } from '../../workbook/domain/instrument'
import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import type { Mix, MixGroup } from '../../workbook/domain/mixGroup'
import type { Target } from '../../workbook/domain/target'
import { decimalOfMoney, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What a check measured: a holding, a group of a mix, or the cash or the costs as a whole. */
export type CheckedSubject = { readonly kind: 'holding'; readonly instrument: Instrument } | { readonly kind: 'group'; readonly slice: MixGroup } | { readonly kind: 'whole' }

export interface PortfolioCheck {
  readonly check: CheckName
  readonly subject: CheckedSubject
  /**
   * As a fraction: of the value, of the holdings for sector and country, of the average value for the costs, and for
   * the target gap the points away from the target over 100.
   */
  readonly measured: number
  /** In percent, and in points for the target gap. */
  readonly threshold: Decimal
  readonly over: boolean
}

interface Measured {
  readonly subject: CheckedSubject
  readonly part: Money
  readonly whole: Money
}

/**
 * Each check switched on, with its threshold from its record or its default, failing checks first and then in their
 * own order. A check with nothing to measure is left out: no value, no group placed yet, no target, or no average
 * value for the costs. A share is over its threshold only when it is above it, worked out exactly in cents.
 */
export function portfolioChecks(figures: PortfolioFigures, mixes: HoldingMixes, costs: RecentCosts, targets: readonly Target[], thresholds: readonly CheckSetting[]): PortfolioCheck[] {
  const checked = CHECKS.flatMap((check): PortfolioCheck[] => {
    const setting = thresholds.find((entry) => entry.check === check)
    if (setting?.off === true) return []
    const threshold = setting?.threshold ?? CHECK_DEFAULTS[check]
    if (check === 'target-gap') {
      const gap = largestGap(mixes, targets)
      return gap === null ? [] : [{ check, subject: gap.subject, measured: gap.points, threshold, over: gap.beyond(threshold) }]
    }
    const measured = measuredBy(check, figures, mixes, costs)
    if (measured === null || measured.whole <= 0) return []
    return [{ check, subject: measured.subject, measured: measured.part / measured.whole, threshold, over: shareAbove(measured.part, measured.whole, threshold) }]
  })
  return [...checked.filter((entry) => entry.over), ...checked.filter((entry) => !entry.over)]
}

function measuredBy(check: Exclude<CheckName, 'target-gap'>, figures: PortfolioFigures, mixes: HoldingMixes, costs: RecentCosts): Measured | null {
  switch (check) {
    case 'holding': {
      const largest = heldHoldings(figures)
        .flatMap((holding) => (holding.valuation === null ? [] : [{ instrument: holding.instrument, value: holding.valuation.value }]))
        .sort((first, second) => second.value - first.value)[0]
      return largest === undefined ? null : { subject: { kind: 'holding', instrument: largest.instrument }, part: largest.value, whole: figures.value }
    }
    case 'cash':
      return { subject: { kind: 'whole' }, part: mixes.class.parts.find((part) => part.group === 'cash')?.value ?? ZERO, whole: mixes.class.whole }
    case 'costs':
      return { subject: { kind: 'whole' }, part: costs.total, whole: costs.averageValue }
    default:
      return largestPart(mixes[check])
  }
}

function largestPart(mix: HoldingMix<Mix>): Measured | null {
  const largest = mix.parts[0]
  return largest === undefined ? null : { subject: { kind: 'group', slice: { mix: mix.mix, group: largest.group } as MixGroup }, part: largest.value, whole: mix.whole }
}

/** The group of the targeted mix furthest from its target, in points either way, of the placed value as the target card measures it. */
function largestGap(mixes: HoldingMixes, targets: readonly Target[]): { subject: CheckedSubject; points: number; beyond: (threshold: Decimal) => boolean } | null {
  const targeted = targetedMix(targets)
  if (targeted === null) return null
  const mix: HoldingMix<Mix> = mixes[targeted.mix]
  const placed = placedValue(mix)
  if (placed <= 0) return null
  const whole = decimalOfMoney(placed)
  const lines = targetGaps(mix, targeted.targets).map((line) => {
    // The points between the share and the target, times the placed value: now × 100 − target × placed, in steps of a percent's decimal.
    const away = timesDecimal(decimalOfMoney(line.now), HUNDRED_PERCENT) - timesDecimal(line.target, whole)
    return { group: line.group, away: away < 0n ? -away : away }
  })
  const furthest = lines.sort((first, second) => (second.away > first.away ? 1 : second.away < first.away ? -1 : 0))[0]
  if (furthest === undefined) return null
  return {
    subject: { kind: 'group', slice: { mix: targeted.mix, group: furthest.group } as MixGroup },
    points: Number(furthest.away) / Number(whole) / 100,
    beyond: (threshold) => furthest.away > timesDecimal(threshold, whole),
  }
}

/** Whether part over whole is above the threshold in percent, in exact steps rather than a rounded share. */
function shareAbove(part: Money, whole: Money, threshold: Decimal): boolean {
  return timesDecimal(decimalOfMoney(part), HUNDRED_PERCENT) > timesDecimal(threshold, decimalOfMoney(whole))
}
