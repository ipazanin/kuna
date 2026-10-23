import { describe, expect, it } from 'vitest'

import type { Booking, Category } from '../src/features/workbook/domain/workbook'
import { serviceMonthOf } from '../src/packs/hr-doo/domain/accrual/serviceMonth'
import { civil, euros } from './fixtures/ledger'
import { COMPANY_FACT_SETTINGS } from '../src/packs/hr-doo/domain/companyFacts'
import type { CompanyFacts } from '../src/packs/hr-doo/domain/companyFacts'
import { BUCKET_COLOUR } from '../src/features/workbook/domain/categoryColour'

function category(slug: string, roles: readonly string[] = []): Category {
  return { slug, family: 'operating', bucket: 'operating', colour: BUCKET_COLOUR, roles, vat: 'none' }
}

const CATEGORIES: readonly Category[] = [category('salary-net', ['arrears']), category('rent-owner', ['arrears']), category('software-subscriptions')]

function booking(date: string, amount: number, categorySlug: string): Booking {
  return { date: civil(date), amount: euros(amount), category: categorySlug, family: 'operating', bucket: 'operating' }
}

function registeredOn(date: string | null): CompanyFacts {
  return { ...COMPANY_FACT_SETTINGS.defaults, companyRegistered: date === null ? null : civil(date) }
}

describe('serviceMonthOf', () => {
  it('moves a salary paid in January back to the December worked', () => {
    expect(serviceMonthOf(booking('2026-01-14', -900, 'salary-net'), CATEGORIES, registeredOn(null))).toBe('2025-12')
  })

  it('keeps a row without the arrears role in the month it was paid', () => {
    expect(serviceMonthOf(booking('2026-01-14', -20, 'software-subscriptions'), CATEGORIES, registeredOn(null))).toBe('2026-01')
    expect(serviceMonthOf(booking('2026-01-14', -20, ''), CATEGORIES, registeredOn(null))).toBe('2026-01')
  })

  it('never moves a row to a month before the company was registered', () => {
    const settings = registeredOn('2025-05-12')

    expect(serviceMonthOf(booking('2025-05-31', -200, 'rent-owner'), CATEGORIES, settings)).toBe('2025-05')
    expect(serviceMonthOf(booking('2025-06-10', -200, 'rent-owner'), CATEGORIES, settings)).toBe('2025-05')
  })
})
