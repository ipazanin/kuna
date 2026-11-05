import { categoryTree } from '../domain/categoryTree'
import type { Category } from '../../workbook/domain/category'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A category as it was and as it is to be written. */
export type CategoryChange = readonly [before: Category, after: Category]

/** The categories that sit beside one under the parent named, in their order: a group's children, or the groups of the kind. */
export function siblingsUnder(categories: readonly Category[], parent: RecordId | null, kind: Category['kind']): readonly Category[] {
  const tree = categoryTree(categories, [kind])
  return parent === null ? tree.map((entry) => entry.group) : (tree.find((entry) => entry.group.id === parent)?.children ?? [])
}

/** The order that puts a category last among the siblings. */
export function lastOrder(siblings: readonly Category[]): number {
  return Math.max(0, ...siblings.map((sibling) => sibling.order)) + 1
}

/**
 * The changes that swap the category at `place` with its neighbour a `step` away. Two siblings of one order sort by
 * name, so swapping their orders would move nothing, and then every sibling takes its new place as its order.
 */
export function swappedPlaces(siblings: readonly Category[], place: number, step: -1 | 1): CategoryChange[] {
  const moving = siblings[place]
  const neighbour = siblings[place + step]
  if (moving === undefined || neighbour === undefined) return []
  if (moving.order !== neighbour.order) {
    return [
      [moving, { ...moving, order: neighbour.order }],
      [neighbour, { ...neighbour, order: moving.order }],
    ]
  }
  const reordered = siblings.map((sibling, index) => (index === place ? neighbour : index === place + step ? moving : sibling))
  return reordered.flatMap((sibling, index): CategoryChange[] => (sibling.order === index + 1 ? [] : [[sibling, { ...sibling, order: index + 1 }]]))
}
