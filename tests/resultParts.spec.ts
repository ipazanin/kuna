import { describe, expect, it } from 'vitest'

import { resultParts } from '../src/shared/ai/application/modelPort'

const PDF = { kind: 'pdf', base64: 'JVBERi0xLjcK', name: 'a2' } as const

describe('a tool result with a document, as every provider takes it', () => {
  it('puts the text first, then each part', () => {
    expect(resultParts('{"id":"a2","kind":"pdf"}', [PDF])).toEqual([{ kind: 'text', text: '{"id":"a2","kind":"pdf"}' }, PDF])
  })

  it('leaves out empty text', () => {
    expect(resultParts('', [PDF])).toEqual([PDF])
  })
})
