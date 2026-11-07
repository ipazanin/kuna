import { describe, expect, it } from 'vitest'

import { chatBlocksOf } from '../src/shared/ai/domain/chatText'

describe('a model text in the chat', () => {
  it('reads paragraphs, lists, bold and code', () => {
    expect(chatBlocksOf('Open **Rules** first.\n\n- `one`\n2. two')).toEqual([
      {
        kind: 'paragraph',
        inlines: [
          { kind: 'plain', text: 'Open ' },
          { kind: 'bold', text: 'Rules' },
          { kind: 'plain', text: ' first.' },
        ],
      },
      { kind: 'list', items: [[{ kind: 'code', text: 'one' }], [{ kind: 'plain', text: 'two' }]] },
    ])
  })

  it.each(['[click](https://example.com)', '![x](https://example.com/a.png)', '<img src=x onerror=alert(1)>', 'https://example.com'])('keeps %s as the plain text it is', (text) => {
    expect(chatBlocksOf(text)).toEqual([{ kind: 'paragraph', inlines: [{ kind: 'plain', text }] }])
  })

  it('leaves a half-streamed mark as text', () => {
    expect(chatBlocksOf('Open **Ru')).toEqual([{ kind: 'paragraph', inlines: [{ kind: 'plain', text: 'Open **Ru' }] }])
  })
})
