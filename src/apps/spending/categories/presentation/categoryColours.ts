import { categoryTree, groupOf } from '../domain/categoryTree'
import { CATEGORY_KINDS } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import { SWATCHES, slotsTakenBy, swatchOf } from '../../../../shared/charts/swatches'
import type { Swatch } from '../../../../shared/charts/swatches'
import { paintToken } from '../../../../shared/charts/ownColours'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * The swatch each group wears: its own, else the next chart slot no group's swatch took or looks like, in the order of
 * the groups, so a month without a group's rows never repaints the others. Once the slots run out a group wears none and is grey.
 */
export function groupSwatches(categories: readonly Category[]): ReadonlyMap<RecordId, Swatch | null> {
  const groups = categoryTree(categories, CATEGORY_KINDS).map((entry) => entry.group)
  const taken = new Set(
    groups.flatMap((group) => {
      const swatch = swatchOf(group.colour)
      return swatch === null ? [] : slotsTakenBy(swatch)
    }),
  )
  const free = SWATCHES.filter((swatch) => swatch.slot !== null && !taken.has(swatch.slot))
  return new Map(groups.map((group) => [group.id, swatchOf(group.colour) ?? free.shift() ?? null]))
}

/** The colour token each category is drawn in: its own swatch, else its group's, else the recessive grey. */
export function categoryColours(categories: readonly Category[]): (category: Category) => string {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const groups = groupSwatches(categories)
  return (category) => {
    const swatch = swatchOf(category.colour) ?? groups.get(groupOf(category, byId).id) ?? null
    return swatch === null ? '--chart-deemphasis' : paintToken(swatch)
  }
}
