import { describe, expect, it } from 'vitest'

import type { Workbook } from '../src/features/workbook/domain/workbook'
import { accrualYear } from '../src/packs/hr-doo/domain/accrual/accrualYear'
import { yearEndOpenItems } from '../src/packs/hr-doo/domain/yearEnd/yearEndOpenItems'
import type { YearEndOpenItem } from '../src/packs/hr-doo/domain/yearEnd/yearEndOpenItems'
import { STUDIO_ROWS, exampleStudio, yearEndLine } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { euros, ledger } from './fixtures/ledger'

function openItems(workbook: Workbook, year = 2025): YearEndOpenItem[] {
  return yearEndOpenItems(workbook, accrualYear(workbook, year, { depreciation: { depreciationDoubled: false }, citAdvancesPaid: null }))
}

function keys(items: readonly YearEndOpenItem[], group: YearEndOpenItem['group']): string[] {
  return items.filter((item) => item.group === group).map((item) => item.key)
}

describe('yearEndOpenItems', () => {
  it('lists each accountant’s choice the figures rest on, with what would settle it', () => {
    const items = openItems(exampleStudio({ yearEndLines: [yearEndLine(2025, 'grant', 'released-in-year', 4900)] }))
    const grant = items.find((item) => item.key === 'grant-schedule')

    expect(keys(items, 'judgement')).toEqual(['grant-schedule'])
    expect(grant).toMatchObject({ figure: { amount: euros(-100) }, rules: ['hr.acc.grant-recognition'], settled: false })
    expect(grant?.settledBy).not.toBe('')
  })

  it('lists the gap to the accountant’s profit that nothing explains', () => {
    const items = openItems(exampleStudio({ yearEndLines: [yearEndLine(2025, 'pl', 'profit-before-tax', 9000)] }))

    expect(keys(items, 'unexplained')).toEqual(['unexplained-before-tax'])
    expect(items.find((item) => item.group === 'unexplained')?.figure?.amount).toBe(euros(118.3))
  })

  it('asks about each month no invoice delivers in, and says so when every month has one', () => {
    expect(keys(openItems(exampleStudio()), 'completeness')).toEqual([
      'uninvoiced-2025-04',
      'uninvoiced-2025-05',
      'uninvoiced-2025-06',
      'uninvoiced-2025-07',
      'uninvoiced-2025-08',
      'uninvoiced-2025-09',
      'uninvoiced-2025-10',
      'uninvoiced-2025-11',
    ])
    const invoiced = openItems(exampleStudio({ invoices: [] })).filter((item) => item.group === 'completeness')
    expect(invoiced.map((item) => [item.key, item.settled])).toEqual([['invoiced', true]])
  })

  it('asks about a purchase above the asset threshold that no asset row claims', () => {
    const items = openItems(exampleStudio({ invoices: [], assets: [] }))

    // The 3,000.00 laptop order is 2,400.00 without its VAT. The 200.00 desk is small inventory.
    expect(items.filter((item) => item.key.startsWith('no-asset-')).map((item) => item.figure?.amount)).toEqual([euros(2400)])
  })

  it('lists what loans to the owner open during the year call for', () => {
    const items = openItems(exampleStudio())

    expect(keys(items, 'compliance')).toEqual(['loan-benefit', 'related-party-report', 'sole-member-deals', 'asset-purchase-decision'])
    expect(items.find((item) => item.key === 'loan-benefit')).toMatchObject({ figure: { amount: euros(1000) }, rules: ['hr.pit.loan-benefit'] })
    // Lent in November 2025 and repaid in February 2026, so 2026 has it too.
    expect(keys(openItems(exampleStudio(), 2026), 'compliance')).toContain('loan-benefit')
  })

  it('asks for the members’ decision on a purchase above a fifth of the share capital in the first two years', () => {
    const items = openItems(exampleStudio())

    // The laptop order of 3,000.00 is above 500.00. The desk order of 250.00 is not.
    expect(items.find((item) => item.key === 'asset-purchase-decision')?.figure?.steps.map((step) => step.amount)).toEqual([euros(3000)])
    const capital = openItems(exampleStudio({ yearEndLines: [yearEndLine(2025, 'balance', 'share-capital', 20000)] }))
    expect(keys(capital, 'compliance')).not.toContain('asset-purchase-decision')
  })

  it('lists no loan items for a year without loans to the owner', () => {
    const workbook = exampleStudio()
    const withoutLoans = exampleStudio({
      transactions: withPackBuckets(ledger(STUDIO_ROWS.filter((row) => row.category?.startsWith('owner-loan') !== true)), workbook.categories),
    })

    expect(keys(openItems(withoutLoans), 'compliance')).toEqual(['asset-purchase-decision'])
  })
})
