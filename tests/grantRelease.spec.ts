import { describe, expect, it } from 'vitest'

import type { Asset, AssetGroup } from '../src/features/workbook/domain/assets'
import type { Grant } from '../src/features/workbook/domain/grants'
import type { YearEndLine } from '../src/features/workbook/domain/yearEnd'
import { depreciationSchedule } from '../src/packs/hr-doo/domain/assets/depreciationSchedule'
import { clawbackExposure, deferredOn, grantRelease, grantResiduals } from '../src/packs/hr-doo/domain/grants/grantRelease'
import type { GrantReleaseSchedule } from '../src/packs/hr-doo/domain/grants/grantRelease'
import { civil, euros } from './fixtures/ledger'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { ASSET_RECORDS, GRANT_RECORDS, YEAR_END_RECORDS } from '../src/features/workbook/domain/recordKind'

const GRANT: Grant = {
  slug: 'example-grant',
  received: civil('2025-03-10'),
  amount: euros(10000),
  parts: { fixed: euros(4000), variable: euros(6000) },
  period: { from: civil('2025-03-01'), to: civil('2027-02-28') },
  release: 'fixed-then-assets',
  clawbackFirstYear: 'whole',
  clawbackSecondYear: euros(7000),
  employmentRequiredUntil: civil('2027-02-28'),
  note: '',
  id: recordIdOf(GRANT_RECORDS, 'example-grant'),
}

interface AssetSpec {
  readonly name: string
  readonly cost: number
  readonly inUse: string
  readonly group?: AssetGroup
  readonly disposed?: string
  readonly fundedBy?: string
}

function asset(spec: AssetSpec): Asset {
  return {
    name: spec.name,
    bought: civil(spec.inUse),
    inUse: civil(spec.inUse),
    costNet: euros(spec.cost),
    group: spec.group ?? 'computers',
    doubledRate: false,
    disposed: spec.disposed === undefined ? null : civil(spec.disposed),
    fundedBy: spec.fundedBy ?? 'example-grant',
    ledgerReference: '',
    note: '',
    id: recordIdOf(ASSET_RECORDS, 'row-2'),
  }
}

function schedules(...specs: AssetSpec[]) {
  return specs.map((spec) => depreciationSchedule(asset(spec), { depreciationDoubled: false }))
}

// 2,400.00 at 50% is 100.00 a month from April 2025 to March 2027.
const LAPTOP: AssetSpec = { name: 'Example laptop', cost: 2400, inUse: '2025-03-20' }
// Small inventory written off in February 2025, before the grant arrived.
const DESK: AssetSpec = { name: 'Example desk', cost: 500, inUse: '2025-02-15', group: 'equipment' }

function byYear(release: GrantReleaseSchedule) {
  return release.years.map((year) => [year.year, year.released.amount, year.deferredAtYearEnd.amount])
}

function grantLine(year: number, line: string, amount: number): YearEndLine {
  return {
    year,
    statement: 'grant',
    line,
    label: line,
    figure: { kind: 'money', amount: euros(amount) },
    categories: [],
    aop: '',
    source: 'example-notes.pdf',
    note: '',
    id: recordIdOf(YEAR_END_RECORDS, 'row-2'),
  }
}

describe('grantRelease, fixed then assets', () => {
  it('releases the fixed part on receipt and the variable part with the funded assets, catching up costs from before receipt', () => {
    const release = grantRelease(GRANT, schedules(LAPTOP, DESK, { ...LAPTOP, name: 'Unfunded laptop', fundedBy: '' }))

    // 2025: 4,000.00 fixed, the 500.00 desk and 9 months of the laptop. Then 12 and 3 months.
    expect(byYear(release)).toEqual([
      [2025, euros(5400), euros(4600)],
      [2026, euros(1200), euros(3400)],
      [2027, euros(300), euros(3100)],
    ])
    expect(release.months[0]).toEqual({ month: '2025-03', released: euros(4500) })
    expect(release.months.at(-1)?.month).toBe('2027-03')
    // 6,000.00 variable less the 2,900.00 the funded assets cost stays deferred.
    expect(release.neverReleased.amount).toBe(euros(3100))

    const first = release.years[0]!.released
    expect(first.steps.map((step) => [step.label, step.amount])).toEqual([
      ['Fixed part, on receipt', euros(4000)],
      ['Example laptop, depreciation and write-offs', euros(900)],
      ['Example desk, depreciation and write-offs', euros(500)],
    ])
    expect(first.rules.map((citation) => citation.ruleId)).toEqual([
      'hr.acc.grant-recognition',
      'hr.cit.depreciation-rates',
      'hr.cit.depreciation-start',
      'hr.cit.asset-threshold',
      'hr.acc.capitalisation',
    ])
  })

  it('stops at the variable part', () => {
    const small: Grant = { ...GRANT, amount: euros(1500), parts: { fixed: euros(500), variable: euros(1000) } }
    const release = grantRelease(small, schedules(LAPTOP))

    expect(byYear(release)).toEqual([
      [2025, euros(1400), euros(100)],
      [2026, euros(100), euros(0)],
    ])
    expect(release.months.at(-1)).toEqual({ month: '2026-01', released: euros(100) })
    const capStep = release.years[1]!.released.steps.at(-1)
    expect(capStep?.label).toBe('Beyond the variable part, not released')
    expect(capStep?.amount).toBe(euros(-1100))
    expect(release.neverReleased.amount).toBe(euros(0))
  })

  it('releases the book value of a funded asset written off on disposal', () => {
    // 15 months of 100.00 to June 2026, then the 900.00 left is written off.
    const release = grantRelease(GRANT, schedules({ ...LAPTOP, disposed: '2026-06-10' }))

    expect(byYear(release)).toEqual([
      [2025, euros(4900), euros(5100)],
      [2026, euros(1500), euros(3600)],
    ])
  })

  it('refuses a grant without fixed and variable parts', () => {
    expect(() => grantRelease({ ...GRANT, parts: null }, [])).toThrow(RangeError)
  })
})

describe('grantRelease, straight-line', () => {
  it('spreads the whole grant over its period by days, catching up from the period start in the month of receipt', () => {
    const release = grantRelease(GRANT, schedules(LAPTOP), 'straight-line')

    // 730 days. 306 fall in 2025: 10,000.00 x 306 / 730 = 4,191.78. 671 by the end of 2026: 9,191.78.
    expect(byYear(release)).toEqual([
      [2025, euros(4191.78), euros(5808.22)],
      [2026, euros(5000), euros(808.22)],
      [2027, euros(808.22), euros(0)],
    ])
    expect(release.years[0]?.released.steps[0]?.label).toBe("Whole grant, spread over 306 of the period's 730 days")
  })

  it('refuses a grant without a period', () => {
    expect(() => grantRelease({ ...GRANT, period: null }, [], 'straight-line')).toThrow(RangeError)
  })
})

describe('deferredOn and grantResiduals', () => {
  it('holds nothing before receipt and counts a month once it has ended', () => {
    const release = grantRelease(GRANT, schedules(LAPTOP))

    expect(deferredOn(release, civil('2025-03-09')).amount).toBe(euros(0))
    expect(deferredOn(release, civil('2025-03-30')).amount).toBe(euros(10000))
    expect(deferredOn(release, civil('2025-03-31')).amount).toBe(euros(6000))
  })

  it('reports what the policy does not explain of the accountant grant lines, over every grant', () => {
    const release = grantRelease(GRANT, schedules(LAPTOP, DESK))
    const other: Grant = { ...GRANT, slug: 'other-grant', received: civil('2025-09-01'), amount: euros(1000), parts: { fixed: euros(1000), variable: euros(0) } }
    const otherRelease = grantRelease(other, [])

    const checks = grantResiduals(
      [release, otherRelease],
      [grantLine(2025, 'released-in-year', 6500), grantLine(2025, 'deferred-at-year-end', 4500), grantLine(2026, 'released-in-year', 1200)],
    )

    // Ours for 2025: 5,400.00 plus the other grant's 1,000.00, so 6,400.00, and 4,600.00 deferred.
    expect(checks.map((check) => [check.year, check.released?.residual.amount, check.deferred?.residual.amount ?? null])).toEqual([
      [2025, euros(100), euros(-100)],
      [2026, euros(0), null],
    ])
    expect(checks[0]?.released?.ours.amount).toBe(euros(6400))
    expect(checks[0]?.released?.residual.basis).toBe('accountant')
  })
})

describe('clawbackExposure', () => {
  it('follows the first-year terms for a year from the period start, then the second-year terms, then nothing', () => {
    const exposures = ['2025-03-09', '2025-03-10', '2026-02-28', '2026-03-01', '2027-02-28', '2027-03-01'].map((day) => {
      const exposure = clawbackExposure(GRANT, civil(day))
      return [day, exposure?.amount.amount, exposure?.until]
    })

    expect(exposures).toEqual([
      ['2025-03-09', euros(0), '2025-03-09'],
      ['2025-03-10', euros(10000), '2026-02-28'],
      ['2026-02-28', euros(10000), '2026-02-28'],
      ['2026-03-01', euros(7000), '2027-02-28'],
      ['2027-02-28', euros(7000), '2027-02-28'],
      ['2027-03-01', euros(0), null],
    ])
  })

  it('cannot tell without a period or the terms of the year', () => {
    expect(clawbackExposure({ ...GRANT, period: null }, civil('2025-06-01'))).toBeNull()
    expect(clawbackExposure({ ...GRANT, clawbackSecondYear: null }, civil('2026-06-01'))).toBeNull()
  })
})
