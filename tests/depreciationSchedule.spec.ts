import { describe, expect, it } from 'vitest'

import type { Asset, AssetGroup } from '../src/packs/hr-doo/domain/assets/assets'
import { accumulatedDepreciationOn, bookValueOn, depreciationSchedule } from '../src/packs/hr-doo/domain/assets/depreciationSchedule'
import type { DepreciationSchedule } from '../src/packs/hr-doo/domain/assets/depreciationSchedule'
import { sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { ASSET_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'

interface AssetSpec {
  readonly cost: number
  readonly group?: AssetGroup
  readonly bought?: string
  readonly inUse?: string
  readonly doubled?: boolean
  readonly disposed?: string
}

function asset(spec: AssetSpec): Asset {
  const bought = spec.bought ?? '2025-03-10'
  return {
    name: 'Example laptop',
    bought: civil(bought),
    inUse: civil(spec.inUse ?? bought),
    costNet: euros(spec.cost),
    group: spec.group ?? 'computers',
    doubledRate: spec.doubled ?? false,
    disposed: spec.disposed === undefined ? null : civil(spec.disposed),
    fundedBy: '',
    ledgerReference: '',
    note: '',
    id: recordIdOf(ASSET_RECORDS, 'row-2'),
  }
}

const SINGLE = { depreciationDoubled: false }
const DOUBLED = { depreciationDoubled: true }

function chargeByYear(schedule: DepreciationSchedule): Record<number, number> {
  return Object.fromEntries(schedule.years.map((year) => [year.year, year.charge.amount]))
}

function ruleIdsOf(figure: { readonly rules: readonly { readonly ruleId: string }[] }): string[] {
  return figure.rules.map((citation) => citation.ruleId)
}

describe('depreciationSchedule', () => {
  it('starts in the month after the asset is put in use and runs straight-line to a full write-off', () => {
    // 1,800.00 at 50% is 75.00 a month from April 2025: 9 months, 12 months, then 3 months.
    const schedule = depreciationSchedule(asset({ cost: 1800, inUse: '2025-03-10' }), SINGLE)

    expect(schedule.treatment).toBe('depreciated')
    expect(schedule.months[0]).toEqual({ month: '2025-04', charge: euros(75) })
    expect(schedule.months.at(-1)?.month).toBe('2027-03')
    expect(chargeByYear(schedule)).toEqual({ 2025: euros(675), 2026: euros(900), 2027: euros(225) })
    expect(schedule.years[0]?.charge.label).toBe('Depreciation in 2025, 9 months at 50%')
    expect(ruleIdsOf(schedule.years[0]!.charge)).toEqual(['hr.cit.depreciation-rates', 'hr.cit.depreciation-start'])
  })

  it('counts from the day put in use, not the day bought', () => {
    const schedule = depreciationSchedule(asset({ cost: 1800, bought: '2025-05-30', inUse: '2025-07-01' }), SINGLE)

    expect(schedule.months[0]?.month).toBe('2025-08')
    expect(chargeByYear(schedule)[2025]).toBe(euros(375))
  })

  it('rounds each year to the cent and shares it out over the months', () => {
    // 1,000.01 at 50% from September 2025: 4/12 is 166.668, so 166.67. 2026 is 500.005, so 500.01.
    // 2027 would be 333.337 for 8 months, but only 333.33 is left to write off.
    const schedule = depreciationSchedule(asset({ cost: 1000.01, inUse: '2025-08-20' }), SINGLE)

    expect(chargeByYear(schedule)).toEqual({ 2025: euros(166.67), 2026: euros(500.01), 2027: euros(333.33) })
    const months2025 = schedule.months.filter((entry) => entry.month.startsWith('2025')).map((entry) => entry.charge)
    expect(months2025).toEqual([euros(41.67), euros(41.66), euros(41.67), euros(41.67)])
    expect(schedule.months.at(-1)?.month).toBe('2027-08')
    expect(sumMoney(schedule.months.map((entry) => entry.charge))).toBe(euros(1000.01))
  })

  it('doubles the rate when the asset row says so', () => {
    // Equipment at 25%, doubled to 50%, from February 2025: 916.67, then 1,000.00, then the 83.33 left.
    const schedule = depreciationSchedule(asset({ cost: 2000, group: 'equipment', inUse: '2025-01-15', doubled: true }), SINGLE)

    expect(chargeByYear(schedule)).toEqual({ 2025: euros(916.67), 2026: euros(1000), 2027: euros(83.33) })
    expect(schedule.years[0]?.charge.label).toBe('Depreciation in 2025, 11 months at 50%, the doubled rate')
    expect(schedule.years.map((year) => [year.rate, year.doubled])).toEqual([
      [5000, true],
      [5000, true],
      [5000, true],
    ])
  })

  it('doubles the rate for every asset when the settings say so', () => {
    const fromSettings = depreciationSchedule(asset({ cost: 2000, group: 'equipment', inUse: '2025-01-15' }), DOUBLED)
    const single = depreciationSchedule(asset({ cost: 2000, group: 'equipment', inUse: '2025-01-15' }), SINGLE)

    expect(chargeByYear(fromSettings)[2025]).toBe(euros(916.67))
    expect(chargeByYear(single)[2025]).toBe(euros(458.33))
    expect(single.years[0]).toMatchObject({ rate: 2500, doubled: false })
  })

  it('writes off an item at the threshold as small inventory and depreciates one a cent above it', () => {
    const atThreshold = depreciationSchedule(asset({ cost: 665, inUse: '2025-06-12' }), SINGLE)
    const above = depreciationSchedule(asset({ cost: 665.01, inUse: '2025-06-12' }), SINGLE)

    expect(atThreshold.treatment).toBe('small-inventory')
    expect(atThreshold.months).toEqual([])
    expect(atThreshold.writeOff?.on).toBe('2025-06-12')
    expect(atThreshold.writeOff?.figure.amount).toBe(euros(665))
    expect(ruleIdsOf(atThreshold.writeOff!.figure)).toEqual(['hr.cit.asset-threshold', 'hr.acc.capitalisation'])
    expect(bookValueOn(atThreshold, civil('2025-06-11')).amount).toBe(euros(665))
    expect(bookValueOn(atThreshold, civil('2025-06-12')).amount).toBe(euros(0))

    expect(above.treatment).toBe('depreciated')
    expect(above.writeOff).toBeNull()
    expect(above.months[0]?.month).toBe('2025-07')
  })

  it('stops at the month of disposal and writes the book value off', () => {
    // 1,200.00 at 50% is 50.00 a month from February to June 2025.
    const schedule = depreciationSchedule(asset({ cost: 1200, bought: '2025-01-10', disposed: '2025-06-15' }), SINGLE)

    expect(schedule.months.map((entry) => entry.month)).toEqual(['2025-02', '2025-03', '2025-04', '2025-05', '2025-06'])
    expect(chargeByYear(schedule)).toEqual({ 2025: euros(250) })
    expect(schedule.writeOff?.on).toBe('2025-06-15')
    expect(schedule.writeOff?.figure.amount).toBe(euros(950))
    expect(bookValueOn(schedule, civil('2025-06-14')).amount).toBe(euros(1000))
    expect(bookValueOn(schedule, civil('2025-06-15')).amount).toBe(euros(0))
    expect(accumulatedDepreciationOn(schedule, civil('2025-06-15')).amount).toBe(euros(250))
  })

  it('gives book value and accumulated depreciation at any date, a month counting from its last day', () => {
    const schedule = depreciationSchedule(asset({ cost: 1800, inUse: '2025-03-10' }), SINGLE)

    expect(bookValueOn(schedule, civil('2025-03-09')).amount).toBe(euros(0))
    expect(bookValueOn(schedule, civil('2025-03-10')).amount).toBe(euros(1800))
    expect(accumulatedDepreciationOn(schedule, civil('2025-12-30')).amount).toBe(euros(600))
    expect(accumulatedDepreciationOn(schedule, civil('2025-12-31')).amount).toBe(euros(675))
    expect(bookValueOn(schedule, civil('2025-12-31')).amount).toBe(euros(1125))
    expect(bookValueOn(schedule, civil('2030-01-01')).amount).toBe(euros(0))
  })

  it('allows a car above the cost cap only the share of depreciation on the capped cost', () => {
    // 60,000.00 at 20% from January 2026 is 12,000.00 a year. 54,000 / 60,000 of it is 10,800.00.
    const car = depreciationSchedule(asset({ cost: 60000, group: 'car', inUse: '2025-12-05' }), SINGLE)
    const smallCar = depreciationSchedule(asset({ cost: 30000, group: 'car', inUse: '2025-12-05' }), SINGLE)

    const first = car.years[0]!
    expect(first.year).toBe(2026)
    expect(first.charge.amount).toBe(euros(12000))
    expect(first.deductible.amount).toBe(euros(10800))
    expect(ruleIdsOf(first.deductible)).toContain('hr.cit.car-depreciation-cap')
    expect(sumMoney(car.months.map((entry) => entry.charge))).toBe(euros(60000))

    expect(smallCar.years[0]?.deductible.amount).toBe(smallCar.years[0]?.charge.amount)
  })
})
