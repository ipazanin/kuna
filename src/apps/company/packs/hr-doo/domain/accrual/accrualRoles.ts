import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import type { Category } from '../../../../workbook/domain/workbook'

/** The roles the accrual view reads. */
export const ACCRUAL_ROLES = [
  PACK_ROLES.revenue,
  PACK_ROLES.grant,
  PACK_ROLES.capitalPurchase,
  PACK_ROLES.arrears,
  PACK_ROLES.prepaidAnnual,
  PACK_ROLES.vatSettlement,
  PACK_ROLES.corporateIncomeTax,
  PACK_ROLES.profitDistribution,
  PACK_ROLES.representation,
  PACK_ROLES.personalTransport,
  PACK_ROLES.nonDeductible,
] as const

export type AccrualRole = (typeof ACCRUAL_ROLES)[number]

export function missingAccrualRoles(categories: readonly Category[]): AccrualRole[] {
  return ACCRUAL_ROLES.filter((role) => categoriesWithRole(categories, role).length === 0)
}
