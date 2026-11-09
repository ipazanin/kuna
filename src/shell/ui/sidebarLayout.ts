import { readonly, ref } from 'vue'

import { CHAT_MAX_WIDTH, chatWidthIn, PAGE_MIN_WIDTH } from '../../shared/ai/presentation/chatDock'

/** How a person wants the sidebar from 1024 px: with names, as icons, or out of the way behind the top bar's menu button. */
export type SidebarChoice = 'expanded' | 'icons' | 'hidden'

/** What the shell draws: the chosen sidebar, icons while the chat needs the room, or the top bar's drawer below 1024 px. */
export type SidebarForm = SidebarChoice | 'drawer'

/** Where the open chat sits. Docked beside the page with its drawn width and the widest its handle may go, or in the page's place. */
export type ChatPlace = { readonly at: 'closed' } | { readonly at: 'page' } | { readonly at: 'dock'; readonly width: number; readonly widest: number }

export interface ShellLayout {
  readonly sidebar: SidebarForm
  readonly chat: ChatPlace
}

/** The narrowest window that draws a sidebar. Narrower, the menu is the top bar's drawer and the choice waits. */
export const SIDEBAR_FROM_WIDTH = 1024

/** Each sidebar's width in px. Hidden and the drawer leave the top bar, which takes no width beside the page. */
export const SIDEBAR_WIDTH: Readonly<Record<SidebarForm, number>> = { expanded: 240, icons: 56, hidden: 0, drawer: 0 }

const SIDEBAR_KEY = 'kuna.sidebar'

function storedChoice(): SidebarChoice {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY)
    return stored === 'icons' || stored === 'hidden' ? stored : 'expanded'
  } catch {
    return 'expanded'
  }
}

const choice = ref<SidebarChoice>(storedChoice())

/** The sidebar this device asked for. What is drawn also depends on the window and the chat, as `layoutOf` decides. */
export const sidebarChoice = readonly(choice)

/** Keeps the sidebar choice on this device. Expanded is the default and forgets the choice. */
export function chooseSidebar(chosen: SidebarChoice): void {
  try {
    if (chosen === 'expanded') {
      localStorage.removeItem(SIDEBAR_KEY)
    } else {
      localStorage.setItem(SIDEBAR_KEY, chosen)
    }
  } catch {
    // Storage denied: the choice still holds for this visit.
  }
  choice.value = chosen
}

/**
 * What the shell draws for a window `windowWidth` px wide, with `chat` the chat's asked width while it is open, or null.
 * The sidebar stays as chosen while it, the smallest page and the chat fit. An expanded sidebar then shows as icons
 * while the chat is open, and the chat narrows to the room left down to its smallest. With less room the chat takes the
 * page's place and the sidebar stays as chosen. The handle may widen the chat as far as the icons leave room, so
 * dragging moves between expanded and icons.
 */
export function layoutOf(asked: { readonly choice: SidebarChoice; readonly windowWidth: number; readonly chat: number | null }): ShellLayout {
  const { choice: chosen, windowWidth, chat } = asked
  const sidebar: SidebarForm = windowWidth < SIDEBAR_FROM_WIDTH ? 'drawer' : chosen
  if (chat === null) return { sidebar, chat: { at: 'closed' } }

  const room = windowWidth - SIDEBAR_WIDTH[sidebar === 'expanded' ? 'icons' : sidebar] - PAGE_MIN_WIDTH
  const width = chatWidthIn(chat, room)
  if (width === null) return { sidebar, chat: { at: 'page' } }

  const expandedFits = SIDEBAR_WIDTH.expanded + PAGE_MIN_WIDTH + width <= windowWidth
  return { sidebar: sidebar === 'expanded' && !expandedFits ? 'icons' : sidebar, chat: { at: 'dock', width, widest: Math.min(CHAT_MAX_WIDTH, room) } }
}
