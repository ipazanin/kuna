import { describe, expect, it } from 'vitest'

import { partReplacements } from '../src/shared/categorising/domain/partReplacements'
import { moneyFromCents } from '../src/shared/money/money'

const cents = moneyFromCents

describe('what a part replaces', () => {
  const part = (id: string, amount: number) => ({ id, amount: cents(amount) })
  it.each<[string, readonly ReturnType<typeof part>[], readonly ReturnType<typeof part>[], readonly { part: string; replaces: readonly string[] }[]]>([
    ['the same money, retyped', [part('whole', -100)], [part('whole', -100)], []],
    ['a whole split, whose first part keeps its id', [part('whole', -100)], [part('whole', -60), part('new', -40)], [{ part: 'new', replaces: ['whole'] }]],
    ['parts reordered, kept by id', [part('a', -60), part('b', -40)], [part('b', -40), part('a', -60)], []],
    ['money moved between kept parts', [part('a', -60), part('b', -40)], [part('a', -30), part('b', -70)], [{ part: 'b', replaces: ['a'] }]],
    ['a part removed and a new one added', [part('a', -50), part('b', -30), part('c', -20)], [part('a', -50), part('b', -20), part('d', -30)], [{ part: 'd', replaces: ['b', 'c'] }]],
    ['a split taken off', [part('whole', -60), part('b', -40)], [part('whole', -100)], [{ part: 'whole', replaces: ['b'] }]],
    [
      'lines in place of every part, a discount among them',
      [part('a', -60), part('b', -40)],
      [part('x', -110), part('y', 10)],
      [
        { part: 'x', replaces: ['a', 'b'] },
        { part: 'y', replaces: ['a', 'b'] },
      ],
    ],
    ['parts where there were none', [], [part('x', -100)], []],
  ])('for %s', (_case, before, after, replaced) => {
    expect(partReplacements(before, after)).toEqual(replaced)
  })
})
