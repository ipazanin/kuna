import { readonly, ref } from 'vue'

import { CHAT_MAX_WIDTH, chatWidthIn } from '../../shared/ai/presentation/chatDock'
import { deviceChoice } from '../../shared/device/deviceChoice'
import { PAGE_LEAST_WIDTH } from '../../shared/layout/viewport'

/** How a person wants the sidebar: with names, as icons, or out of the way behind the top bar's menu button. */
export type SidebarChoice = 'expanded' | 'icons' | 'hidden'

/** What the shell draws: the chosen sidebar, or the top bar's drawer while the window has no room for it beside the page. */
export type SidebarForm = SidebarChoice | 'drawer'

/** Where the open chat sits. Docked beside the page with its drawn width and the widest its handle may go, or in the page's place. */
export type ChatPlace = { readonly at: 'closed' } | { readonly at: 'page' } | { readonly at: 'dock'; readonly width: number; readonly widest: number }

export interface ShellLayout {
  readonly sidebar: SidebarForm
  readonly chat: ChatPlace
  /** The page column's width in px. While the chat is in the page's place, the width the page comes back to. */
  readonly page: number
}

/** Each sidebar's width in px. Hidden and the drawer leave the top bar, which takes no width beside the page. */
export const SIDEBAR_WIDTH: Readonly<Record<SidebarForm, number>> = { expanded: 240, icons: 56, hidden: 0, drawer: 0 }

/**
 * Below this window height the expanded sidebar's footer folds into its logo beside Sync, since Company's menu with five
 * apps needs about 852 px with the footer on its own row. Shorter still, the list of pages scrolls.
 */
export const FOOTER_FOLDS_BELOW_HEIGHT = 860

const kept = deviceChoice<SidebarChoice>('kuna.sidebar', 'expanded', { read: (stored) => (stored === 'icons' || stored === 'hidden' ? stored : null), write: (chosen) => chosen })

const choice = ref<SidebarChoice>(kept.read())

/** The sidebar this device asked for. What is drawn also depends on the window, as `layoutOf` decides. */
export const sidebarChoice = readonly(choice)

/** Keeps the sidebar choice on this device. Expanded is the default and forgets the choice. */
export function chooseSidebar(chosen: SidebarChoice): void {
  kept.remember(chosen)
  choice.value = chosen
}

/** The sidebar drawn for a window `windowWidth` px wide: the choice wherever it leaves the page its least, and the drawer otherwise. */
function sidebarIn(chosen: SidebarChoice, windowWidth: number): SidebarForm {
  return windowWidth >= SIDEBAR_WIDTH[chosen] + PAGE_LEAST_WIDTH ? chosen : 'drawer'
}

/** Whether some sidebar fits a window `windowWidth` px wide, so the layout menu has a choice to offer. */
export function someSidebarFits(windowWidth: number): boolean {
  return sidebarIn('icons', windowWidth) === 'icons'
}

/**
 * What the shell draws for a window `windowWidth` px wide, with `chat` the chat's asked width while it is open, or null.
 * The window decides the sidebar, and the window and the sidebar decide the chat, so opening the chat never changes the
 * sidebar. The chat docks in the room beside the page at its least, at its asked width or the room, and takes the page's
 * place where that room is under its smallest. The page gets what is left.
 */
export function layoutOf(asked: { readonly choice: SidebarChoice; readonly windowWidth: number; readonly chat: number | null }): ShellLayout {
  const { choice: chosen, windowWidth, chat } = asked
  const sidebar = sidebarIn(chosen, windowWidth)
  const beside = windowWidth - SIDEBAR_WIDTH[sidebar]
  if (chat === null) return { sidebar, chat: { at: 'closed' }, page: beside }

  const room = beside - PAGE_LEAST_WIDTH
  const width = chatWidthIn(chat, room)
  if (width === null) return { sidebar, chat: { at: 'page' }, page: beside }
  return { sidebar, chat: { at: 'dock', width, widest: Math.min(CHAT_MAX_WIDTH, room) }, page: beside - width }
}

/** What picking a sidebar choice changes beside the one in force: it waits for a wider window, or the open chat moves into the page's place or beside the page. */
export type RoomEffect = 'wider-window' | 'chat-takes-page' | 'chat-beside-page'

/**
 * What the layout menu says under `picked` for a window `windowWidth` px wide, with `chat` the chat's asked width while it
 * is open, or null. A choice too wide for the window says so even while in force, since it is why the drawer shows.
 */
export function roomEffectOf(asked: { readonly picked: SidebarChoice; readonly inForce: SidebarChoice; readonly windowWidth: number; readonly chat: number | null }): RoomEffect | null {
  const { picked, inForce, windowWidth, chat } = asked
  const pickedLayout = layoutOf({ choice: picked, windowWidth, chat })
  if (pickedLayout.sidebar === 'drawer') return 'wider-window'
  const before = layoutOf({ choice: inForce, windowWidth, chat }).chat.at
  if (before === 'dock' && pickedLayout.chat.at === 'page') return 'chat-takes-page'
  if (before === 'page' && pickedLayout.chat.at === 'dock') return 'chat-beside-page'
  return null
}

/** The page's padding steps by the page column's width, so a page beside a sidebar is padded as a window of its width. */
export type PageInset = 'phone' | 'roomy' | 'wide'

/** Each page inset's padding in px, on either side and at the top. On a phone app.css draws it, with the safe areas. */
export const PAGE_INSET: Readonly<Record<PageInset, { readonly inline: number; readonly top: number }>> = {
  phone: { inline: 16, top: 16 },
  roomy: { inline: 24, top: 24 },
  wide: { inline: 40, top: 36 },
}

/**
 * The padding a page column `page` px wide takes: the phone's below the phone step, which the window decides, then wide
 * from 1,024 px and roomy below. A classic scrollbar's gutter can leave a column under 640 px in a window past the step.
 */
export function pageInsetOf(page: number, phone: boolean): PageInset {
  if (phone) return 'phone'
  return page >= 1024 ? 'wide' : 'roomy'
}
