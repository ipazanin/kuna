import { describe, expect, it } from 'vitest'

import { vatPeriods } from '../src/packs/hr-doo/domain/accountant/vatReconciliation'
import type { FiledVatPeriod, VatPeriod } from '../src/packs/hr-doo/domain/accountant/vatReconciliation'
import type { VatReturn, VatSale } from '../src/packs/hr-doo/domain/accountant/vatReturn'
import { vatReturnRows } from '../src/packs/hr-doo/presentation/taxes/accountantView'
import { ZERO } from '../src/shared/money/money'
import { month } from './fixtures/accountantWorkbooks'
import { exampleStudio } from './fixtures/exampleStudio'
import { civil, euros } from './fixtures/ledger'

/** A return with only what the checks read: its carry, its sales lines and the overpayment it brings forward. */
function vatReturn(period: string, carriedForward: number, sales: readonly VatSale[] = [], broughtForward = 0): VatReturn {
  const nothing = { base: ZERO, vat: ZERO }
  return {
    period: month(period),
    salesOutsideEu: sales,
    localSales: nothing,
    localPurchases: nothing,
    euGoods: nothing,
    euServices: nothing,
    thirdCountryServices: nothing,
    outputVat: ZERO,
    inputVat: ZERO,
    difference: ZERO,
    broughtForward: euros(broughtForward),
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
  it('closes the carry less the refund the return claims, and the next one with the refund counted as booked', () => {
    // Input VAT through July: 600.00 on the laptop, 50.00 on the desk, 25.00 on software, 10.00 on
    // the owner's software and 6.25 on the car costs, 691.25. July brings forward none of June's
    // 500.00, so it claims 500.00 back and carries forward 191.25. The refund lands on 20 August,
    // which takes August's position to 191.25 as booked.
    const returns = [vatReturn('2025-06', -500), vatReturn('2025-07', -191.25), vatReturn('2025-08', -191.25, [], -191.25)]
    const [july, august] = periods(returns, ['2025-07', '2025-08'])
    expect(filed(july).ourCarry.amount).toBe(euros(691.25))
    expect(filed(july).refund).toEqual({ amount: euros(500), receivedOn: civil('2025-08-20') })
    expect(filed(august).ourCarry.amount).toBe(euros(191.25))
    expect(filed(august).refund).toBeNull()
    expect([filed(july).carryHolds, filed(august).carryHolds]).toEqual([true, true])
  })

  it('closes the carry on a refund claimed and not received yet', () => {
    // 691.25 less the 600.00 claimed, which no bank row brought, is the 91.25 carried forward.
    const [july] = periods([vatReturn('2025-06', -600), vatReturn('2025-07', -91.25)], ['2025-07'])
    expect(filed(july).refund).toEqual({ amount: euros(600), receivedOn: null })
    expect(filed(july).carryHolds).toBe(true)
  })

  it('keeps a carry that differs beyond the refund claimed as differing', () => {
    const [july] = periods([vatReturn('2025-06', -500), vatReturn('2025-07', -133.25)], ['2025-07'])
    expect(filed(july).refund?.receivedOn).toBe(civil('2025-08-20'))
    expect(filed(july).carryHolds).toBe(false)
  })

  it('does not take a refund row more than three months after the return as the one it claims', () => {
    const [april] = periods([vatReturn('2025-03', -500), vatReturn('2025-04', 0)], ['2025-04'])
    expect(filed(april).refund).toEqual({ amount: euros(500), receivedOn: null })
  })

  it('claims no refund without the previous month\'s return or when it brings all of it forward', () => {
    const [june, august] = periods([vatReturn('2025-06', -685), vatReturn('2025-07', -691.25, [], -685), vatReturn('2025-08', -191.25, [], -691.25)], ['2025-06', '2025-08'])
    expect([filed(june).refund, filed(august).refund]).toEqual([null, null])
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

describe('vatReturnRows', () => {
  it('says the refund a return claims beside a carry that closes, and whether the bank received it', () => {
    const returns = [vatReturn('2025-06', -500), vatReturn('2025-07', -191.25), vatReturn('2025-08', -91.25, [], -191.25), vatReturn('2025-09', -91.25)]
    const documents = { vatReturns: returns, salaries: [], unread: [], filedVatPeriods: returns.map((filedReturn) => filedReturn.period) }
    // September brings forward none of August's 91.25 and no bank row of that amount followed. The
    // books hold 191.25 after the 500.00 refund, and 191.25 less 91.25 is not the 91.25 carried.
    const rows = vatReturnRows(exampleStudio(), documents, 2025, () => null)
    expect(rows.filter((row) => row.key === '2025-07' || row.key === '2025-09').map((row) => [row.key, row.badges[0]?.label, row.notes])).toEqual([
      ['2025-09', 'Carry differs', ['Refund of €91.25 claimed, not received yet.']],
      ['2025-07', 'Carry ok', ['Refund of €500.00 claimed, received 20 Aug 2025.']],
    ])
  })
})
