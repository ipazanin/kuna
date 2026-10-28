import type { Category } from '../../../workbook/domain/workbook'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import type { PackRole } from '../domain/packRoles'

/** The roles the accrual view reads, and what it gets wrong without them. */
const ACCRUAL_ROLES: readonly (readonly [PackRole, string])[] = [
  [PACK_ROLES.revenue, 'client payments stay in profit beside the revenue the invoices deliver'],
  [PACK_ROLES.grant, 'a grant counts as income when it arrives, beside its release'],
  [PACK_ROLES.capitalPurchase, 'an asset finds its payment only by its ledger_reference, and an unclaimed purchase counts as a cost'],
  [PACK_ROLES.arrears, 'salary, its taxes and rent count in the month they were paid'],
  [PACK_ROLES.prepaidAnnual, 'a policy paid a year ahead counts in the month it was paid'],
  [PACK_ROLES.vatSettlement, 'VAT paid to the state or refunded counts in profit'],
  [PACK_ROLES.corporateIncomeTax, 'corporate tax paid counts as a cost beside the tax of the year'],
  [PACK_ROLES.profitDistribution, 'dividends and their tax count as costs'],
  [PACK_ROLES.representation, 'no representation is added back to the tax base'],
  [PACK_ROLES.personalTransport, 'PD line 7 adds back no personal transport'],
  [PACK_ROLES.nonDeductible, 'PD lines 9, 11 and 24 add back no fine or private cost'],
]

export function missingAccrualRoles(categories: readonly Category[]): { readonly role: PackRole; readonly leftOut: string }[] {
  return ACCRUAL_ROLES.filter(([role]) => categoriesWithRole(categories, role).length === 0).map(([role, leftOut]) => ({ role, leftOut }))
}
