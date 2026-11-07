import type { GroupOf, HoldingMix } from './holdingMix'
import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import type { Mix } from '../../workbook/domain/mixGroup'
import type { Target } from '../../workbook/domain/target'
import { DECIMAL_ZERO, moneyParts, subtractDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, addMoney, ratioOf, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Share } from '../../../../shared/money/percent'

/** The mix the targets are set for, with its targets. */
export interface TargetedMix {
  readonly mix: Mix
  readonly targets: readonly Target[]
}

/**
 * The mix of the first target with the targets of that mix. A file holds targets of one mix, but the reader lets a
 * hand-edited file hold several, so the targets of any other mix are left out.
 */
export function targetedMix(targets: readonly Target[]): TargetedMix | null {
  const mix = targets[0]?.slice.mix
  return mix === undefined ? null : { mix, targets: targets.filter((target) => target.slice.mix === mix) }
}

/** One group of the mix that has targets, against its target. */
export interface TargetGap<Group extends string> {
  readonly group: Group
  /** What the group holds now. */
  readonly now: Money
  /** Its share of the placed value now, null when nothing is placed. */
  readonly share: Share | null
  /** In percent, zero for a group held with no target. */
  readonly target: Decimal
  /** The target's part of the placed value less what the group holds: above zero it lacks that much, below zero it holds that much beyond its target. */
  readonly gap: Money
}

/** What a deposit buys of one group. */
export interface DepositLine<Group extends string> {
  readonly group: Group
  readonly buy: Money
}

/**
 * What the targets split: the value a source places in a group, so for sector and country the holdings less those no
 * source places yet, and the whole value for the other mixes.
 */
export function placedValue(mix: Pick<HoldingMix<Mix>, 'whole' | 'unknown'>): Money {
  return subtractMoney(mix.whole, mix.unknown)
}

/** Each group with a target or with a value, against the placed value. Groups come by their target, largest first, then by what they hold. */
export function targetGaps<Of extends Mix>(mix: HoldingMix<Of>, targets: readonly Target[]): TargetGap<GroupOf<Of>>[] {
  const placed = placedValue(mix)
  return linesOf(mix, targets).map(({ group, now, target }) => ({ group, now, share: ratioOf(now, placed), target, gap: subtractMoney(partOf(placed, target), now) }))
}

/**
 * What a deposit buys of each group, in the order of `targetGaps`. It fills what each group lacks against the placed
 * value with the deposit in it, in proportion when it cannot fill it all, the last group that lacks something taking the
 * rest so the buys add up to the deposit. Since the targets add up to 100%, what the groups lack is never less than the deposit.
 */
export function depositSplit<Of extends Mix>(mix: HoldingMix<Of>, targets: readonly Target[], deposit: Money): DepositLine<GroupOf<Of>>[] {
  const after = addMoney(placedValue(mix), deposit)
  const lines = linesOf(mix, targets).map((line) => ({ group: line.group, lacks: Math.max(0, subtractMoney(partOf(after, line.target), line.now)) }))
  const lacking = lines.filter((line) => line.lacks > 0)
  const buys = moneyParts(
    deposit,
    lacking.map((line) => BigInt(line.lacks)),
  )
  const bought = new Map(lacking.map((line, index) => [line.group, buys[index] ?? ZERO]))
  return lines.map((line) => ({ group: line.group, buy: bought.get(line.group) ?? ZERO }))
}

interface TargetLine<Group extends string> {
  readonly group: Group
  readonly now: Money
  readonly target: Decimal
}

function linesOf<Of extends Mix>(mix: HoldingMix<Of>, targets: readonly Target[]): TargetLine<GroupOf<Of>>[] {
  const held = new Map<string, Money>(mix.parts.map((part) => [part.group, part.value]))
  const targeted = targets.map((target) => ({ group: target.slice.group as GroupOf<Of>, now: held.get(target.slice.group) ?? ZERO, target: target.percent }))
  const named = new Set<string>(targeted.map((line) => line.group))
  const untargeted = mix.parts.filter((part) => !named.has(part.group)).map((part) => ({ group: part.group, now: part.value, target: DECIMAL_ZERO }))
  return [...targeted, ...untargeted].sort((first, second) => Number(second.target - first.target) || second.now - first.now)
}

/** The percent's part of an amount, to the cent. */
function partOf(amount: Money, percent: Decimal): Money {
  return moneyParts(amount, [percent, subtractDecimal(HUNDRED_PERCENT, percent)])[0] ?? ZERO
}
