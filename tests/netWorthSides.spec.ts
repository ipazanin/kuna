import { describe, expect, it } from 'vitest'

import type { CountedHubPart } from '../src/shared/app/appContribution'
import { netWorthSides } from '../src/shared/app/netWorthSides'
import { personalNet } from '../src/shared/app/personalNet'
import type { PersonalApp } from '../src/shared/app/personalNet'
import { subtractMoney } from '../src/shared/money/money'
import { euros } from './fixtures/ledger'

function part(key: string, cents: number, side: CountedHubPart['side']): CountedHubPart {
  return { key, label: key, cents: euros(cents), side, caption: null, to: '/' }
}

function app(name: string, figures: PersonalApp['figures'], notSetUp = false): PersonalApp {
  return { name, notSetUp, currency: 'EUR', figures }
}

const loans = app('Loans', {
  parts: [part('owed to you', 500, 'has'), part('bank loan from Example Bank paid out 2021-03-01', 95_000, 'owes'), part('informal loan started 2025-06-01', 3_000, 'owes')],
  notes: [],
})
const investments = app('Investments', { parts: [part('investments value', 40_000, 'has')], notes: ['1 holding without a price'] })
const spending = app('Spending', { parts: [part('bank and cash', 2_390.46, 'has'), part('overdrawn accounts', 30, 'owes')], notes: [] })

describe('the two sides of Net worth', () => {
  it('splits every part into what you have and what you owe, largest first, each with its app and its total', () => {
    const { has, owes } = netWorthSides([loans, investments, spending])

    expect(has.parts.map(({ app: from, part: shown }) => [from.name, shown.key])).toEqual([
      ['Investments', 'investments value'],
      ['Spending', 'bank and cash'],
      ['Loans', 'owed to you'],
    ])
    // 40,000.00 + 2,390.46 + 500.00.
    expect(has.total).toBe(euros(42_890.46))
    expect(owes.parts.map(({ part: shown }) => shown.key)).toEqual(['bank loan from Example Bank paid out 2021-03-01', 'informal loan started 2025-06-01', 'overdrawn accounts'])
    // 95,000.00 + 3,000.00 + 30.00.
    expect(owes.total).toBe(euros(98_030))
  })

  it('takes what you owe off what you have to the sum Net worth leads with', () => {
    const apps = [loans, investments, spending]
    const { has, owes } = netWorthSides(apps)

    expect(personalNet(apps).sum).toEqual({ state: 'ready', cents: subtractMoney(has.total, owes.total) })
  })

  it('leaves out an app not set up, one still opening and one that failed, as the sum does', () => {
    const { has, owes } = netWorthSides([app('Loans', 'opening'), app('Assets', 'failed'), app('Spending', spending.figures, true), investments])

    expect(has.parts.map(({ part: shown }) => shown.key)).toEqual(['investments value'])
    expect(has.total).toBe(euros(40_000))
    expect(owes).toEqual({ parts: [], total: euros(0) })
  })
})
