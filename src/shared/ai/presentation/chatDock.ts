import { computed, readonly, ref, shallowRef, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import type { ChatElementAbout } from '../domain/chatElement'

/** What a screen says about an element a person can ask the chat about, such as a figure, a row or a receipt. */
export interface AskedElement {
  /** Tells this element apart on the screen, so only it takes the highlight. */
  readonly key: string
  /** Its name as the screen shows it, such as "Cash on hand", on the chip and in the prompt. Never an amount or a payee. */
  readonly label: string
  readonly about: ChatElementAbout
}

/** Wide enough for a 56 px sidebar, a screen's smallest 784 px and a 384 px chat, so no screen gets less than a 1024 px window gives it. */
export const CHAT_DOCK_QUERY = '(min-width: 1224px)'

const open = ref(false)
const element = shallowRef<AskedElement | null>(null)

/** Whether the panel shows. The shell's layout follows this, and the address in the pane. */
export const chatOpen = readonly(open)
/** The element the chat is about, or null. */
export const chatElement = readonly(element)

export function openChat(): void {
  open.value = true
}

export function closeChat(): void {
  open.value = false
}

export function removeChatElement(): void {
  element.value = null
}

/** How the highlight draws on the element: a card keeps its surface and turns its border accent, and a borderless row, such as a list or table row, takes a bar on its leading edge. */
export type ChatElementShape = 'card' | 'row'

/**
 * For an element a person can ask the chat about. `ask` opens the chat about it, in place of any element before. The
 * element binds `marked` with `v-bind`, so it takes the highlight while the open chat is about it. The looks are in `app.css`.
 */
export function useChatElement(
  asked: MaybeRefOrGetter<AskedElement>,
  shape: ChatElementShape,
): { readonly ask: () => void; readonly marked: ComputedRef<{ readonly 'data-chat-tagged'?: ChatElementShape }> } {
  return {
    ask: () => {
      element.value = toValue(asked)
      open.value = true
    },
    marked: computed(() => (open.value && element.value?.key === toValue(asked).key ? { 'data-chat-tagged': shape } : {})),
  }
}
