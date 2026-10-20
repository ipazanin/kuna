import type { DefinedBucket } from '../../../features/workbook/domain/bucket'
import type { Category } from '../../../features/workbook/domain/workbook'

/** The category roles the pack selects by, as the `roles` column of `categories` spells them. */
export const PACK_ROLES = {
  revenue: 'revenue',
  ownerLoanOut: 'owner-loan-out',
  ownerLoanRepaid: 'owner-loan-repaid',
  ownerPayTax: 'owner-pay-tax',
  reimbursement: 'reimbursement',
  watched: 'watched',
  /** Paid in the month after the work, such as salary, its taxes and rent. */
  arrears: 'arrears',
  representation: 'representation',
  personalTransport: 'personal-transport',
  /** A purchase kept as an asset on the assets tab. */
  capitalPurchase: 'capital-purchase',
  grant: 'grant',
  profitDistribution: 'profit-distribution',
  corporateIncomeTax: 'corporate-income-tax',
  /** VAT paid to the state or refunded by it. */
  vatSettlement: 'vat-settlement',
  /** Paid once for a year ahead, such as an annual insurance policy. */
  prepaidAnnual: 'prepaid-annual',
  /** A cost the corporate tax never allows, such as a fine or a private cost. */
  nonDeductible: 'non-deductible',
} as const

export type PackRole = (typeof PACK_ROLES)[keyof typeof PACK_ROLES]

/** The slugs of the categories that carry a role, in the order the tab lists them. */
export function categoriesWithRole(categories: readonly Category[], role: PackRole): string[] {
  return categories.filter((category) => category.roles.includes(role)).map((category) => category.slug)
}

/** The slugs of the categories in a bucket, in the order the tab lists them. */
export function categoriesInBucket(categories: readonly Category[], bucket: DefinedBucket): string[] {
  return categories.filter((category) => category.bucket === bucket).map((category) => category.slug)
}

/** A cost of paying the owner: the owner-pay bucket, and the taxes owed because the owner was paid. */
export function isOwnerPayCost(category: Category): boolean {
  return category.bucket === 'owner-pay' || (category.bucket === 'taxes' && category.roles.includes(PACK_ROLES.ownerPayTax))
}
