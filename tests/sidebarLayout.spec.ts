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
    // 240 + 784 + 384 = 1408 holds all three side by side.
    [1920, 384, 'expanded', docked(384, 704)],
    [1408, 384, 'expanded', docked(384, 568)],
    [1920, 704, 'expanded', docked(704, 704)],
    // 240 + 784 + 704 = 1728, so a 704 px chat turns the sidebar to icons below that.
    [1727, 704, 'icons', docked(704, 704)],
    // 1440 leaves 1440 − 56 − 784 = 600 px beside the icons, so a wider chat draws at 600.
    [1440, 704, 'icons', docked(600, 600)],
    [1440, 400, 'expanded', docked(400, 600)],
    [1407, 384, 'icons', docked(384, 567)],
    [1280, 384, 'icons', docked(384, 440)],
    // 56 + 784 + 384 = 1224 is the narrowest window that docks the chat.
    [1224, 704, 'icons', docked(384, 384)],
    [1223, 384, 'expanded', IN_PAGE],
    [1024, 384, 'expanded', IN_PAGE],
    [1023, 384, 'drawer', IN_PAGE],
  ])('at %i px with a %i px chat draws %s and %j', (windowWidth, chat, sidebar, place) => {
    expect(layoutOf({ choice: 'expanded', windowWidth, chat })).toEqual({ sidebar, chat: place })
  })

  it('moves to icons and back as the chat is dragged wider and narrower at one window', () => {
    const at = (chat: number): SidebarForm => layoutOf({ choice: 'expanded', windowWidth: 1600, chat }).sidebar
    expect(at(576)).toBe('expanded')
    expect(at(577)).toBe('icons')
    expect(at(576)).toBe('expanded')
  })
})

describe('the icons and the hidden sidebar with the chat open', () => {
  it.each<[SidebarChoice, number, number, SidebarForm, ChatPlace]>([
    ['icons', 1920, 704, 'icons', docked(704, 704)],
    ['icons', 1440, 704, 'icons', docked(600, 600)],
    ['icons', 1224, 384, 'icons', docked(384, 384)],
    ['icons', 1223, 384, 'icons', IN_PAGE],
    // The top bar takes no width, so the chat docks from 784 + 384 = 1168.
    ['hidden', 1440, 704, 'hidden', docked(656, 656)],
    ['hidden', 1168, 500, 'hidden', docked(384, 384)],
    ['hidden', 1167, 384, 'hidden', IN_PAGE],
    ['hidden', 800, 384, 'drawer', IN_PAGE],
  ])('%s at %i px with a %i px chat draws %s and %j', (choice, windowWidth, chat, sidebar, place) => {
    expect(layoutOf({ choice, windowWidth, chat })).toEqual({ sidebar, chat: place })
  })

  it('never leaves the page under 784 px beside a docked chat', () => {
    for (const choice of ['expanded', 'icons', 'hidden'] as const) {
      for (let windowWidth = 1024; windowWidth <= 2000; windowWidth += 7) {
        for (const chat of [384, 512, 704]) {
          const { sidebar, chat: place } = layoutOf({ choice, windowWidth, chat })
          if (place.at !== 'dock') continue
          const sidebarWidth = { expanded: 240, icons: 56, hidden: 0, drawer: 0 }[sidebar]
          expect(windowWidth - sidebarWidth - place.width).toBeGreaterThanOrEqual(784)
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
