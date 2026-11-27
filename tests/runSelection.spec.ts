import { describe, expect, it } from 'vitest'

import { closeNames, runSelection } from '../scripts/support/runSelection.mjs'

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

  it('names only the names close to one nothing matched, for a name and for a prefix with *', () => {
    const selection = runSelection([360], ['--only', 'chat-reciept,sidebar-fat*'])
    for (const name of NAMES) selection.takes(name)

    expect(selection.unmatched()?.split('\n')).toEqual([
      '--only named chat-reciept, which nothing of this run is called. The names close to it are chat-receipt, chat-receipts, chat-receipt-croatian.',
      '--only named sidebar-fat*, which no name of this run starts with sidebar-fat. The names close to it are sidebar-fit, sidebar-fit-croatian.',
    ])
  })

  it('gives at most ten close names, the nearest first, and none far from the entry', () => {
    const names = ['loans-overview', ...Array.from({ length: 12 }, (_, index) => `spending-payee-${index + 10}`), 'spending-payee-page']

    const close = closeNames('spending-payee-x', names)

    expect(close).toHaveLength(10)
    expect(close).not.toContain('loans-overview')
    expect(closeNames('spending-payee-pag', names)[0]).toBe('spending-payee-page')
  })

  it('takes every name without --only', () => {
    const selection = runSelection([360], [])

    expect(NAMES.filter((name) => selection.takes(name))).toEqual(NAMES)
    expect(selection.limited).toBe(false)
  })
})
