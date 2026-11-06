import { describe, expect, it } from 'vitest'

import { serverSentEvents } from '../src/shared/ai/infrastructure/serverSentEvents'
import { streamResponse } from './support/sseResponse'

async function eventsOf(text: string, chunkBytes = 3): Promise<string[]> {
  const seen = []
  for await (const event of serverSentEvents(streamResponse(text, chunkBytes).body!)) {
    seen.push(event)
  }
  return seen
}

describe('reading a server-sent stream', () => {
  it('reads the data of each event, comments and event names aside, with any line ending, even one split across two chunks', async () => {
    const expected = ['first', 'second']
    expect(await eventsOf(': a comment\nevent: one\ndata: first\n\ndata:second\n\n')).toEqual(expected)
    expect(await eventsOf('event: one\r\ndata: first\r\n\r\ndata: second\r\n\r\n', 1)).toEqual(expected)
  })

  it('joins data lines and leaves out an event that a cut stream never finished', async () => {
    expect(await eventsOf('data: a\ndata: b\n\ndata: never finished\n')).toEqual(['a\nb'])
  })

  it('reads a character split across chunks', async () => {
    expect(await eventsOf('data: šđčćž\n\n', 1)).toEqual(['šđčćž'])
  })
})
