import { describe, expect, it } from 'vitest'

import { CHAT_ONLY_EXCEPTIONS } from './chatCoverageExceptions'
import { chatOnlyWrites, chatReach, writeGraph } from './support/writePaths'

const GRAPH = writeGraph()
const CHAT_ONLY = chatOnlyWrites(GRAPH, chatReach(GRAPH))
const EXCEPTED = CHAT_ONLY_EXCEPTIONS.flatMap((exception) => exception.writes)

describe('every write the chat makes has a screen path or a listed reason', () => {
  it('finds no write only the chat makes beyond the listed ones', () => {
    const excepted = new Set(EXCEPTED)
    expect(
      CHAT_ONLY.filter((write) => !excepted.has(write)),
      'Give a screen a path to it, or a reason in CHAT_ONLY_EXCEPTIONS in tests/chatCoverageExceptions.ts',
    ).toEqual([])
  })

  it('lists no exception a screen reaches or the chat no longer makes', () => {
    const chatOnly = new Set(CHAT_ONLY)
    expect(
      EXCEPTED.filter((write) => !chatOnly.has(write)),
      'Take these out of CHAT_ONLY_EXCEPTIONS in tests/chatCoverageExceptions.ts',
    ).toEqual([])
  })

  it('lists each write once', () => {
    expect(EXCEPTED.length).toBe(new Set(EXCEPTED).size)
  })
})
