import type { CategoryClass } from '../../../../workbook/domain/packPart'
import { TAX_CLASSES } from './taxClasses'
import type { TaxClass } from './taxClasses'

/** The classes a category may carry, one for each role that carries one. */
export const CATEGORY_CLASSES: readonly CategoryClass[] = TAX_CLASSES.flatMap((taxClass) => taxClass.roles.map((role) => ({ role, vat: taxClass.vat, buckets: taxClass.buckets })))

/** The class a role carries, or null for a modifier or a role no class has. */
export function taxClassOf(role: string): TaxClass | null {
  return TAX_CLASSES.find((taxClass) => taxClass.roles.includes(role)) ?? null
}
