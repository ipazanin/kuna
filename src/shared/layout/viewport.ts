import { onScopeDispose, readonly, ref } from 'vue'
import type { Ref } from 'vue'

/** Below Tailwind's `sm` breakpoint: the phone layout, with its bottom bar, sheets and cards. */
export const PHONE_QUERY = '(max-width: 639px)'

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

export function usePhoneLayout(): Readonly<Ref<boolean>> {
  return useMediaQuery(PHONE_QUERY)
}
