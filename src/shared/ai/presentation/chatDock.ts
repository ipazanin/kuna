import { computed, readonly, ref, shallowRef } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute } from 'vue-router'

/**
 * The element a chat is about, such as a figure, a row or a receipt. It names the element and holds nothing of what it
 * says: its label goes to the model as it is, so a label is a name such as "Cash on hand" and never an amount or a payee.
 */
export interface ChatTag {
  /** What the element on screen binds through `chatTagAttrs`. */
  readonly key: string
  readonly label: string
  /** The screen it sits on, or null outside any. */
  readonly screen: string | null
}

const open = ref(false)
const tag = shallowRef<ChatTag | null>(null)

/** Whether the panel shows. The shell's layout follows this, and the address in the pane. */
export const chatOpen = readonly(open)
/** The element the chat is about, or null. */
export const chatTag = readonly(tag)

export function openChat(): void {
  open.value = true
}

export function closeChat(): void {
  open.value = false
}

export function removeChatTag(): void {
  tag.value = null
}

/** For a button that opens the chat about one element. A new tag takes the place of the last. */
export function useChatTagging(): (element: { readonly key: string; readonly label: string }) => void {
  const route = useRoute()
  return ({ key, label }) => {
    tag.value = { key, label, screen: typeof route.meta.title === 'string' ? route.meta.title : null }
    open.value = true
  }
}

/** What an element binds with `v-bind`, so it is highlighted while the open chat is about it. The look is one rule in `app.css`. */
export function chatTagAttrs(key: string): ComputedRef<{ readonly 'data-chat-tagged'?: '' }> {
  return computed(() => (open.value && tag.value?.key === key ? { 'data-chat-tagged': '' } : {}))
}
