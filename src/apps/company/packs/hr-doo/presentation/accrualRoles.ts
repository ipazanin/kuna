import { missingAccrualRoles } from '../domain/accrual/accrualRoles'
import type { AccrualRole } from '../domain/accrual/accrualRoles'
import { PACK_ROLES } from '../domain/packRoles'
import type { PackRole } from '../domain/packRoles'
import type { Category } from '../../../workbook/domain/workbook'
import { words } from './words'

/** What the accrual view gets wrong without each role. */
const LEFT_OUT: Readonly<Record<AccrualRole, string>> = {
  [PACK_ROLES.revenue]: words.accrualLeftOut.revenue,
  [PACK_ROLES.grant]: words.accrualLeftOut.grant,
  [PACK_ROLES.capitalPurchase]: words.accrualLeftOut.capitalPurchase,
  [PACK_ROLES.arrears]: words.accrualLeftOut.arrears,
  [PACK_ROLES.prepaidAnnual]: words.accrualLeftOut.prepaidAnnual,
  [PACK_ROLES.vatSettlement]: words.accrualLeftOut.vatSettlement,
  [PACK_ROLES.corporateIncomeTax]: words.accrualLeftOut.corporateIncomeTax,
  [PACK_ROLES.profitDistribution]: words.accrualLeftOut.profitDistribution,
  [PACK_ROLES.representation]: words.accrualLeftOut.representation,
  [PACK_ROLES.personalTransport]: words.accrualLeftOut.personalTransport,
  [PACK_ROLES.nonDeductible]: words.accrualLeftOut.nonDeductible,
}

export function accrualRolesLeftOut(categories: readonly Category[]): { readonly role: PackRole; readonly leftOut: string }[] {
  return missingAccrualRoles(categories).map((role) => ({ role, leftOut: LEFT_OUT[role] }))
}
