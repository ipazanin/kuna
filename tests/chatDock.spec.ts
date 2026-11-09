// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AskedElement } from '../src/shared/ai/presentation/chatDock'

import {
  CHAT_DEFAULT_WIDTH,
  CHAT_MAX_WIDTH,
  CHAT_MIN_WIDTH,
  chatElement,
  chatOpen,
  chatRequest,
  chatWidth,
  chatWidthIn,
  closeChat,
  removeChatElement,
  resizeChat,
  takeChatRequest,
  useChatElement,
} from '../src/shared/ai/presentation/chatDock'

const CASH: AskedElement = { key: 'cash', label: 'Cash on hand', about: { kind: 'figure', app: 'company', report: 'overview', period: null, label: 'Cash on hand' } }
const RENT: AskedElement = { key: 'rent', label: 'Rent', about: { kind: 'record', app: 'spending', recordKind: 'transaction', id: 't-12' } }

beforeEach(() => {
  closeChat()
  removeChatElement()
})

describe('asking the chat about one element', () => {
  it('opens the chat about the element, with what it is', () => {
    useChatElement(CASH, 'card').ask()
    expect(chatOpen.value).toBe(true)
    expect(chatElement.value).toEqual(CASH)
  })

  it('leaves the task a named button asks for, for the panel to send once, and none for a plain ask', () => {
    useChatElement(CASH, 'card', 'Suggest categories for the rows waiting on To review.').ask()
    expect(chatRequest.value).toBe('Suggest categories for the rows waiting on To review.')
    expect(takeChatRequest()).toBe('Suggest categories for the rows waiting on To review.')
    expect(chatRequest.value).toBeNull()
    useChatElement(RENT, 'row').ask()
    expect(chatRequest.value).toBeNull()
    expect(chatElement.value).toEqual(RENT)
  })

  it('replaces the last element, as a chat is about one', () => {
    useChatElement(CASH, 'card').ask()
    useChatElement(RENT, 'row').ask()
    expect(chatElement.value?.about).toEqual(RENT.about)
  })

  it('reads the element as it is when asked, so a row that changed since asks about what it shows now', () => {
    let label = 'Rent'
    const { ask } = useChatElement(() => ({ ...RENT, label }), 'row')
    label = 'Rent for November'
    ask()
    expect(chatElement.value?.label).toBe('Rent for November')
  })
})

describe('the highlight', () => {
  it('marks only the element asked about, only while the chat is open, and goes with it', () => {
    const cash = useChatElement(CASH, 'card')
    const rent = useChatElement(RENT, 'row')
    expect(cash.marked.value).toEqual({})
    cash.ask()
    expect(cash.marked.value).toEqual({ 'data-chat-tagged': 'card' })
    expect(rent.marked.value).toEqual({})
    closeChat()
    expect(cash.marked.value).toEqual({})
    cash.ask()
    removeChatElement()
    expect(cash.marked.value).toEqual({})
  })

  it('names the shape it draws on, so a row takes the bar and a card its own border', () => {
    const rent = useChatElement(RENT, 'row')
    rent.ask()
    expect(rent.marked.value).toEqual({ 'data-chat-tagged': 'row' })
  })
})

describe("the chat's width", () => {
  beforeEach(() => {
    localStorage.clear()
    resizeChat(CHAT_DEFAULT_WIDTH)
  })

  it('opens at its smallest, 384 px, and grows to 704 px at most', () => {
    expect(chatWidth.value).toBe(384)
    resizeChat(500)
    expect(chatWidth.value).toBe(500)
    resizeChat(900)
    expect(chatWidth.value).toBe(CHAT_MAX_WIDTH)
    resizeChat(100)
    expect(chatWidth.value).toBe(CHAT_MIN_WIDTH)
  })

  it('keeps a dragged width on this device and forgets it on a reset to the default', () => {
    resizeChat(600.4)
    expect(localStorage.getItem('kuna.chat-width')).toBe('600')
    resizeChat(CHAT_DEFAULT_WIDTH)
    expect(localStorage.getItem('kuna.chat-width')).toBeNull()
  })

  it('reads the kept width as the page loads, within its limits, and the default for anything else', async () => {
    const loaded = async (stored: string | null): Promise<number> => {
      if (stored === null) localStorage.removeItem('kuna.chat-width')
      else localStorage.setItem('kuna.chat-width', stored)
      vi.resetModules()
      const { chatWidth: read } = await import('../src/shared/ai/presentation/chatDock')
      return read.value
    }
    expect(await loaded('640')).toBe(640)
    expect(await loaded('9000')).toBe(704)
    expect(await loaded('wide')).toBe(384)
    expect(await loaded(null)).toBe(384)
  })
})

describe('the width drawn in the room beside the page', () => {
  it.each([
    { asked: 384, room: 384, drawn: 384 },
    { asked: 600, room: 900, drawn: 600 },
    { asked: 704, room: 600, drawn: 600 },
    { asked: 500, room: 383, drawn: null },
    { asked: 384, room: -200, drawn: null },
  ])('draws $drawn px for $asked px asked in $room px', ({ asked, room, drawn }) => {
    expect(chatWidthIn(asked, room)).toBe(drawn)
  })

  it('keeps the asked width while a narrow window draws less', () => {
    resizeChat(704)
    expect(chatWidthIn(chatWidth.value, 600)).toBe(600)
    expect(chatWidth.value).toBe(704)
  })
})
