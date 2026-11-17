// @vitest-environment jsdom
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isCut, OPEN_DELAY, useCutText } from '../src/shared/ui/cutText'

const observers: FakeResizeObserver[] = []

class FakeResizeObserver {
  readonly watched = new Set<Element>()
  constructor() {
    observers.push(this)
  }
  observe(element: Element): void {
    this.watched.add(element)
  }
  unobserve(element: Element): void {
    this.watched.delete(element)
  }
  disconnect(): void {
    this.watched.clear()
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
})

/** An element whose text needs `needs` px in a box of `room` px, as a browser would measure it. */
function sized(element: HTMLElement, room: number, needs: number): HTMLElement {
  Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => room })
  Object.defineProperty(element, 'scrollWidth', { configurable: true, get: () => Math.max(room, needs) })
  return element
}

function text(words: string, room: number, needs: number, holder: HTMLElement = document.body): HTMLElement {
  const element = document.createElement('span')
  element.textContent = words
  element.dataset.cutText = ''
  holder.append(element)
  return sized(element, room, needs)
}

async function tracked(element: HTMLElement) {
  const scope = effectScope()
  const state = scope.run(() => useCutText(ref(element)))!
  await nextTick()
  return { ...state, stop: () => scope.stop() }
}

function pointer(name: string, pointerType: 'mouse' | 'touch', at = { x: 0, y: 0 }): Event {
  return Object.assign(new Event(name, { bubbles: name !== 'pointerenter' && name !== 'pointerleave', cancelable: true }), { pointerType, clientX: at.x, clientY: at.y })
}

describe('a text that may be cut', () => {
  it('counts as cut only when its text runs more than a pixel past its box', () => {
    const element = document.createElement('span')

    expect(isCut(sized(element, 120, 120))).toBe(false)
    expect(isCut(sized(element, 120, 121))).toBe(false)
    expect(isCut(sized(element, 120, 180))).toBe(true)
  })

  it('counts a two-line clamp as cut when its lines run below its box', () => {
    const element = sized(document.createElement('p'), 120, 120)
    Object.defineProperty(element, 'clientHeight', { get: () => 40 })
    Object.defineProperty(element, 'scrollHeight', { get: () => 60 })

    expect(isCut(element)).toBe(true)
  })

  it('shows nothing and takes no tab stop while the whole text fits', async () => {
    const element = text('Rent', 120, 40)
    const state = await tracked(element)

    element.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(OPEN_DELAY)

    expect(state.focusable.value).toBe(false)
    expect(state.shown.value).toBe(false)
  })

  it('shows the full text on hover and takes a tab stop while the text is cut', async () => {
    const element = text('Domain Software Solutions d.o.o.', 120, 260)
    const state = await tracked(element)

    expect(state.focusable.value).toBe(true)

    element.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(OPEN_DELAY)

    expect(state.shown.value).toBe(true)
    expect(state.fullText.value).toBe('Domain Software Solutions d.o.o.')

    element.dispatchEvent(pointer('pointerleave', 'mouse'))

    expect(state.shown.value).toBe(false)
  })

  it('shows the full text on keyboard focus of the text itself', async () => {
    const element = text('Domain Software Solutions d.o.o.', 120, 260)
    element.tabIndex = 0
    const state = await tracked(element)

    element.focus()

    expect(state.shown.value).toBe(true)

    element.blur()

    expect(state.shown.value).toBe(false)
  })

  it('shows the full text on a long press of a cut text outside any control, and not on a short tap', async () => {
    const element = text('Domain Software Solutions d.o.o.', 120, 260)
    const state = await tracked(element)

    element.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(OPEN_DELAY / 2)
    element.dispatchEvent(pointer('pointerup', 'touch'))
    vi.advanceTimersByTime(OPEN_DELAY)

    expect(state.shown.value).toBe(false)

    element.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(OPEN_DELAY)
    element.dispatchEvent(pointer('pointerup', 'touch'))

    expect(state.shown.value).toBe(true)
  })

  it('leaves a finger that drifts during a press to scroll the page', async () => {
    const element = text('Domain Software Solutions d.o.o.', 120, 260)
    const state = await tracked(element)

    element.dispatchEvent(pointer('pointerdown', 'touch', { x: 10, y: 10 }))
    element.dispatchEvent(pointer('pointermove', 'touch', { x: 10, y: 40 }))
    vi.advanceTimersByTime(OPEN_DELAY)

    expect(state.shown.value).toBe(false)
  })

  it('leaves a long press inside a link to the browser, takes no tab stop there and shows the full text when the link takes keyboard focus', async () => {
    const link = document.createElement('a')
    link.href = '#/entries'
    document.body.append(link)
    const element = text('Domain Software Solutions d.o.o.', 120, 260, link)
    const state = await tracked(element)

    expect(state.focusable.value).toBe(false)

    const menu = pointer('contextmenu', 'touch')
    element.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(OPEN_DELAY)
    element.dispatchEvent(menu)

    expect(state.shown.value).toBe(false)
    expect(menu.defaultPrevented).toBe(false)

    link.focus()

    expect(state.shown.value).toBe(true)
  })

  it('shows only the first cut text of a control that holds two when the control takes keyboard focus', async () => {
    const link = document.createElement('a')
    link.href = '#/company/transactions'
    document.body.append(link)
    const fits = await tracked(text('Rent', 120, 40, link))
    const first = await tracked(text('Domain Software Solutions d.o.o.', 120, 260, link))
    const second = await tracked(text('HR12 2340 0091 1100 0000 1', 60, 200, link))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    link.focus()

    expect(fits.shown.value).toBe(false)
    expect(first.shown.value).toBe(true)
    expect(second.shown.value).toBe(false)
  })

  it('reads the full text when it shows, so a text changed since it was measured is not shown stale', async () => {
    const element = text('Corner Market', 120, 260)
    const state = await tracked(element)

    element.textContent = 'Corner Market and Bakery on the Square'
    element.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(OPEN_DELAY)

    expect(state.fullText.value).toBe('Corner Market and Bakery on the Square')
  })

  it('watches every cut text on a page through one observer and stops watching one that goes', async () => {
    const before = observers.length
    const first = await tracked(text('Corner Market', 120, 260))
    const second = await tracked(text('Rent', 120, 40))

    expect(observers.length - before).toBeLessThanOrEqual(1)
    const observer = observers.at(-1)!
    expect(observer.watched.size).toBeGreaterThanOrEqual(2)

    const watchedBefore = observer.watched.size
    first.stop()
    second.stop()

    expect(observer.watched.size).toBe(watchedBefore - 2)
  })
})
