import { onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * The bars that stay at the top of the window while a screen scrolls, such as the phone's top bar
 * and a filter bar under it, stack into one band. Its height is kept in `--sticky-band`, which
 * app.css gives every linked part as its `scroll-margin-top`, so a link lands just below the band.
 */

const parts = new Set<HTMLElement>()
const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
let height = 0

function measure(): void {
  height = [...parts].filter((part) => part.isConnected && getComputedStyle(part).position === 'sticky').reduce((sum, part) => sum + part.offsetHeight, 0)
  document.documentElement.style.setProperty('--sticky-band', `${height}px`)
}

/** The band's height in pixels as last measured. */
export function stickyBandHeight(): number {
  return height
}

/** Counts the element in the band while it is on screen and sticky. */
export function useStickyBandPart(element: Readonly<Ref<HTMLElement | null>>): void {
  watch(
    element,
    (current, previous) => {
      if (previous) {
        parts.delete(previous)
        observer?.unobserve(previous)
      }
      if (current) {
        parts.add(current)
        observer?.observe(current)
      }
      measure()
    },
    { immediate: true, flush: 'post' },
  )
  onBeforeUnmount(() => {
    if (element.value) {
      parts.delete(element.value)
      observer?.unobserve(element.value)
    }
    measure()
  })
}
