import { describe, expect, it } from 'vitest'

import { shownYear, yearOptions } from '../src/apps/company/packs/hr-doo/presentation/year/yearChoice'

describe('year options', () => {
  it('offers the years with accountant lines, the year just ended, this year and the next, oldest first', () => {
    expect(yearOptions([2024], 2023, 2026).map((option) => [option.year, option.view, option.tabs.join(' ')])).toEqual([
      [2024, 'closed', 'accountant statements taxes assets'],
      [2025, 'ended', 'forecast statements taxes assets'],
      [2026, 'open', 'forecast plan pay taxes assets'],
      [2027, 'open', 'forecast plan pay taxes assets'],
    ])
  })

  it('closes the year just ended once its accountant lines are in', () => {
    expect(yearOptions([2025], 2025, 2026).find((option) => option.year === 2025)?.view).toBe('closed')
  })

  it('leaves the year just ended out when the ledger starts this year', () => {
    expect(yearOptions([], 2026, 2026).map((option) => option.year)).toEqual([2026, 2027])
  })

  it('takes a year with accountant lines as closed, even before it ends', () => {
    expect(yearOptions([2026], 2025, 2026).find((option) => option.year === 2026)?.view).toBe('closed')
  })
})

describe('the year a link opens', () => {
  const options = yearOptions([2025], 2025, 2026)

  it('is the current year without a year in the address', () => {
    expect(shownYear(options, null, null, 2026)).toBe(2026)
    expect(shownYear(options, null, 'taxes', 2026)).toBe(2026)
    expect(shownYear(options, null, 'pay', 2026)).toBe(2026)
  })

  it('is the year asked for when it is offered, and the current year when it is not', () => {
    expect(shownYear(options, 2027, null, 2026)).toBe(2027)
    expect(shownYear(options, 2019, null, 2026)).toBe(2026)
  })

  it('is the latest year that has the tab when the year asked for lacks it', () => {
    expect(shownYear(options, null, 'statements', 2026)).toBe(2025)
    expect(shownYear(options, 2027, 'accountant', 2026)).toBe(2025)
    expect(shownYear(options, 2025, 'forecast', 2026)).toBe(2027)
  })

  it('opens the year just ended on its statements, where its first accountant lines go', () => {
    expect(shownYear(yearOptions([], 2025, 2026), null, 'statements', 2026)).toBe(2025)
  })

  it('stays on the year asked for when no year has the tab', () => {
    expect(shownYear(options, 2027, 'ruleset', 2026)).toBe(2027)
  })
})
