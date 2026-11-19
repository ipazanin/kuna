import { describe, expect, it } from 'vitest'

import { DEBT_LIST_COLOURS, foldOpenList, OPEN_LIST_COLOURS } from '../src/shared/ui/donutParts'

describe('an open list on a ring', () => {
  it.each([
    { parts: ['a'], colours: OPEN_LIST_COLOURS, kept: [['a', '--series-1']], folded: [] },
    {
      parts: ['a', 'b', 'c', 'd'],
      colours: OPEN_LIST_COLOURS,
      kept: [
        ['a', '--series-1'],
        ['b', '--series-2'],
        ['c', '--series-3'],
        ['d', '--series-4'],
      ],
      folded: [],
    },
    {
      parts: ['a', 'b', 'c', 'd', 'e', 'f'],
      colours: OPEN_LIST_COLOURS,
      kept: [
        ['a', '--series-1'],
        ['b', '--series-2'],
        ['c', '--series-3'],
        ['d', '--series-4'],
      ],
      folded: ['e', 'f'],
    },
    {
      parts: ['a', 'b', 'c', 'd', 'e'],
      colours: DEBT_LIST_COLOURS,
      kept: [
        ['a', '--net-debt-1'],
        ['b', '--net-debt-2'],
        ['c', '--net-debt-3'],
      ],
      folded: ['d', 'e'],
    },
    { parts: [], colours: OPEN_LIST_COLOURS, kept: [], folded: [] },
  ])('keeps one of $parts.length parts for each colour in order and folds the rest', ({ parts, colours, kept, folded }) => {
    const list = foldOpenList(parts, colours)

    expect(list.kept.map(({ part, colour }) => [part, colour])).toEqual(kept)
    expect(list.folded).toEqual(folded)
  })
})
