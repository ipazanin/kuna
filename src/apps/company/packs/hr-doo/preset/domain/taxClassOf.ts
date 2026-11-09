import type { CategoryClass } from '../../../../workbook/domain/packPart'
import { PACK_ROLES } from '../../domain/packRoles'
import { TAX_CLASSES } from './taxClasses'
import type { TaxClass } from './taxClasses'

/** The role a class had before it was renamed, by the class that took its place. */
const REPLACED_ROLES: Readonly<Record<string, readonly string[]>> = {
  [PACK_ROLES.vehicleInsuranceInterestTaxAndFees]: ['vehicle-insurance-and-interest'],
}

/** The classes a category may carry, one for each role that carries one. */
export const CATEGORY_CLASSES: readonly CategoryClass[] = TAX_CLASSES.flatMap((taxClass) =>
  taxClass.roles.map((role) => ({ role, vat: taxClass.vat, buckets: taxClass.buckets, replaces: REPLACED_ROLES[role] ?? [] })),
)

/** The class a role carries, or null for a modifier or a role no class has. */
export function taxClassOf(role: string): TaxClass | null {
  return TAX_CLASSES.find((taxClass) => taxClass.roles.includes(role)) ?? null
}
