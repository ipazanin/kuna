// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatPlace, SidebarChoice, SidebarForm } from '../src/shell/ui/sidebarLayout'
import { chooseSidebar, layoutOf, sidebarChoice } from '../src/shell/ui/sidebarLayout'

const CLOSED: ChatPlace = { at: 'closed' }
const IN_PAGE: ChatPlace = { at: 'page' }

function docked(width: number, widest: number): ChatPlace {
  return { at: 'dock', width, widest }
}

describe('the sidebar with the chat closed', () => {
  it.each<[SidebarChoice, number, SidebarForm]>([
    ['expanded', 1440, 'expanded'],
    ['icons', 1440, 'icons'],
    ['hidden', 1440, 'hidden'],
    ['expanded', 1024, 'expanded'],
    ['hidden', 1024, 'hidden'],
    ['icons', 1023, 'drawer'],
    ['hidden', 360, 'drawer'],
  ])('%s at %i px draws %s', (choice, windowWidth, sidebar) => {
    expect(layoutOf({ choice, windowWidth, chat: null })).toEqual({ sidebar, chat: CLOSED })
  })
})

describe('the expanded sidebar with the chat open, decided by room', () => {
  it.each<[number, number, SidebarForm, ChatPlace]>([
    // 240 + 976 + 384 = 1600 holds all three side by side.
    [1920, 384, 'expanded', docked(384, 704)],
    [1600, 384, 'expanded', docked(384, 568)],
    [1920, 704, 'expanded', docked(704, 704)],
    // 240 + 976 + 704 = 1920, so a 704 px chat turns the sidebar to icons below that.
    [1919, 704, 'icons', docked(704, 704)],
    // 1440 leaves 1440 − 56 − 976 = 408 px beside the icons, so a wider chat draws at 408.
    [1440, 704, 'icons', docked(408, 408)],
    [1440, 384, 'icons', docked(384, 408)],
    [1599, 384, 'icons', docked(384, 567)],
    // 56 + 976 + 384 = 1416 is the narrowest window that docks the chat beside a sidebar.
    [1416, 704, 'icons', docked(384, 384)],
    [1415, 384, 'expanded', IN_PAGE],
    [1280, 384, 'expanded', IN_PAGE],
    [1024, 384, 'expanded', IN_PAGE],
    [1023, 384, 'drawer', IN_PAGE],
  ])('at %i px with a %i px chat draws %s and %j', (windowWidth, chat, sidebar, place) => {
    expect(layoutOf({ choice: 'expanded', windowWidth, chat })).toEqual({ sidebar, chat: place })
  })

  it('moves to icons and back as the chat is dragged wider and narrower at one window, with 16 px to spare on the way back', () => {
    // 1792 − 240 − 976 = 576 px is the widest chat beside the expanded sidebar.
    const at = (chat: number, drawn?: SidebarForm): SidebarForm => layoutOf({ choice: 'expanded', windowWidth: 1792, chat, ...(drawn === undefined ? {} : { drawn }) }).sidebar
    expect(at(576)).toBe('expanded')
    expect(at(577)).toBe('icons')
    expect(at(576, 'icons')).toBe('icons')
    expect(at(561, 'icons')).toBe('icons')
    expect(at(560, 'icons')).toBe('expanded')
    expect(at(576, 'expanded')).toBe('expanded')
  })
})

describe('the icons and the hidden sidebar with the chat open', () => {
  it.each<[SidebarChoice, number, number, SidebarForm, ChatPlace]>([
    ['icons', 1920, 704, 'icons', docked(704, 704)],
    ['icons', 1440, 704, 'icons', docked(408, 408)],
    ['icons', 1416, 384, 'icons', docked(384, 384)],
    ['icons', 1415, 384, 'icons', IN_PAGE],
    // The top bar takes no width, so the chat docks from 976 + 384 = 1360.
    ['hidden', 1440, 704, 'hidden', docked(464, 464)],
    ['hidden', 1360, 500, 'hidden', docked(384, 384)],
    ['hidden', 1359, 384, 'hidden', IN_PAGE],
    ['hidden', 800, 384, 'drawer', IN_PAGE],
  ])('%s at %i px with a %i px chat draws %s and %j', (choice, windowWidth, chat, sidebar, place) => {
    expect(layoutOf({ choice, windowWidth, chat })).toEqual({ sidebar, chat: place })
  })

  it('never leaves the page under 976 px beside a docked chat', () => {
    for (const choice of ['expanded', 'icons', 'hidden'] as const) {
      for (let windowWidth = 1024; windowWidth <= 2000; windowWidth += 7) {
        for (const chat of [384, 512, 704]) {
          const { sidebar, chat: place } = layoutOf({ choice, windowWidth, chat })
          if (place.at !== 'dock') continue
          const sidebarWidth = { expanded: 240, icons: 56, hidden: 0, drawer: 0 }[sidebar]
          expect(windowWidth - sidebarWidth - place.width).toBeGreaterThanOrEqual(976)
        }
      }
    }
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
