import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { MOST_COMPARED } from './scenarioComparison'
import { rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'

/** A picked scenario's key in each slot from the first, null where a slot is free. */
export type ScenarioSlots = readonly (string | null)[]

/** The slots the address holds, such as `b,,d`, with the keys the screen does not have, or holds twice, freed. */
export function slotsOf(text: string, available: readonly string[], size: number): ScenarioSlots {
  const slots = text
    .split(',')
    .slice(0, size)
    .map((key, index, keys) => (available.includes(key) && keys.indexOf(key) === index ? key : null))
  return withoutFreeTail(slots)
}

function withoutFreeTail(slots: ScenarioSlots): ScenarioSlots {
  const last = slots.reduce((held, key, index) => (key === null ? held : index), -1)
  return slots.slice(0, last + 1)
}

/** The slots with the key unpicked, leaving its slot free so the others keep their letters, or picked into the first free slot. Unchanged when every slot is taken. */
export function toggledSlots(slots: ScenarioSlots, key: string, size: number): ScenarioSlots {
  if (slots.includes(key)) return withoutFreeTail(slots.map((held) => (held === key ? null : held)))
  const free = slots.indexOf(null)
  if (free !== -1) return slots.map((held, index) => (index === free ? key : held))
  return slots.length < size ? [...slots, key] : slots
}

export function slotsText(slots: ScenarioSlots): string {
  return slots.map((key) => key ?? '').join(',')
}

/** A compared column: the key, and the slot that gives its letter and colour. */
export interface PickedScenario {
  readonly key: string
  readonly slot: number
}

/** The compared columns the slots give, from A. */
export function pickedOf(slots: ScenarioSlots): PickedScenario[] {
  return slots.flatMap((key, index) => (key === null ? [] : [{ key, slot: index + 1 }]))
}

/**
 * The slots the address asks for, or the first scenarios when it asks for none. A `?compare=` that names
 * none of the scenarios, such as one left by a deleted offer, counts as no ask, while an empty one means
 * every slot was unpicked.
 */
export function askedSlots(text: string | null, available: readonly string[], size: number): ScenarioSlots {
  const stale = text !== null && text !== '' && !text.split(',').some((key) => available.includes(key))
  return text === null || stale ? available.slice(0, size) : slotsOf(text, available, size)
}

export interface ScenarioCompare {
  readonly picked: ComputedRef<readonly PickedScenario[]>
  readonly base: ComputedRef<string | null>
  /** What the reader's savings earn, or null until they type it. */
  readonly savings: ComputedRef<YearlyRate | null>
  toggle(key: string): void
  pickBase(key: string): void
  setSavings(text: string): void
}

/**
 * The offers compared and their slots, the base and the savings rate, kept in the address as
 * `?compare=`, `?base=` and `?savings=`, so a reload or a shared link keeps them and nothing is written.
 * Four slots, of which one stays picked. With no `?compare=`, the first offers fill the slots.
 */
export function useScenarioCompare(scenarios: () => readonly string[]): ScenarioCompare {
  const route = useRoute()
  const router = useRouter()
  const asked = (name: string): string | null => (typeof route.query[name] === 'string' ? route.query[name] : null)

  const slots = computed(() => askedSlots(asked('compare'), scenarios(), MOST_COMPARED))
  const picked = computed(() => pickedOf(slots.value))
  const base = computed(() => {
    const wanted = asked('base')
    return picked.value.find((entry) => entry.key === wanted)?.key ?? picked.value[0]?.key ?? null
  })
  const savings = computed(() => typedRate(asked('savings') ?? ''))

  const replace = (query: Record<string, string | undefined>): void => {
    void router.replace({ query: { ...route.query, ...query } })
  }
  return {
    picked,
    base,
    savings,
    toggle: (key) => {
      const next = toggledSlots(slots.value, key, MOST_COMPARED)
      if (next.every((held) => held === null)) return
      replace({ compare: slotsText(next) })
    },
    pickBase: (key) => replace({ base: key }),
    setSavings: (text) => {
      const rate = typedRate(text)
      replace({ savings: rate === null ? undefined : rateText(rate) })
    },
  }
}
