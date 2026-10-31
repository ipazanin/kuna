import type { Category } from '../../../workbook/domain/workbook'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import type { PackRole } from '../domain/packRoles'
import { words } from './words'

/** The roles the accrual view reads, and what it gets wrong without them. */
const ACCRUAL_ROLES: readonly (readonly [PackRole, string])[] = [
  [PACK_ROLES.revenue, words.accrualLeftOut.revenue],
  [PACK_ROLES.grant, words.accrualLeftOut.grant],
  [PACK_ROLES.capitalPurchase, words.accrualLeftOut.capitalPurchase],
  [PACK_ROLES.arrears, words.accrualLeftOut.arrears],
  [PACK_ROLES.prepaidAnnual, words.accrualLeftOut.prepaidAnnual],
  [PACK_ROLES.vatSettlement, words.accrualLeftOut.vatSettlement],
  [PACK_ROLES.corporateIncomeTax, words.accrualLeftOut.corporateIncomeTax],
  [PACK_ROLES.profitDistribution, words.accrualLeftOut.profitDistribution],
  [PACK_ROLES.representation, words.accrualLeftOut.representation],
  [PACK_ROLES.personalTransport, words.accrualLeftOut.personalTransport],
  [PACK_ROLES.nonDeductible, words.accrualLeftOut.nonDeductible],
]

export function missingAccrualRoles(categories: readonly Category[]): { readonly role: PackRole; readonly leftOut: string }[] {
  return ACCRUAL_ROLES.filter(([role]) => categoriesWithRole(categories, role).length === 0).map(([role, leftOut]) => ({ role, leftOut }))
}
