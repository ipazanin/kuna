import { afterEach, describe, expect, it, vi } from 'vitest'

import { holdingsList } from '../src/apps/investments/holdings/domain/holdingsList'
import type { HoldingsGroup, HoldingsView } from '../src/apps/investments/holdings/domain/holdingsList'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { groupCount } from '../src/apps/investments/holdings/presentation/holdingText'
import { WORKED_PRICES, WORKED_RATES, workedPortfolio } from './fixtures/investments'
import { civil } from './fixtures/ledger'

function groupsBy(grouping: HoldingsView['grouping']): readonly HoldingsGroup[] {
  const records = workedPortfolio()
  return holdingsList(portfolioFigures({ book: records, prices: WORKED_PRICES, rates: WORKED_RATES, today: civil('2026-10-29') }), records, { grouping, find: '', sort: null }).groups
}

function counts(groups: readonly HoldingsGroup[], count: (group: HoldingsGroup) => string): Record<string, string> {
  return Object.fromEntries(groups.map((group) => [group.key, count(group)]))
}

afterEach(() => {
  vi.doUnmock('../src/shared/text/language')
})

describe('how many lines a group of holdings lists', () => {
  it('counts the holdings, the cash balances, or both', () => {
    expect(counts(groupsBy('class'), groupCount)).toEqual({ stocks: '2 holdings', cash: '2 cash balances' })
    expect(counts(groupsBy('currency'), groupCount)).toEqual({ EUR: '1 holding and 1 cash balance', USD: '1 holding and 1 cash balance' })
  })

  it('counts them in Croatian', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const croatian = await import('../src/apps/investments/holdings/presentation/holdingText')

    expect(counts(groupsBy('class'), croatian.groupCount)).toEqual({ stocks: '2 pozicije', cash: '2 novčana stanja' })
    expect(counts(groupsBy('currency'), croatian.groupCount)).toEqual({ EUR: '1 pozicija i 1 novčano stanje', USD: '1 pozicija i 1 novčano stanje' })
  })
})
