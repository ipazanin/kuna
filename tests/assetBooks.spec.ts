import { describe, expect, it } from 'vitest'

import type { Asset, AssetGroup } from '../src/features/workbook/domain/assets'
import type { Grant } from '../src/features/workbook/domain/grants'
import { assetBooks, depreciationByYear, doubledRatesEffect } from '../src/packs/hr-doo/domain/assets/assetBooks'
import type { DoubledRatesEffect } from '../src/packs/hr-doo/domain/assets/assetBooks'
import { ZERO } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { ASSET_RECORDS, GRANT_RECORDS } from '../src/features/workbook/domain/recordKind'

interface AssetSpec {
  readonly name: string
  readonly cost: number
  readonly inUse: string
  readonly group?: AssetGroup
  readonly doubled?: boolean
  readonly fundedBy?: string
}

function asset(spec: AssetSpec): Asset {
  return {
    name: spec.name,
    bought: civil(spec.inUse),
    inUse: civil(spec.inUse),
    costNet: euros(spec.cost),
    group: spec.group ?? 'computers',
    doubledRate: spec.doubled ?? false,
    disposed: null,
    fundedBy: spec.fundedBy ?? '',
    ledgerReference: '',
    note: '',
    id: recordIdOf(ASSET_RECORDS, 'row-2'),
  }
}

function grant(fixed: number, variable: number): Grant {
  return {
    slug: 'example-grant',
    received: civil('2025-03-10'),
    amount: euros(fixed + variable),
    parts: { fixed: euros(fixed), variable: euros(variable) },
    period: { from: civil('2025-03-01'), to: civil('2027-02-28') },
    release: 'fixed-then-assets',
    clawbackFirstYear: 'whole',
    clawbackSecondYear: null,
    employmentRequiredUntil: null,
    note: '',
    id: recordIdOf(GRANT_RECORDS, 'example-grant'),
  }
}

// 2,400.00 at 50% is 100.00 a month from April 2025: 900.00, 1,200.00 and 300.00. Doubled it is 200.00 a month: 1,800.00, then the 600.00 left.
const LAPTOP: AssetSpec = { name: 'Example laptop', cost: 2400, inUse: '2025-03-20' }
// 2,000.00 at 25% from February 2025: 458.33, then 500.00 a year, then the 41.67 left in 2029.
const PRESS: AssetSpec = { name: 'Example press', cost: 2000, inUse: '2025-01-15', group: 'equipment' }
const DESK: AssetSpec = { name: 'Example desk', cost: 500, inUse: '2025-02-15', group: 'equipment' }
const SINGLE = { depreciationDoubled: false }
const SMALL_REVENUE = () => euros(60000)

function effectOf(assets: readonly Asset[], grants: readonly Grant[], revenue: (year: number) => Money = SMALL_REVENUE): DoubledRatesEffect {
  return doubledRatesEffect(assets, grants, assetBooks(assets, grants, SINGLE), revenue)
}

function changesByYear(effect: DoubledRatesEffect) {
  return effect.years.map((entry) => [entry.year, entry.depreciation.amount, entry.grantReleased.amount, entry.profitBeforeTax.amount, entry.profitTax.amount])
}

describe('depreciationByYear', () => {
  it('adds up each year over the assets, with the charge of each asset as a step, and leaves small inventory out', () => {
    const books = assetBooks([LAPTOP, PRESS, DESK].map(asset), [], SINGLE)
    const years = depreciationByYear(books.schedules)

    expect(years.map((entry) => [entry.year, entry.total.amount])).toEqual([
      [2025, euros(1358.33)],
      [2026, euros(1700)],
      [2027, euros(800)],
      [2028, euros(500)],
      [2029, euros(41.67)],
    ])
    expect(years[0]?.byAsset.map((charge) => charge.schedule.asset.name)).toEqual(['Example laptop', 'Example press'])
    expect(years[0]?.total.steps.map((step) => step.amount)).toEqual([euros(900), euros(458.33)])
    expect(years[0]?.total.rules.map((citation) => citation.ruleId)).toEqual(['hr.cit.depreciation-rates', 'hr.cit.depreciation-start'])
  })
})

describe('doubledRatesEffect', () => {
  it('moves depreciation forward for an asset no grant paid for, and the profit tax with it at the low rate', () => {
    const effect = effectOf([asset(LAPTOP)], [])

    expect(effect.changesAnything).toBe(true)
    expect(changesByYear(effect)).toEqual([
      [2025, euros(900), ZERO, euros(-900), euros(-90)],
      [2026, euros(-600), ZERO, euros(600), euros(60)],
      [2027, euros(-300), ZERO, euros(300), euros(30)],
    ])
    expect(effect.years[0]?.profitTax.label).toBe('Change in profit tax for 2025, at 10% for revenue below the threshold')
    expect(effect.years[0]?.profitTax.rules.map((citation) => citation.ruleId)).toContain('hr.cit.rate')
    expect(effect.years[0]?.profitTax.rules.map((citation) => citation.ruleId)).not.toContain('hr.cit.grant-revenue')
  })

  it('leaves profit as it is while a grant releases its variable part with the depreciation', () => {
    const effect = effectOf([asset({ ...LAPTOP, fundedBy: 'example-grant' })], [grant(4000, 6000)])

    expect(changesByYear(effect)).toEqual([
      [2025, euros(900), euros(900), ZERO, ZERO],
      [2026, euros(-600), euros(-600), ZERO, ZERO],
      [2027, euros(-300), euros(-300), ZERO, ZERO],
    ])
    expect(effect.years[0]?.profitTax.rules.map((citation) => citation.ruleId)).toContain('hr.cit.grant-revenue')
  })

  it('changes profit once the variable part runs out before the depreciation does', () => {
    // At single rates 900.00 of the 1,000.00 is released in 2025 and the last 100.00 in 2026.
    // Doubled, all 1,000.00 goes in 2025, so 2025 profit falls by 900.00 less 100.00.
    const effect = effectOf([asset({ ...LAPTOP, fundedBy: 'example-grant' })], [grant(4000, 1000)])

    expect(changesByYear(effect)[0]).toEqual([2025, euros(900), euros(100), euros(-800), euros(-80)])
    expect(changesByYear(effect)[1]).toEqual([2026, euros(-600), euros(-100), euros(500), euros(50)])
  })

  it('uses the high rate once revenue reaches the threshold', () => {
    const effect = effectOf([asset(LAPTOP)], [], () => euros(1_000_000))

    expect(effect.years[0]?.profitTax.amount).toBe(euros(-162))
    expect(effect.years[0]?.rate).toBe(1800)
    expect(effect.years[0]?.profitTax.label).toBe('Change in profit tax for 2025, at 18%')
  })

  it('changes nothing when every asset already depreciates at the doubled rate', () => {
    const effect = effectOf([asset({ ...LAPTOP, doubled: true })], [])

    expect(effect.changesAnything).toBe(false)
    expect(effect.years.every((entry) => entry.depreciation.amount === 0 && entry.profitTax.amount === 0)).toBe(true)
  })
})
