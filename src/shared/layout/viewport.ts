import { onScopeDispose, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

/** Tailwind's `sm` breakpoint. Below it is the phone layout, with its top app bar, drawer, sheets and cards. */
export const PHONE_BELOW = 640

/** The narrowest a page ever gets. A sidebar or a docked chat shows only where it leaves the page this much. */
export const PAGE_LEAST_WIDTH = 640

const PHONE_QUERY = `(max-width: ${PHONE_BELOW - 1}px)`

/** Whether a media query matches, kept current until the calling component or scope goes away. */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const list = window.matchMedia(query)
  const matches = ref(list.matches)
  const follow = (change: MediaQueryListEvent): void => {
    matches.value = change.matches
  }
  list.addEventListener('change', follow)
  onScopeDispose(() => list.removeEventListener('change', follow))
  return readonly(matches)
}

/** The width the window lays a page out in, without a classic scrollbar's gutter. */
export function windowWidthNow(): number {
  return document.documentElement.clientWidth
}

/** The window's width in px as `windowWidthNow` reads it, kept current until the calling component or scope goes away. */
export function useWindowWidth(): Readonly<Ref<number>> {
  const width = ref(windowWidthNow())
  const follow = (): void => {
    width.value = windowWidthNow()
  }
  window.addEventListener('resize', follow)
  onScopeDispose(() => window.removeEventListener('resize', follow))
  return readonly(width)
}

export function usePhoneLayout(): Readonly<Ref<boolean>> {
  return useMediaQuery(PHONE_QUERY)
}

/**
 * The height from an element's top down to what a phone's keyboard leaves showing, in pixels, or null where the browser
 * cannot say. `dvh` does not follow the keyboard, and `interactive-widget` would change every screen.
 */
export function useHeightAboveKeyboard(element: Readonly<Ref<HTMLElement | null>>): Readonly<Ref<number | null>> {
  const height = ref<number | null>(null)
  const viewport = window.visualViewport
  if (viewport === null) return readonly(height)
  const measure = (): void => {
    height.value = element.value === null ? null : viewport.height + viewport.offsetTop - element.value.getBoundingClientRect().top
  }
  viewport.addEventListener('resize', measure)
  viewport.addEventListener('scroll', measure)
  watch(element, measure, { flush: 'post' })
  onScopeDispose(() => {
    viewport.removeEventListener('resize', measure)
    viewport.removeEventListener('scroll', measure)
  })
  return readonly(height)
}
