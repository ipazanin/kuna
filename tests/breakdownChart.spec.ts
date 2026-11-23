import { describe, expect, it, vi } from 'vitest'

import type { BreakdownLine } from '../src/apps/spending/analytics/domain/spanBreakdown'
import { breakdownChart, lineName } from '../src/apps/spending/analytics/presentation/breakdownChart'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import type { BarSeries } from '../src/shared/charts/echarts'
import { euros } from './fixtures/ledger'

const GREY = '#a3adb9'
const TOKENS = { series: ['s1', 's2', 's3', 's4'], deemphasis: GREY, hatch: 'hatch', inkSecondary: 'ink-secondary', inkMuted: 'ink-muted' } as unknown as ChartTokens

// A group with no swatch left falls back to the grey token, which the page resolves to the same grey the rest bar takes.
vi.stubGlobal('document', { documentElement: {} })
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (token: string) => (token === '--chart-deemphasis' ? GREY : token) }))

function line(key: string, spent: number): BreakdownLine {
  return { key, name: key, children: [], spent: euros(spent), income: euros(0), saved: euros(0), groups: [], latest: null, rows: 1, unrated: 0 }
}

const LINES = [line('Home', 900), line('Food', 500), line('Travel', 300), line('Health', 200), line('Gifts', 100), line('Pets', 50)]

interface BarFill {
  readonly color: string
  readonly decal?: unknown
}

function fillsOf(option: unknown): readonly BarFill[] {
  const [series] = (option as { series: readonly BarSeries[] }).series
  return (series?.data ?? []).map((bar) => {
    const { color, decal } = (bar as { itemStyle: BarFill }).itemStyle
    return { color, decal }
  })
}

describe("Analysis' breakdown chart", () => {
  it('hatches the bar that holds the rest, so it never wears the fill of a group with no swatch left', () => {
    const groups = fillsOf(breakdownChart(LINES, 'category', () => '--chart-deemphasis', 'October', TOKENS).option)
    const payees = breakdownChart(LINES, 'payee', () => '--chart-deemphasis', 'October', TOKENS)
    const rest = fillsOf(payees.option).find((_fill, place) => payees.lineAt(place) === null)

    expect(groups.map((fill) => fill.color)).toEqual(LINES.map(() => GREY))
    expect(rest?.color).toBe(GREY)
    expect(rest?.decal).toBeDefined()
    for (const group of groups) expect(group).not.toEqual(rest)
  })

  it('names the line on no account Shared costs under accounts, and leaves a blank name blank elsewhere', () => {
    const noAccount = { ...line('', 80), key: null }
    expect(lineName(noAccount, 'account')).toBe('Shared costs')
    expect(lineName({ ...line('', 80), name: '' }, 'payee')).toBe('')
    expect(lineName(line('Main', 80), 'account')).toBe('Main')
  })
})
