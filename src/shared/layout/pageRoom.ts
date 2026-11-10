import { computed, readonly, ref } from 'vue'
import type { ComputedRef } from 'vue'

const room = ref(typeof window === 'undefined' ? 0 : window.innerWidth)

/**
 * The width in px a page's content gets inside its padding. The shell works it out from the window, the sidebar and the
 * docked chat, so a page reads its room without measuring itself.
 */
export const pageRoom = readonly(room)

/** Sets the page's room. Only the shell's layout calls it. */
export function givePageRoom(px: number): void {
  room.value = px
}

/** Whether the page's content is at least `rem` rem wide, as a container query on the shell's content area asks. */
export function roomAtLeast(rem: number): ComputedRef<boolean> {
  return computed(() => room.value >= rem * parseFloat(getComputedStyle(document.documentElement).fontSize))
}
