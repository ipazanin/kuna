import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { PricesFetching } from '../application/pricesUpdate'
import { plural } from '../../../../shared/text/translation'
import { usePrices } from './usePrices'
import { words } from './words'

/** A pause shorter than this, such as the gap between two Alpha Vantage requests, passes before anyone reads it. */
const SHOWN_PAUSE_MILLISECONDS = 3_000
/** Below this the line says no time, since the next request is a moment away. */
const SHOWN_LEFT_MILLISECONDS = 45_000

/**
 * The fetch under way in one line: how many series it has asked for of how many and about how long its pacing still
 * needs, or the vendor whose minute is used up and how long Kuna waits for it.
 */
export function fetchingLine(fetching: PricesFetching, now: number): string {
  if (fetching.of === null || fetching.of === 0) {
    return words.fetching
  }
  const count = words.fetchingCount(fetching.asked, fetching.of)
  const pauseLeft = fetching.pause === null ? 0 : Date.parse(fetching.pause.until) - now
  if (fetching.pause !== null && pauseLeft >= SHOWN_PAUSE_MILLISECONDS) {
    const seconds = Math.ceil(pauseLeft / 1000)
    return `${count}. ${plural(words.waiting(seconds, fetching.pause.vendor, fetching.pause.perMinute), seconds)}.`
  }
  if (fetching.leftMilliseconds < SHOWN_LEFT_MILLISECONDS) {
    return count
  }
  const minutes = Math.max(1, Math.round(fetching.leftMilliseconds / 60_000))
  return `${count}, ${plural(words.minutesLeft(minutes), minutes)}`
}

/** What a screen reader hears of the fetch under way: the count alone, which changes once a series and not once a second. */
export function fetchingAnnouncement(fetching: PricesFetching | null): string {
  return fetching === null ? '' : fetching.of === null || fetching.of === 0 ? words.fetching : words.fetchingCount(fetching.asked, fetching.of)
}

/** The line of a fetch under way, which counts a pause down by the second, or null while none runs. */
export function useFetchingLine(fetching: () => PricesFetching | null): ComputedRef<string | null> {
  const now = ref(Date.now())
  let ticking: number | null = null
  const stop = (): void => {
    if (ticking !== null) window.clearInterval(ticking)
    ticking = null
  }
  watch(
    () => fetching()?.pause ?? null,
    (pause) => {
      stop()
      now.value = Date.now()
      if (pause !== null) {
        ticking = window.setInterval(() => {
          now.value = Date.now()
        }, 1000)
      }
    },
    { immediate: true },
  )
  onScopeDispose(stop)
  return computed(() => {
    const shown = fetching()
    return shown === null ? null : fetchingLine(shown, now.value)
  })
}

/** The line of the page's prices fetch under way, or null while none runs. */
export function usePricesFetchingLine(): ComputedRef<string | null> {
  const prices = usePrices()
  return useFetchingLine(() => prices.state.fetching)
}
