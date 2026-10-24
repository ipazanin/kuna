import { ownerShareOf } from '../../src/features/owner-share/domain/ownerShare'
import type { OwnerShare } from '../../src/features/owner-share/domain/ownerShare'
import { benefitCategoryOf } from '../../src/features/owner-share/domain/ownerParts'
import { BUCKET_COLOUR } from '../../src/features/workbook/domain/categoryColour'
import type { DefinedBucket } from '../../src/features/workbook/domain/bucket'
import type { Category, Transaction, Workbook } from '../../src/features/workbook/domain/workbook'
import { exampleStudio } from './exampleStudio'
import { withPackBuckets } from './hrDooCategories'
import { ledger, windowOf } from './ledger'
import type { RowSpec } from './ledger'

export const share = (percent: number): OwnerShare => ownerShareOf(percent)!

export function category(slug: string, bucket: DefinedBucket, roles: readonly string[] = [], ownerShare: OwnerShare | null = null): Category {
  return { slug, family: bucket, bucket, colour: BUCKET_COLOUR, roles, vat: 'none', ownerShare }
}

/** A made-up company's categories, with AI services at a 50% default and one category for the owner's parts. */
export const CATEGORIES: readonly Category[] = [
  category('revenue', 'income', ['revenue']),
  category('other-costs', 'operating'),
  category('equipment', 'operating'),
  category('ai-services', 'operating', [], share(50)),
  category('salary-net', 'owner-pay'),
  category('payroll-tax', 'taxes', ['owner-pay-tax']),
  category('corporate-income-tax', 'taxes'),
  category('benefits', 'owner-pay', ['owner-benefit']),
]
export const BENEFIT = benefitCategoryOf(CATEGORIES)!

/** The rows given, in that order, in these categories, each with the share given or its category's default. */
export function rows(specs: readonly (RowSpec & { readonly share?: number })[]): Transaction[] {
  const shares = new Map(specs.map((spec, position) => [`REF-${position + 1}`, spec.share]))
  return withPackBuckets(ledger(specs), CATEGORIES)
    .map((row) => {
      const own = shares.get(row.reference)
      return { ...row, ownerShare: own === undefined ? (CATEGORIES.find((candidate) => candidate.slug === row.category)?.ownerShare ?? null) : share(own) }
    })
    .reverse()
}

export function workbookOf(transactions: readonly Transaction[], changes: Partial<Workbook> = {}): Workbook {
  return exampleStudio({ categories: CATEGORIES, transactions, ownerAdvances: [], invoices: [], assets: [], grants: [], ...changes })
}

/**
 * Made-up 2026, VAT aside: revenue 50,000, other operating costs 8,000, a laptop of 2,000 on 15 March
 * set to 30% (equipment has no default), twelve AI consultations of 100 at the 50% default, owner pay
 * 20,000, the taxes on that pay 5,000 and corporate tax advances 1,000. The shares come to 1,200.
 */
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
export const EXAMPLE = rows([
  { date: '2026-01-05', amount: 50000, category: 'revenue' },
  { date: '2026-01-10', amount: -8000, category: 'other-costs' },
  { date: '2026-03-15', amount: -2000, category: 'equipment', share: 30 },
  ...MONTHS.map((month) => ({ date: `2026-${month}-20`, amount: -100, category: 'ai-services' })),
  { date: '2026-12-28', amount: -20000, category: 'salary-net' },
  { date: '2026-12-28', amount: -5000, category: 'payroll-tax' },
  { date: '2026-12-29', amount: -1000, category: 'corporate-income-tax' },
])
export const YEAR = { preset: 'year', year: 2026 } as const
export const WINDOW = windowOf('2026-01-05', '2026-12-29')
