import { describe, expect, it } from 'vitest'

import { runSelection } from '../scripts/support/runSelection.mjs'

const NAMES = ['chat-receipt', 'chat-receipt-croatian', 'chat-receipts', 'chat-read', 'sidebar-fit', 'sidebar-fit-croatian']

/** The names a run with `--only only` takes, of NAMES. */
function takenWith(only: string): string[] {
  const selection = runSelection([360], ['http://localhost:4173/kuna/', '--only', only])
  return NAMES.filter((name) => selection.takes(name))
}

describe("the checks' --only", () => {
  it.each([
    ['chat-receipt', ['chat-receipt']],
    ['chat-receipt,sidebar-fit', ['chat-receipt', 'sidebar-fit']],
    ['chat-receipt*', ['chat-receipt', 'chat-receipt-croatian', 'chat-receipts']],
    ['chat-receipt-*', ['chat-receipt-croatian']],
    ['sidebar*,chat-read', ['chat-read', 'sidebar-fit', 'sidebar-fit-croatian']],
    ['chat', []],
  ])('takes exactly what --only %s names', (only, taken) => {
    expect(takenWith(only)).toEqual(taken)
  })

  it('names what nothing was called, and nothing once every name matched', () => {
    const selection = runSelection([360], ['--only', 'chat,sidebar*'])
    for (const name of NAMES) selection.takes(name)

    expect(selection.unmatched()).toMatch(/^--only named chat, which nothing of this run is called\./)
    const matched = runSelection([360], ['--only', 'chat-read,sidebar*'])
    for (const name of NAMES) matched.takes(name)
    expect(matched.unmatched()).toBeNull()
  })

  it('takes every name without --only', () => {
    const selection = runSelection([360], [])

    expect(NAMES.filter((name) => selection.takes(name))).toEqual(NAMES)
    expect(selection.limited).toBe(false)
  })
})
