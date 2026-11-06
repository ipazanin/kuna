import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { MOST_COMPARED, askedSlots, pickedOf, slotsText, toggledSlots } from '../domain/scenarioSlots'
import type { PickedScenario } from '../domain/scenarioSlots'
import { rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'

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
