import { categoryTree, groupOf } from '../domain/categoryTree'
import type { Category } from '../../workbook/domain/category'
import { swatchOf, swatchToken } from '../../../../shared/charts/swatches'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The eight chart slots, which groups without a swatch of their own take in their order. */
const SLOTS = 8

/**
 * The colour token each category is drawn in: its own swatch, else its group's. A group without a swatch takes the next
 * chart slot no group's swatch took, in the order of the groups, so a month without a group's rows never repaints the
 * others, and once the slots run out it wears the recessive grey.
 */
export function categoryColours(categories: readonly Category[]): (category: Category) => string {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const groups = categoryTree(categories, ['spending', 'income', 'saving', 'transfer', 'company']).map((entry) => entry.group)
  const taken = new Set(groups.flatMap((group) => swatchOf(group.colour)?.slot ?? []))
  const free = Array.from({ length: SLOTS }, (_, place) => place + 1).filter((slot) => !taken.has(slot))
  const groupTokens = new Map<RecordId, string>()
  for (const group of groups) {
    const swatch = swatchOf(group.colour)
    groupTokens.set(group.id, swatch === null ? (free.length > 0 ? `--series-${free.shift()}` : '--chart-deemphasis') : swatchToken(swatch))
  }
  return (category) => {
    const own = swatchOf(category.colour)
    return own === null ? (groupTokens.get(groupOf(category, byId).id) ?? '--chart-deemphasis') : swatchToken(own)
  }
}
