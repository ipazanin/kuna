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
