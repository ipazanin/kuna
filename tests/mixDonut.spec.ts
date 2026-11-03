import { describe, expect, it } from 'vitest'

import type { GroupOf, HoldingMix } from '../src/apps/investments/holdings/domain/holdingMix'
import { mixDonut } from '../src/apps/investments/holdings/presentation/mixDonut'
import { words } from '../src/apps/investments/holdings/presentation/words'
import type { Mix } from '../src/apps/investments/workbook/domain/mixGroup'
import { ratioOf, sumMoney } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { EURO } from '../src/shared/money/currencyCode'
import { USD, account, book } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

function mixOf<Of extends Mix>(mix: Of, values: readonly (readonly [GroupOf<Of>, number])[], unknown: Money = euros(0)): HoldingMix<Of> {
  const whole = sumMoney([unknown, ...values.map(([, value]) => euros(value))])
  return {
    mix,
    parts: values.map(([group, value]) => ({ group, value: euros(value), share: ratioOf(euros(value), whole) })),
    whole,
    unknown,
    missing: [],
  }
}

const HOLDINGS = { path: '/investments/holdings' }

describe('a mix as the parts of a ring', () => {
  it('colours the four largest of an open list by size and folds the rest with what nothing places into one grey part', () => {
    const sectors = mixOf(
      'sector',
      [
        ['information-technology', 4000],
        ['financials', 2000],
        ['health-care', 1500],
        ['industrials', 1000],
        ['energy', 300],
        ['utilities', 200],
      ],
      euros(500),
    )
    const donut = mixDonut(sectors, book({}), null)

    // The rest is 300.00 + 200.00 of the two smallest sectors and 500.00 nothing places yet.
    expect(donut.parts.map((part) => [part.key, part.value, part.colour, part.to])).toEqual([
      ['information-technology', euros(4000), '--series-1', null],
      ['financials', euros(2000), '--series-2', null],
      ['health-care', euros(1500), '--series-3', null],
      ['industrials', euros(1000), '--series-4', null],
      ['other', euros(1000), '--chart-deemphasis', null],
    ])
    expect(donut.parts[4]!.label).toBe(words.mixes.other)
    expect(donut.totalLabel).toBe('of holdings')
  })

  it('names one holding under the total of a ring of that holding alone', () => {
    const sectors = mixOf('sector', [
      ['information-technology', 600],
      ['financials', 400],
    ])

    expect(mixDonut(sectors, book({}), null, 'holding').totalLabel).toBe('of this holding')
  })

  it('gives every class its own colour whatever its size, gold and crypto too, in order of size', () => {
    const classes = mixOf('class', [
      ['gold', 5000],
      ['stocks', 4000],
      ['crypto', 3000],
      ['cash', 2000],
      ['money-market', 1000],
      ['bonds', 500],
    ])
    const donut = mixDonut(classes, book({}), null)
    const grouped = { ...HOLDINGS, query: { group: 'class', split: 'class' } }

    expect(donut.parts.map((part) => [part.key, part.label, part.value, part.colour, part.to])).toEqual([
      ['gold', words.classes.gold, euros(5000), '--invest-gold', grouped],
      ['stocks', words.classes.stocks, euros(4000), '--invest-stocks', grouped],
      ['crypto', words.classes.crypto, euros(3000), '--invest-crypto', grouped],
      ['cash', words.classes.cash, euros(2000), '--invest-cash', grouped],
      ['money-market', words.classes['money-market'], euros(1000), '--invest-money-market', grouped],
      ['bonds', words.classes.bonds, euros(500), '--invest-bonds', grouped],
    ])
  })

  it('opens Holdings grouped and split by currency at the same day, and gives account parts no link', () => {
    const day = civil('2025-12-31')
    const currencies = mixDonut(
      mixOf('currency', [
        [EURO, 3000],
        [USD, 1000],
      ]),
      book({}),
      day,
    )
    const first = account('first', 'First')
    const accounts = mixDonut(mixOf('account', [[first.id, 4000]]), book({ accounts: [first] }), day)

    expect(currencies.parts.map((part) => part.to)).toEqual([
      { ...HOLDINGS, query: { group: 'currency', split: 'currency', on: day } },
      { ...HOLDINGS, query: { group: 'currency', split: 'currency', on: day } },
    ])
    expect(accounts.parts.map((part) => [part.label, part.to])).toEqual([['First', null]])
    expect(accounts.opens).toBeUndefined()
  })
})
