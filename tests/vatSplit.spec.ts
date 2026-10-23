import { describe, expect, it } from 'vitest'

import type { Booking, Category } from '../src/features/workbook/domain/workbook'
import { VAT_TREATMENTS } from '../src/features/workbook/domain/vatTreatment'
import type { VatTreatment } from '../src/features/workbook/domain/vatTreatment'
import { vatSplit } from '../src/packs/hr-doo/domain/vat/vatSplit'
import type { VatSplit } from '../src/packs/hr-doo/domain/vat/vatSplit'
import { addMoney, sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { BUCKET_COLOUR } from '../src/features/workbook/domain/categoryColour'

function category(vat: VatTreatment): Category {
  return { slug: 'office-supplies', family: 'operating', bucket: 'operating', colour: BUCKET_COLOUR, roles: [], vat }
}

function booking(amount: number, date = '2026-03-10'): Booking {
  return { date: civil(date), amount: euros(amount), category: 'office-supplies', family: 'operating', bucket: 'operating' }
}

function split(amount: number, vat: VatTreatment, date?: string): VatSplit {
  return vatSplit(booking(amount, date), category(vat))
}

function ruleIds(figure: VatSplit['cost']): string[] {
  return figure.rules.map((citation) => citation.ruleId)
}

describe('vatSplit', () => {
  it('takes Croatian VAT at 25% out of the cost as input VAT', () => {
    const result = split(-125, 'deductible-25')

    expect(result.cost.amount).toBe(euros(-100))
    expect(result.inputVat.amount).toBe(euros(-25))
    expect(ruleIds(result.inputVat)).toEqual(['hr.vat.rates', 'hr.vat.input-deduction'])
    expect(ruleIds(result.cost)).toEqual(['hr.vat.rates', 'hr.vat.input-deduction'])
  })

  it('reads the reduced rates for the 13% and 5% treatments', () => {
    expect(split(-113, 'deductible-13').inputVat.amount).toBe(euros(-13))
    expect(split(-10.5, 'deductible-5').inputVat.amount).toBe(euros(-0.5))
  })

  it('rounds the VAT inside the amount to the cent and keeps the cost exact', () => {
    // 9.99 × 25 / 125 = 1.998, so the VAT is 2.00 and the cost the remaining 7.99.
    const result = split(-9.99, 'deductible-25')

    expect(result.inputVat.amount).toBe(euros(-2))
    expect(result.cost.amount).toBe(euros(-7.99))
  })

  it('keeps the non-deductible half of the VAT on a personal car in the cost', () => {
    // 62.50 holds 12.50 of VAT at 25%. Half of it, 6.25, is deductible, so the cost is 56.25.
    const result = split(-62.5, 'car-50')

    expect(result.inputVat.amount).toBe(euros(-6.25))
    expect(result.cost.amount).toBe(euros(-56.25))
    expect(result.inputVat.steps.map((step) => step.amount)).toEqual([euros(-12.5)])
  })

  it('splits a supplier refund the same way, with both parts positive', () => {
    const result = split(250, 'deductible-25')

    expect(result.cost.amount).toBe(euros(200))
    expect(result.inputVat.amount).toBe(euros(50))
  })

  it.each([
    ['none', []],
    ['reverse-charge', ['hr.vat.reverse-charge']],
    ['foreign-vat', ['hr.vat.reverse-charge']],
    ['representation', ['hr.vat.input-deduction']],
  ] as const)('passes a %s amount through whole as cost', (treatment, rules) => {
    const result = split(-80.4, treatment)

    expect(result.treatment).toBe(treatment)
    expect(result.cost.amount).toBe(euros(-80.4))
    expect(result.inputVat.amount).toBe(euros(0))
    expect(ruleIds(result.cost)).toEqual(rules)
  })

  it.each(VAT_TREATMENTS)('adds cost and input VAT back to the amount for %s', (treatment) => {
    const result = split(-37.77, treatment)

    expect(addMoney(result.cost.amount, result.inputVat.amount)).toBe(euros(-37.77))
    expect(sumMoney(result.cost.steps.map((step) => step.amount))).toBe(result.cost.amount)
  })

  it('reads the rules on the booking date', () => {
    const result = split(-125, 'deductible-25', '2025-07-01')

    expect(result.inputVat.rules.every((citation) => citation.validFrom <= civil('2025-07-01'))).toBe(true)
  })

  it('refuses a booking of another category', () => {
    const other: Booking = { ...booking(-10), category: 'travel' }

    expect(() => vatSplit(other, category('deductible-25'))).toThrow(RangeError)
  })
})
