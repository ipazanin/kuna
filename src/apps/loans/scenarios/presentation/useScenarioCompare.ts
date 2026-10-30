import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { MOST_COMPARED } from './scenarioComparison'
import { rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'

/** The key of the Offers tab, beside one tab per bank loan. */
export const OFFERS_TAB = 'offers'

/** The key of a loan's own column, A, which every loan tab compares against. */
export const AS_IT_STANDS = 'as-it-stands'

/** A picked scenario's key in each slot from the first, null where a slot is free. */
export type ScenarioSlots = readonly (string | null)[]

/** The slots the address holds, such as `b,,d`, with the keys the tab does not have, or holds twice, freed. */
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

export interface ScenarioCompare {
  readonly tab: ComputedRef<string>
  readonly picked: ComputedRef<readonly PickedScenario[]>
  readonly base: ComputedRef<string>
  /** What the reader's savings earn, or null until they type it. */
  readonly savings: ComputedRef<YearlyRate | null>
  toggle(key: string): void
  pickBase(key: string): void
  pickTab(tab: string): void
  setSavings(text: string): void
}

/**
 * The tab, the scenarios compared and their slots, the base and the savings rate, kept in the
 * address as `?tab=`, `?compare=`, `?base=` and `?savings=`, so a reload or a shared link keeps them
 * and nothing is written. A loan's tab holds the loan as it stands in A and three slots after it,
 * the Offers tab four, of which one stays picked. With no `?compare=`, the first scenarios fill the slots.
 */
export function useScenarioCompare(tabs: () => readonly string[], scenariosOf: (tab: string) => readonly string[]): ScenarioCompare {
  const route = useRoute()
  const router = useRouter()
  const asked = (name: string): string | null => (typeof route.query[name] === 'string' ? route.query[name] : null)

  const tab = computed(() => {
    const wanted = asked('tab')
    return wanted !== null && tabs().includes(wanted) ? wanted : (tabs()[0] ?? OFFERS_TAB)
  })
  const offers = computed(() => tab.value === OFFERS_TAB)
  const size = computed(() => (offers.value ? MOST_COMPARED : MOST_COMPARED - 1))
  const slots = computed(() => {
    const available = scenariosOf(tab.value)
    const text = asked('compare')
    return text === null ? available.slice(0, size.value) : slotsOf(text, available, size.value)
  })
  const picked = computed(() => {
    const first = offers.value ? 1 : 2
    const chosen = slots.value.flatMap((key, index) => (key === null ? [] : [{ key, slot: first + index }]))
    return offers.value ? chosen : [{ key: AS_IT_STANDS, slot: 1 }, ...chosen]
  })
  const base = computed(() => {
    const wanted = asked('base')
    return picked.value.find((entry) => entry.key === wanted)?.key ?? picked.value[0]?.key ?? AS_IT_STANDS
  })
  const savings = computed(() => typedRate(asked('savings') ?? ''))

  const replace = (query: Record<string, string | undefined>): void => {
    void router.replace({ query: { ...route.query, ...query } })
  }
  return {
    tab,
    picked,
    base,
    savings,
    toggle: (key) => {
      const next = toggledSlots(slots.value, key, size.value)
      if (offers.value && next.every((held) => held === null)) return
      replace({ compare: slotsText(next) })
    },
    pickBase: (key) => replace({ base: key }),
    pickTab: (next) => replace({ tab: next, compare: undefined, base: undefined }),
    setSavings: (text) => {
      const rate = typedRate(text)
      replace({ savings: rate === null ? undefined : rateText(rate) })
    },
  }
}
