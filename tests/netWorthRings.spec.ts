import { describe, expect, it } from 'vitest'

import type { CountedHubPart } from '../src/shared/app/appContribution'
import { netWorthSides } from '../src/shared/app/netWorthSides'
import { DEFAULT_MONEY_FORMAT, formatMoney } from '../src/shared/money/moneyFormat'
import { netWorthRings } from '../src/shell/netWorth/netWorthRings'
import type { NetWorthRing } from '../src/shell/netWorth/netWorthRings'
import { euros } from './fixtures/ledger'

function part(key: string, cents: number, side: CountedHubPart['side'], caption: string | null = null): CountedHubPart {
  return { key, label: key, cents: euros(cents), side, caption, to: `/${key}` }
}

function app(id: string, parts: readonly CountedHubPart[]) {
  return { name: id, notSetUp: false, currency: 'EUR', figures: { parts, notes: [] }, app: { colour: `--app-${id}` as const, homeCard: { icon: `i-${id}` } }, opens: `/${id}` }
}

function loans(count: number) {
  return Array.from({ length: count }, (_, at) => part(`loan ${at + 1}`, 10_000 - at * 1_000, 'owes', `Next payment of loan ${at + 1}`))
}

function ringsOf(apps: ReturnType<typeof app>[]) {
  const sides = netWorthSides(apps)
  const cards = netWorthRings(sides, DEFAULT_MONEY_FORMAT)
  return { sides, cards, rings: cards.filter((card): card is NetWorthRing => card.kind === 'ring') }
}

function sumOf(parts: readonly { readonly value: number }[]): number {
  return parts.reduce((sum, shown) => sum + shown.value, 0)
}

const sample = [
  app('assets', [part('assets value', 250_000, 'has', 'Includes estimates')]),
  app('investments', [part('investments value', 40_000, 'has')]),
  app('spending', [part('bank and cash', 2_000, 'has')]),
]

describe('the rings of Net worth', () => {
  it("colours what you have by app, keeps each part's line, and adds up to the side's total", () => {
    const { sides, rings } = ringsOf([...sample, app('loans', [part('owed to you', 500, 'has'), ...loans(2)])])
    const has = rings.find((ring) => ring.side === 'has')!

    expect(has.parts.map((shown) => [shown.key, shown.colour])).toEqual([
      ['assets value', '--app-assets'],
      ['investments value', '--app-investments'],
      ['bank and cash', '--app-spending'],
      ['owed to you', '--app-loans'],
    ])
    expect(has.parts[0]?.caption).toBe('Includes estimates')
    expect(sumOf(has.parts)).toBe(sides.has.total)
    expect(has.total).toBe(formatMoney(sides.has.total))
  })

  it("shows a side of one part as that part's row with its app, amount and line, and no ring, on either side", () => {
    const { cards } = ringsOf([app('spending', [part('bank and cash', 2_000, 'has')]), app('loans', loans(1))])

    expect(cards.map((card) => [card.side, card.kind])).toEqual([
      ['has', 'part'],
      ['owes', 'part'],
    ])
    expect(cards[1]).toMatchObject({
      title: 'What you owe',
      app: { colour: '--app-loans' },
      part: { key: 'loan 1', caption: 'Next payment of loan 1', to: '/loan 1' },
      figure: formatMoney(euros(10_000)),
    })
  })

  it('folds what you owe past the three largest into one grey part that opens the app they come from, and still adds up', () => {
    const { sides, rings } = ringsOf([...sample, app('loans', loans(5))])
    const owes = rings.find((ring) => ring.side === 'owes')!

    expect(owes.parts.map((shown) => [shown.key, shown.colour])).toEqual([
      ['loan 1', '--net-debt-1'],
      ['loan 2', '--net-debt-2'],
      ['loan 3', '--net-debt-3'],
      ['other debts', '--chart-deemphasis'],
    ])
    // 7,000.00 + 6,000.00.
    expect(owes.parts[3]).toMatchObject({ value: euros(13_000), to: '/loans' })
    expect(sumOf(owes.parts)).toBe(sides.owes.total)
  })

  it('counts an overdrawn account among the debts by size, greys a fourth part under its own name, and opens nothing from a grey part folding two apps', () => {
    const { sides, rings } = ringsOf([...sample, app('loans', loans(3)), app('spending-over', [part('overdrawn accounts', 50, 'owes')])])
    const owes = rings.find((ring) => ring.side === 'owes')!

    expect(owes.parts.map((shown) => [shown.key, shown.colour])).toEqual([
      ['loan 1', '--net-debt-1'],
      ['loan 2', '--net-debt-2'],
      ['loan 3', '--net-debt-3'],
      ['overdrawn accounts', '--chart-deemphasis'],
    ])
    expect(sumOf(owes.parts)).toBe(sides.owes.total)

    const folding = ringsOf([...sample, app('loans', loans(4)), app('spending-over', [part('overdrawn accounts', 50, 'owes')])]).rings.find((ring) => ring.side === 'owes')!
    // 7,000.00 + 50.00.
    expect(folding.parts.at(-1)).toMatchObject({ key: 'other debts', value: euros(7_050), to: null })
  })

  it('shows nothing for a side with no part', () => {
    expect(ringsOf(sample).cards.map((card) => card.side)).toEqual(['has'])
  })
})
