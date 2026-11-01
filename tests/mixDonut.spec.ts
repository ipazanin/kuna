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
  })

  it('keeps the class colours whatever their size, and puts gold and crypto in the grey part', () => {
    const classes = mixOf('class', [
      ['gold', 5000],
      ['stocks', 4000],
      ['crypto', 3000],
      ['cash', 2000],
      ['money-market', 1000],
      ['bonds', 500],
    ])
    const donut = mixDonut(classes, book({}), null)
    const grouped = { ...HOLDINGS, query: { group: 'class' } }

    expect(donut.parts.map((part) => [part.key, part.value, part.colour, part.to])).toEqual([
      ['stocks', euros(4000), '--invest-stocks', grouped],
      ['cash', euros(2000), '--invest-cash', grouped],
      ['money-market', euros(1000), '--invest-money-market', grouped],
      ['bonds', euros(500), '--invest-bonds', grouped],
      ['other', euros(8000), '--chart-deemphasis', grouped],
    ])
    expect(donut.parts[4]!.label).toBe(words.mixes.goldAndCrypto)
  })

  it('names the grey part of the class ring by its class when only one of gold and crypto is held', () => {
    const donut = mixDonut(
      mixOf('class', [
        ['stocks', 4000],
        ['gold', 1000],
      ]),
      book({}),
      null,
    )

    expect(donut.parts.map((part) => [part.label, part.colour])).toEqual([
      [words.classes.stocks, '--invest-stocks'],
      [words.classes.gold, '--chart-deemphasis'],
    ])
  })

  it('opens Holdings grouped by currency at the same day, and gives account parts no link', () => {
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
      { ...HOLDINGS, query: { group: 'currency', on: day } },
      { ...HOLDINGS, query: { group: 'currency', on: day } },
    ])
    expect(accounts.parts.map((part) => [part.label, part.to])).toEqual([['First', null]])
    expect(accounts.opens).toBeUndefined()
  })
})
