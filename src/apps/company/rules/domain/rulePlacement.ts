import { inTryingOrder } from '../../../../shared/categorising/domain/rule'
import type { Rule } from '../../../../shared/categorising/domain/rule'

/** The step the seeded orders use, so there is room between any two rules. */
const ORDER_STEP = 100

export interface Placement {
  /** The order of the rule being placed. */
  readonly order: number
  /** Other rules whose order has to change to make room, by id. Empty when there was room. */
  readonly renumbered: ReadonlyMap<string, number>
}

/**
 * Where a rule goes so it is tried just before `beforeId`, or last when that is null: halfway
 * between its new neighbours when their orders leave room, else every rule renumbered in steps of
 * 100 in the new order. The rule being placed, if it is on the tab already, is `movingId`.
 */
export function placeBefore(rules: readonly Rule[], movingId: string | null, beforeId: string | null): Placement {
  const others = inTryingOrder(rules).filter((rule) => rule.id !== movingId)
  const index = beforeId === null ? others.length : others.findIndex((rule) => rule.id === beforeId)
  const at = index === -1 ? others.length : index
  const previous = others[at - 1]
  const next = others[at]
  if (next === undefined) {
    return { order: (previous?.order ?? 0) + ORDER_STEP, renumbered: new Map() }
  }
  if (previous === undefined) {
    return { order: next.order - ORDER_STEP, renumbered: new Map() }
  }
  if (previous.order < next.order) {
    return { order: (previous.order + next.order) / 2, renumbered: new Map() }
  }
  const sequence: (Rule | null)[] = [...others.slice(0, at), null, ...others.slice(at)]
  return {
    order: (at + 1) * ORDER_STEP,
    renumbered: changedOrders(sequence),
  }
}

/**
 * The new orders when a rule trades places with the one tried just before or after it. Two
 * different orders are swapped, so every order stays on its step. Two equal ones cannot be, so
 * then every rule is renumbered in steps of 100. Null when there is no neighbour that way.
 */
export function swapWithNeighbour(rules: readonly Rule[], id: string, way: 'earlier' | 'later'): ReadonlyMap<string, number> | null {
  const ordered = inTryingOrder(rules)
  const index = ordered.findIndex((rule) => rule.id === id)
  const neighbourIndex = way === 'earlier' ? index - 1 : index + 1
  const moving = ordered[index]
  const neighbour = ordered[neighbourIndex]
  if (index === -1 || moving === undefined || neighbour === undefined) {
    return null
  }
  if (moving.order !== neighbour.order) {
    return new Map([
      [moving.id, neighbour.order],
      [neighbour.id, moving.order],
    ])
  }
  const swapped = [...ordered]
  swapped[index] = neighbour
  swapped[neighbourIndex] = moving
  return changedOrders(swapped)
}

/** Each rule's order in steps of 100 down the sequence, for the rules whose order that changes. A null slot is the rule being placed. */
function changedOrders(sequence: readonly (Rule | null)[]): Map<string, number> {
  const changed = new Map<string, number>()
  sequence.forEach((rule, position) => {
    const order = (position + 1) * ORDER_STEP
    if (rule !== null && rule.order !== order) {
      changed.set(rule.id, order)
    }
  })
  return changed
}

/** Rules added together, each with its order, and the rules already there whose order changes to make room, by id. */
export interface RulesPlaced {
  readonly added: readonly Rule[]
  readonly renumbered: ReadonlyMap<string, number>
}

/**
 * Where several new rules go, each placed in turn as `placeBefore` places one, just before the rule its `before` names, or
 * last when that is null or names no rule there is. A rule placed earlier counts as there for the ones after it.
 */
export function placeRules(rules: readonly Rule[], adding: readonly { readonly rule: Rule; readonly before: string | null }[]): RulesPlaced {
  let placed: Rule[] = [...rules]
  for (const { rule, before } of adding) {
    const placement = placeBefore(placed, null, before !== null && placed.some((held) => held.id === before) ? before : null)
    placed = [...placed.map((held) => ({ ...held, order: placement.renumbered.get(held.id) ?? held.order })), { ...rule, order: placement.order }]
  }
  const ids = new Set(adding.map(({ rule }) => rule.id))
  const orders = new Map(rules.map((rule) => [rule.id, rule.order]))
  return {
    added: placed.filter((rule) => ids.has(rule.id)),
    renumbered: new Map(placed.filter((rule) => !ids.has(rule.id) && orders.get(rule.id) !== rule.order).map((rule) => [rule.id, rule.order])),
  }
}
