import type { MixPart } from './holdingMix'
import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import type { Mix } from '../../workbook/domain/mixGroup'
import type { Target } from '../../workbook/domain/target'
import { DECIMAL_ZERO, moneyParts, subtractDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, addMoney, ratioOf, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

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
  /** Its share of the whole now, null when the whole is zero. */
  readonly share: number | null
  /** In percent, zero for a group held with no target. */
  readonly target: Decimal
  /** The target's part of the whole less what the group holds: above zero it lacks that much, below zero it holds that much beyond its target. */
  readonly gap: Money
}

/** What a deposit buys of one group. */
export interface DepositLine<Group extends string> {
  readonly group: Group
  readonly buy: Money
}

/**
 * Each group with a target or with a value, against the whole the mix splits: the holdings alone for sector and
 * country, else the whole value. Groups come by their target, largest first, then by what they hold.
 */
export function targetGaps<Group extends string>(parts: readonly MixPart<Group>[], targets: readonly Target[], whole: Money): TargetGap<Group>[] {
  return linesOf(parts, targets).map(({ group, now, target }) => ({ group, now, share: ratioOf(now, whole), target, gap: subtractMoney(partOf(whole, target), now) }))
}

/**
 * What a deposit buys of each group, in the order of `targetGaps`. It fills what each group lacks against the whole
 * with the deposit in it, in proportion when it cannot fill it all, the last group that lacks something taking the
 * rest so the buys add up to the deposit. Since the targets add up to 100%, what the groups lack is never less than the deposit.
 */
export function depositSplit<Group extends string>(parts: readonly MixPart<Group>[], targets: readonly Target[], whole: Money, deposit: Money): DepositLine<Group>[] {
  const after = addMoney(whole, deposit)
  const lines = linesOf(parts, targets).map((line) => ({ group: line.group, lacks: Math.max(0, subtractMoney(partOf(after, line.target), line.now)) }))
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

function linesOf<Group extends string>(parts: readonly MixPart<Group>[], targets: readonly Target[]): TargetLine<Group>[] {
  const held = new Map<string, Money>(parts.map((part) => [part.group, part.value]))
  const targeted = targets.map((target) => ({ group: target.slice.group as Group, now: held.get(target.slice.group) ?? ZERO, target: target.percent }))
  const named = new Set<string>(targeted.map((line) => line.group))
  const untargeted = parts.filter((part) => !named.has(part.group)).map((part) => ({ group: part.group, now: part.value, target: DECIMAL_ZERO }))
  return [...targeted, ...untargeted].sort((first, second) => Number(second.target - first.target) || second.now - first.now)
}

/** The percent's part of an amount, to the cent. */
function partOf(amount: Money, percent: Decimal): Money {
  return moneyParts(amount, [percent, subtractDecimal(HUNDRED_PERCENT, percent)])[0] ?? ZERO
}
