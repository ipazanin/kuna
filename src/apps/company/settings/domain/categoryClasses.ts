import { isDefinedBucket } from '../../workbook/domain/bucket'
import type { CategoryClass } from '../../workbook/domain/packPart'
import { isVatTreatment } from '../../workbook/domain/vatTreatment'

/** The fields a class constrains, as the categories tab stores them. A blank VAT is none. */
export interface ClassedFields {
  readonly roles: readonly string[]
  readonly vat: string
  readonly bucket: string
}

/** Why a category does not count one way: no class among its roles, more than one, or a VAT treatment or bucket its class does not allow. */
export type ClassFinding =
  | { readonly kind: 'unclassed' }
  | { readonly kind: 'classes'; readonly roles: readonly string[] }
  | { readonly kind: 'vat'; readonly taxClass: CategoryClass }
  | { readonly kind: 'bucket'; readonly taxClass: CategoryClass }

/** The class a category counts by, the first its roles carry, or null for one that carries none. */
export function classOf(roles: readonly string[], classes: readonly CategoryClass[]): CategoryClass | null {
  return carriedClasses(roles, classes)[0] ?? null
}

/**
 * What keeps the category from counting one way. A VAT treatment or bucket the app does not know is
 * reported on its own, so it is not checked against the class. Nothing is found while the pack has no classes.
 */
export function classFindings(category: ClassedFields, classes: readonly CategoryClass[]): ClassFinding[] {
  if (classes.length === 0) {
    return []
  }
  const carried = carriedClasses(category.roles, classes)
  const taxClass = carried[0]
  if (taxClass === undefined) {
    return [{ kind: 'unclassed' }]
  }
  const vat = category.vat === '' ? 'none' : category.vat
  return [
    ...(carried.length > 1 ? [{ kind: 'classes', roles: carried.map((carriedClass) => carriedClass.role) } as const] : []),
    ...(isVatTreatment(vat) && !taxClass.vat.includes(vat) ? [{ kind: 'vat', taxClass } as const] : []),
    ...(isDefinedBucket(category.bucket) && !taxClass.buckets.includes(category.bucket) ? [{ kind: 'bucket', taxClass } as const] : []),
  ]
}

/** Whether two states of a category agree in every field a class constrains, a blank VAT reading as none. */
export function sameClassedFields(first: ClassedFields, second: ClassedFields): boolean {
  return first.roles.join(',') === second.roles.join(',') && (first.vat || 'none') === (second.vat || 'none') && first.bucket === second.bucket
}

function carriedClasses(roles: readonly string[], classes: readonly CategoryClass[]): CategoryClass[] {
  return [...new Set(roles)].flatMap((role) => classes.filter((candidate) => candidate.role === role))
}
