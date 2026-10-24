import { describe, expect, it } from 'vitest'

import { vatPeriods } from '../src/packs/hr-doo/domain/accountant/vatReconciliation'
import type { FiledVatPeriod, VatPeriod } from '../src/packs/hr-doo/domain/accountant/vatReconciliation'
import type { VatReturn, VatSale } from '../src/packs/hr-doo/domain/accountant/vatReturn'
import { ZERO } from '../src/shared/money/money'
import { month } from './fixtures/accountantWorkbooks'
import { exampleStudio } from './fixtures/exampleStudio'
import { civil, euros } from './fixtures/ledger'

/** A return with only what the checks read: its carry and its sales lines. */
function vatReturn(period: string, carriedForward: number, sales: readonly VatSale[] = []): VatReturn {
  const nothing = { base: ZERO, vat: ZERO }
  return {
    period: month(period),
    salesOutsideEu: sales,
    localPurchases: nothing,
    euServices: nothing,
    thirdCountryServices: nothing,
    outputVat: ZERO,
    inputVat: ZERO,
    difference: ZERO,
    broughtForward: ZERO,
    carriedForward: euros(carriedForward),
  }
}

function sale(invoiceNumber: string, amount: number): VatSale {
  return { invoiceNumber, issued: civil('2026-01-15'), amount: euros(amount) }
}

function filed(period: VatPeriod | undefined): FiledVatPeriod {
  if (period?.kind !== 'filed') throw new Error('the period has no return')
  return period
}

function periods(returns: readonly VatReturn[], months: readonly string[]): VatPeriod[] {
  return vatPeriods(exampleStudio(), returns, months.map(month))
}

describe('vatPeriods', () => {
  it('closes the carry with the refund counted as booked, lowering what the state still owes', () => {
    // Input VAT through July: 600.00 on the laptop, 50.00 on the desk, 25.00 on software, 10.00 on
    // the owner's software and 6.25 on the car costs, 691.25. The 500.00 refunded in August as
    // booked takes it to 191.25, which the return carries forward as an overpayment.
    const [july, august] = periods([vatReturn('2025-07', -691.25), vatReturn('2025-08', -191.25)], ['2025-07', '2025-08'])
    expect(filed(july).ourCarry.amount).toBe(euros(691.25))
    expect(filed(august).ourCarry.amount).toBe(euros(191.25))
    expect([filed(july).carryHolds, filed(august).carryHolds]).toEqual([true, true])
  })

  it('does not close a carry that takes the refund the other way round', () => {
    const [august] = periods([vatReturn('2025-08', -1191.25)], ['2025-08'])
    expect(filed(august).theirCarry).toBe(euros(1191.25))
    expect(filed(august).carryHolds).toBe(false)
  })

  it('opens the rows it compared, VAT settlements included, to the end of the period', () => {
    const drill = filed(periods([vatReturn('2025-08', -191.25)], ['2025-08'])[0]).ourCarry.drill
    expect(drill?.filters.period).toEqual({ preset: 'custom', range: { from: civil('2025-03-05'), to: civil('2025-08-31') } })
    expect(drill?.filters.categories).toEqual(expect.arrayContaining(['equipment', 'software', 'car-costs', 'vat-refund']))
  })

  it('shows a month without a return as not filed, and still closes the next carry', () => {
    const [june, july, august] = periods([vatReturn('2025-06', -685), vatReturn('2025-08', -191.25)], ['2025-06', '2025-07', '2025-08'])
    expect(july).toEqual({ kind: 'not-filed', period: month('2025-07') })
    expect([filed(june).carryHolds, filed(august).carryHolds]).toEqual([true, true])
  })

  it('closes a sales line on the invoice delivered in the period, whatever month it was issued in', () => {
    // 1-1-26 was issued in January 2026 for work delivered from December 2025.
    const [december, january] = periods([vatReturn('2025-12', 0, [sale('1-1-26', 6200)]), vatReturn('2026-01', 0, [sale('1-1-26', 6200)])], ['2025-12', '2026-01'])
    expect(filed(december).sales.map((check) => check.problem)).toEqual([null])
    expect(filed(december).salesHold).toBe(true)
    expect(filed(january).sales.map((check) => check.problem)).toEqual(['delivered-in-another-month'])
  })

  it('names a sales line with another amount or without an invoice', () => {
    const [december] = periods([vatReturn('2025-12', 0, [sale('1-1-26', 6100), sale('4-2-26', 6200)])], ['2025-12'])
    expect(filed(december).sales.map((check) => [check.invoice?.number ?? null, check.problem])).toEqual([
      ['1-1-26', 'other-amount'],
      [null, 'no-invoice'],
    ])
    expect(filed(december).salesHold).toBe(false)
  })
})
