import { beforeEach, describe, expect, it } from 'vitest'

import type { AskedElement } from '../src/shared/ai/presentation/chatDock'

import { chatElement, chatOpen, closeChat, removeChatElement, useChatElement } from '../src/shared/ai/presentation/chatDock'

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
