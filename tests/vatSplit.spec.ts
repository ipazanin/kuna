import { describe, expect, it } from 'vitest'

import type { Booking, Category } from '../src/apps/company/workbook/domain/workbook'
import { VAT_TREATMENTS } from '../src/apps/company/workbook/domain/vatTreatment'
import type { VatTreatment } from '../src/apps/company/workbook/domain/vatTreatment'
import { vatSplit } from '../src/apps/company/packs/hr-doo/domain/vat/vatSplit'
import type { VatSplit } from '../src/apps/company/packs/hr-doo/domain/vat/vatSplit'
import { ownerShareOf } from '../src/apps/company/owner-share/domain/ownerShare'
import { addMoney, sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'

function category(vat: VatTreatment): Category {
  return { slug: 'office-supplies', family: 'operating', bucket: 'operating', colour: BUCKET_COLOUR, roles: [], vat, ownerShare: null }
}

function booking(amount: number, date = '2026-03-10'): Booking {
  return { date: civil(date), amount: euros(amount), category: 'office-supplies', family: 'operating', bucket: 'operating' }
}

function split(amount: number, vat: VatTreatment, date?: string, ownerShare: number | null = null): VatSplit {
  return vatSplit(booking(amount, date), category(vat), ownerShare === null ? null : ownerShareOf(ownerShare))
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
    expect(result.kept.amount).toBe(euros(-6.25))
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

  it.each(['none', 'reverse-charge', 'foreign-vat', 'representation', 'deductible-25'] as const)('keeps no split-out VAT in the cost for %s with no share', (treatment) => {
    expect(split(-80.4, treatment).kept.amount).toBe(euros(0))
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

    expect(() => vatSplit(other, category('deductible-25'), null)).toThrow(RangeError)
  })
})

describe('vatSplit with an owner share', () => {
  it('deducts the VAT on the business share only and keeps the private share in the cost', () => {
    // 125.00 holds 25.00 of VAT. At a 50% owner share 12.50 is deductible and 12.50 stays in the cost of 112.50.
    const result = split(-125, 'deductible-25', undefined, 50)

    expect(result.inputVat.amount).toBe(euros(-12.5))
    expect(result.cost.amount).toBe(euros(-112.5))
    expect(result.inputVat.steps.map((step) => step.amount)).toEqual([euros(-25), euros(12.5)])
    expect(ruleIds(result.inputVat)).toEqual(['hr.vat.rates', 'hr.vat.input-deduction'])
  })

  it("gives the law doc's laptop its figures", () => {
    // 1,250.00 holds 250.00 of VAT. The owner's 30% is 75.00, so 175.00 is deductible and the cost is 1,075.00.
    const result = split(-1250, 'deductible-25', undefined, 30)

    expect(result.inputVat.amount).toBe(euros(-175))
    expect(result.cost.amount).toBe(euros(-1075))
    expect(result.kept.amount).toBe(euros(-75))
  })

  it('self-charges the VAT on a reverse-charged service in full and deducts only the business share', () => {
    // 25.00 is self-charged on 100.00 and 12.50 deducted, so the company owes 12.50 and the cost is 112.50.
    const result = split(-100, 'reverse-charge', undefined, 50)

    expect(result.cost.amount).toBe(euros(-112.5))
    expect(result.inputVat.amount).toBe(euros(12.5))
    expect(result.kept.amount).toBe(euros(-12.5))
    expect(result.cost.steps.map((step) => step.amount)).toEqual([euros(-100), euros(-12.5)])
    expect(result.cost.steps[1]!.steps.map((step) => step.amount)).toEqual([euros(-25)])
    expect(ruleIds(result.cost)).toEqual(['hr.vat.input-deduction'])
    expect(ruleIds(result.cost.steps[1]!.steps[0]!)).toEqual(['hr.vat.rates', 'hr.vat.reverse-charge'])
  })

  it('gives a reverse-charged refund its private VAT back', () => {
    const result = split(100, 'reverse-charge', undefined, 50)

    expect(result.cost.amount).toBe(euros(112.5))
    expect(result.inputVat.amount).toBe(euros(-12.5))
  })

  it('keeps half the VAT of a personal car whatever its owner share, and none when it is used only privately', () => {
    expect(split(-62.5, 'car-50', undefined, 80)).toEqual(split(-62.5, 'car-50'))

    const onlyPrivate = split(-62.5, 'car-50', undefined, 100)

    expect(onlyPrivate.inputVat.amount).toBe(euros(0))
    expect(onlyPrivate.cost.amount).toBe(euros(-62.5))
    expect(onlyPrivate.kept.amount).toBe(euros(-12.5))
    expect(ruleIds(onlyPrivate.cost)).toEqual(['hr.vat.rates', 'hr.vat.input-deduction'])
  })

  it.each(['none', 'foreign-vat', 'representation'] as const)('changes nothing for %s, which has no deductible VAT', (treatment) => {
    expect(split(-80.4, treatment, undefined, 50)).toEqual(split(-80.4, treatment))
  })

  it.each(VAT_TREATMENTS)('splits %s at a share of 0 as with no share', (treatment) => {
    expect(split(-80.4, treatment, undefined, 0)).toEqual(split(-80.4, treatment))
  })

  it.each(VAT_TREATMENTS)('adds cost and input VAT back to the amount for %s at a 37% share', (treatment) => {
    const result = split(-37.77, treatment, undefined, 37)

    expect(addMoney(result.cost.amount, result.inputVat.amount)).toBe(euros(-37.77))
    expect(sumMoney(result.cost.steps.map((step) => step.amount))).toBe(result.cost.amount)
  })
})
