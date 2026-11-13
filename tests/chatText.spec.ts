import { describe, expect, it } from 'vitest'

import { chatBlocksOf } from '../src/shared/ai/domain/chatText'

describe('a model text in the chat', () => {
  it('reads paragraphs, lists, bold and code', () => {
    expect(chatBlocksOf('Open **Rules** first.\n\n- `one`\n2. two')).toEqual([
      {
        ownKnowledge: false,
        blocks: [
          {
            kind: 'paragraph',
            inlines: [
              { kind: 'plain', text: 'Open ' },
              { kind: 'bold', text: 'Rules' },
              { kind: 'plain', text: ' first.' },
            ],
          },
          { kind: 'list', items: [[{ kind: 'code', text: 'one' }], [{ kind: 'plain', text: 'two' }]] },
        ],
      },
    ])
  })

  it.each(['[click](https://example.com)', '![x](https://example.com/a.png)', '<img src=x onerror=alert(1)>', 'https://example.com'])('keeps %s as the plain text it is', (text) => {
    expect(chatBlocksOf(text, true)).toEqual([{ ownKnowledge: false, blocks: [{ kind: 'paragraph', inlines: [{ kind: 'plain', text }] }] }])
  })

  it('leaves a half-streamed mark as text', () => {
    expect(chatBlocksOf('Open **Ru')).toEqual([{ ownKnowledge: false, blocks: [{ kind: 'paragraph', inlines: [{ kind: 'plain', text: 'Open **Ru' }] }] }])
  })

  it('splits out a figure ref and a law ref, in bold as in plain text, with a law ref against the word before it', () => {
    expect(chatBlocksOf('Taxed at [f2] [law-1], **free after [law-12]**.')[0]!.blocks).toEqual([
      {
        kind: 'paragraph',
        inlines: [
          { kind: 'plain', text: 'Taxed at ' },
          { kind: 'figure', text: 'f2' },
          { kind: 'citation', text: 'law-1' },
          { kind: 'plain', text: ', ' },
          { kind: 'bold', text: 'free after' },
          { kind: 'citation', text: 'law-12' },
          { kind: 'plain', text: '.' },
        ],
      },
    ])
  })

  it("sets an answer's quoted lines apart as its own knowledge, two quoted paragraphs as one", () => {
    const parts = chatBlocksOf('Sold after two years, it is tax free [law-1].\n\n> Many brokers report it anyway.\n>\n> - Keep the notes.\nThat is all.', true)
    expect(parts.map((part) => part.ownKnowledge)).toEqual([false, true, false])
    expect(parts[1]!.blocks).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'plain', text: 'Many brokers report it anyway.' }] },
      { kind: 'list', items: [[{ kind: 'plain', text: 'Keep the notes.' }]] },
    ])
  })

  it("reads a person's own quoted line as they typed it", () => {
    expect(chatBlocksOf('> as the bank wrote it')).toEqual([{ ownKnowledge: false, blocks: [{ kind: 'paragraph', inlines: [{ kind: 'plain', text: '> as the bank wrote it' }] }] }])
  })
})
