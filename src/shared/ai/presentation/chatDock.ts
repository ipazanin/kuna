import { computed, readonly, ref, shallowRef, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import type { ChatElementAbout } from '../domain/chatElement'

/** What a screen says about an element a person can ask the chat about, such as a figure, a row or a receipt. */
export interface AskedElement {
  /** Tells this element apart on the screen, so only it takes the highlight. */
  readonly key: string
  /**
   * Its short name, such as "Cash on hand" or "Gross II, Alex Example, Sep 2026", on the chip and, for a report's figure, in
   * the prompt. Never an amount or a payee. A build-up's label may name an employee, since it stays on this device and the model gets only a ref.
   */
  readonly label: string
  readonly about: ChatElementAbout
}

/** The chat's smallest width in px, beside a screen's smallest. */
export const CHAT_MIN_WIDTH = 384
/** The width the chat opens at until a person drags it, and the one a reset gives back. */
export const CHAT_DEFAULT_WIDTH = CHAT_MIN_WIDTH
/** Where the chat's own column stops growing, so a wider chat would only add margins. */
export const CHAT_MAX_WIDTH = 704
/** The least a screen gets beside the docked chat, which keeps a dashboard in two columns. */
export const PAGE_MIN_WIDTH = 976

const CHAT_WIDTH_KEY = 'kuna.chat-width'

function withinLimits(px: number): number {
  return Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, Math.round(px)))
}

function storedWidth(): number {
  try {
    const stored = localStorage.getItem(CHAT_WIDTH_KEY)
    return stored === null || !Number.isFinite(Number(stored)) ? CHAT_DEFAULT_WIDTH : withinLimits(Number(stored))
  } catch {
    return CHAT_DEFAULT_WIDTH
  }
}

const open = ref(false)
const width = ref(storedWidth())
const element = shallowRef<AskedElement | null>(null)
const request = shallowRef<string | null>(null)

/** Whether the panel shows. The shell's layout follows this, and the address in the pane. */
export const chatOpen = readonly(open)
/** The element the chat is about, or null. */
export const chatElement = readonly(element)

/** What a button that names a task asked the chat to do, which the panel sends once it shows. Null once taken. */
export const chatRequest = readonly(request)

/** Takes the request a button left, so it goes once. */
export function takeChatRequest(): string | null {
  const taken = request.value
  request.value = null
  return taken
}

/** The chat's width in px as a person last set it on this device. A window too narrow for it draws less and keeps this. */
export const chatWidth = readonly(width)

/** Sets the chat's width within its limits and keeps it on this device. The default forgets the choice. */
export function resizeChat(px: number): void {
  const asked = withinLimits(px)
  try {
    if (asked === CHAT_DEFAULT_WIDTH) {
      localStorage.removeItem(CHAT_WIDTH_KEY)
    } else {
      localStorage.setItem(CHAT_WIDTH_KEY, String(asked))
    }
  } catch {
    // Storage denied: the width still holds for this visit.
  }
  width.value = asked
}

/** The width the chat is drawn at when `room` px are left beside the page: the asked width, or less to fit. Null when not even the smallest fits. */
export function chatWidthIn(asked: number, room: number): number | null {
  return room < CHAT_MIN_WIDTH ? null : Math.min(asked, room)
}

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
 * While `asked` is null, as for a row with nothing to ask about, `ask` does nothing and `marked` stays empty. A button that
 * names a task, such as Suggest categories, gives its `task`, which the chat sends by itself. Without one the chat waits for the person.
 */
export function useChatElement(
  asked: MaybeRefOrGetter<AskedElement | null>,
  shape: ChatElementShape,
  task: string | null = null,
): { readonly ask: () => void; readonly marked: ComputedRef<{ readonly 'data-chat-tagged'?: ChatElementShape }> } {
  return {
    ask: () => {
      const about = toValue(asked)
      if (about === null) return
      element.value = about
      request.value = task
      open.value = true
    },
    marked: computed(() => {
      const about = toValue(asked)
      return open.value && about !== null && element.value?.key === about.key ? { 'data-chat-tagged': shape } : {}
    }),
  }
}
