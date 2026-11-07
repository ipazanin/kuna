import { beforeEach, describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({ meta: { title: 'Overview' } as { title?: string } }))
vi.mock('vue-router', () => ({ useRoute: () => route }))

const { chatOpen, chatTag, chatTagAttrs, closeChat, removeChatTag, useChatTagging } = await import('../src/shared/ai/presentation/chatDock')

beforeEach(() => {
  closeChat()
  removeChatTag()
  route.meta = { title: 'Overview' }
})

describe('a button that opens the chat about one element', () => {
  it('opens it with a tag that names the element and its screen', () => {
    useChatTagging()({ key: 'cash', label: 'Cash on hand' })
    expect(chatOpen.value).toBe(true)
    expect(chatTag.value).toEqual({ key: 'cash', label: 'Cash on hand', screen: 'Overview' })
  })

  it('replaces the last tag, as a chat is about one element', () => {
    const tag = useChatTagging()
    tag({ key: 'cash', label: 'Cash on hand' })
    tag({ key: 'rent', label: 'Rent' })
    expect(chatTag.value?.key).toBe('rent')
  })

  it('leaves the screen out on a route with no name, such as the home', () => {
    route.meta = {}
    useChatTagging()({ key: 'cash', label: 'Cash on hand' })
    expect(chatTag.value?.screen).toBeNull()
  })
})

describe('the highlight', () => {
  it('marks only the tagged element, only while the chat is open, and goes with the tag', () => {
    const cash = chatTagAttrs('cash')
    const rent = chatTagAttrs('rent')
    expect(cash.value).toEqual({})
    useChatTagging()({ key: 'cash', label: 'Cash on hand' })
    expect(cash.value).toEqual({ 'data-chat-tagged': '' })
    expect(rent.value).toEqual({})
    closeChat()
    expect(cash.value).toEqual({})
    useChatTagging()({ key: 'cash', label: 'Cash on hand' })
    removeChatTag()
    expect(cash.value).toEqual({})
  })
})
