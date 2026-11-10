// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatPlace, RoomEffect, SidebarChoice, SidebarForm } from '../src/shell/ui/sidebarLayout'
import { chooseSidebar, layoutOf, pageInsetOf, roomEffectOf, SIDEBAR_WIDTH, sidebarChoice, someSidebarFits } from '../src/shell/ui/sidebarLayout'

const CLOSED: ChatPlace = { at: 'closed' }
const IN_PAGE: ChatPlace = { at: 'page' }
const CHOICES: readonly SidebarChoice[] = ['expanded', 'icons', 'hidden']
const ASKED_WIDTHS = [384, 450, 512, 600, 704]

function docked(width: number, widest: number): ChatPlace {
  return { at: 'dock', width, widest }
}

/** Every window width from a phone to a wide monitor, one px apart, so a property holds at each edge. */
function* everyWindow(): Generator<number> {
  for (let windowWidth = 360; windowWidth <= 2600; windowWidth += 1) yield windowWidth
}

describe('the sidebar, decided by the window alone', () => {
  it.each<[SidebarChoice, number, SidebarForm]>([
    ['expanded', 1440, 'expanded'],
    ['icons', 1440, 'icons'],
    ['hidden', 1440, 'hidden'],
    // 240 + 640 = 880 is the narrowest window beside the expanded sidebar.
    ['expanded', 880, 'expanded'],
    ['expanded', 879, 'drawer'],
    // 56 + 640 = 696 beside the icons.
    ['icons', 696, 'icons'],
    ['icons', 695, 'drawer'],
    ['hidden', 640, 'hidden'],
    ['hidden', 639, 'drawer'],
    ['expanded', 360, 'drawer'],
  ])('%s at %i px draws %s', (choice, windowWidth, sidebar) => {
    expect(layoutOf({ choice, windowWidth, chat: null })).toEqual({ sidebar, chat: CLOSED, page: windowWidth - SIDEBAR_WIDTH[sidebar] })
  })

  it('offers the layout menu wherever the icons fit', () => {
    expect(someSidebarFits(696)).toBe(true)
    expect(someSidebarFits(695)).toBe(false)
  })
})

describe('the chat in the room beside the page', () => {
  it.each<[SidebarChoice, number, number, ChatPlace, number]>([
    // 1264 − 240 − 640 = 384, the narrowest window that docks the chat beside the expanded sidebar.
    ['expanded', 1264, 384, docked(384, 384), 640],
    ['expanded', 1263, 384, IN_PAGE, 1023],
    // 1390 − 240 − 640 = 510 px of room, so a 384 px chat leaves the page 766 px.
    ['expanded', 1390, 384, docked(384, 510), 766],
    ['expanded', 1390, 704, docked(510, 510), 640],
    ['expanded', 1920, 704, docked(704, 704), 976],
    ['expanded', 1920, 384, docked(384, 704), 1296],
    // 56 + 640 + 384 = 1080 beside the icons.
    ['icons', 1080, 704, docked(384, 384), 640],
    ['icons', 1079, 384, IN_PAGE, 1023],
    // The top bar takes no width, so the chat docks from 640 + 384 = 1024.
    ['hidden', 1024, 384, docked(384, 384), 640],
    ['hidden', 1023, 384, IN_PAGE, 1023],
    ['expanded', 800, 384, IN_PAGE, 800],
    ['expanded', 360, 384, IN_PAGE, 360],
  ])('%s at %i px with a %i px chat places it %j and leaves the page %i px', (choice, windowWidth, chat, place, page) => {
    expect(layoutOf({ choice, windowWidth, chat })).toEqual({ sidebar: layoutOf({ choice, windowWidth, chat: null }).sidebar, chat: place, page })
  })
})

describe('the layout from 360 to 2,600 px', () => {
  it('never changes the sidebar when the chat opens', () => {
    for (const choice of CHOICES) {
      for (const windowWidth of everyWindow()) {
        const closed = layoutOf({ choice, windowWidth, chat: null }).sidebar
        for (const chat of ASKED_WIDTHS) expect(layoutOf({ choice, windowWidth, chat }).sidebar).toBe(closed)
      }
    }
  })

  it('shows a sidebar only where it leaves the page 640 px, and the choice wherever it does', () => {
    for (const choice of CHOICES) {
      for (const windowWidth of everyWindow()) {
        const { sidebar, page } = layoutOf({ choice, windowWidth, chat: null })
        expect(sidebar).toBe(windowWidth - SIDEBAR_WIDTH[choice] >= 640 ? choice : 'drawer')
        expect(page + SIDEBAR_WIDTH[sidebar]).toBe(windowWidth)
      }
    }
  })

  it('docks the chat exactly where it leaves the page 640 px and itself 384 px, within its asked width and the room', () => {
    for (const choice of CHOICES) {
      for (const windowWidth of everyWindow()) {
        for (const chat of ASKED_WIDTHS) {
          const { sidebar, chat: place, page } = layoutOf({ choice, windowWidth, chat })
          const room = windowWidth - SIDEBAR_WIDTH[sidebar] - 640
          if (room < 384) {
            expect(place).toEqual(IN_PAGE)
            continue
          }
          expect(place).toEqual(docked(Math.min(chat, room), Math.min(704, room)))
          expect(SIDEBAR_WIDTH[sidebar] + page + Math.min(chat, room)).toBe(windowWidth)
          expect(page).toBeGreaterThanOrEqual(640)
        }
      }
    }
  })

  it('gives way in order as the window narrows: the page down to 640 px, then the chat down to 384 px, then the chat takes the page', () => {
    for (const choice of CHOICES) {
      for (const chat of ASKED_WIDTHS) {
        let wider = layoutOf({ choice, windowWidth: 2600, chat })
        for (let windowWidth = 2599; windowWidth >= 360; windowWidth -= 1) {
          const layout = layoutOf({ choice, windowWidth, chat })
          if (layout.chat.at === 'dock') {
            if (layout.chat.width < chat) expect(layout.page).toBe(640)
            if (wider.chat.at === 'dock' && layout.sidebar === wider.sidebar) expect(layout.chat.width).toBeLessThanOrEqual(wider.chat.width)
          }
          if (wider.chat.at === 'page' && layout.sidebar === wider.sidebar) expect(layout.chat).toEqual(IN_PAGE)
          wider = layout
        }
      }
    }
  })
})

describe('what the layout menu says under a choice', () => {
  it.each<[string, SidebarChoice, number, number | null, Readonly<Record<SidebarChoice, RoomEffect | null>>]>([
    ['an 800 px window', 'expanded', 800, null, { expanded: 'wider-window', icons: null, hidden: null }],
    ['an 800 px window with the chat open', 'icons', 800, 384, { expanded: 'wider-window', icons: null, hidden: null }],
    ['a 1,200 px window with icons and the chat docked', 'icons', 1200, 384, { expanded: 'chat-takes-page', icons: null, hidden: null }],
    ['a 1,200 px window with the expanded sidebar and the chat in the page', 'expanded', 1200, 384, { expanded: null, icons: 'chat-beside-page', hidden: 'chat-beside-page' }],
    ['a 1,440 px window with the chat docked', 'expanded', 1440, 704, { expanded: null, icons: null, hidden: null }],
  ])('in %s', (_name, inForce, windowWidth, chat, said) => {
    for (const picked of CHOICES) expect(roomEffectOf({ picked, inForce, windowWidth, chat })).toBe(said[picked])
  })
})

describe('the page padding', () => {
  it.each([
    [1024, 'wide'],
    [1023, 'roomy'],
    [640, 'roomy'],
    [639, 'phone'],
  ] as const)('pads a %i px page column as %s', (page, inset) => {
    expect(pageInsetOf(page)).toBe(inset)
  })
})

describe('the stored choice', () => {
  beforeEach(() => {
    localStorage.clear()
    chooseSidebar('expanded')
  })

  it('keeps icons or hidden on this device and forgets the default, expanded', () => {
    chooseSidebar('hidden')
    expect(sidebarChoice.value).toBe('hidden')
    expect(localStorage.getItem('kuna.sidebar')).toBe('hidden')
    chooseSidebar('expanded')
    expect(sidebarChoice.value).toBe('expanded')
    expect(localStorage.getItem('kuna.sidebar')).toBeNull()
  })

  it('reads the choice as the page loads, and expanded for anything else', async () => {
    const loaded = async (stored: string): Promise<SidebarChoice> => {
      localStorage.setItem('kuna.sidebar', stored)
      vi.resetModules()
      const { sidebarChoice: read } = await import('../src/shell/ui/sidebarLayout')
      return read.value
    }
    expect(await loaded('icons')).toBe('icons')
    expect(await loaded('hidden')).toBe('hidden')
    expect(await loaded('rail')).toBe('expanded')
  })
})
