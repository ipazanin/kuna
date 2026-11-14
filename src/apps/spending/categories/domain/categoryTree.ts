import type { Category, CategoryKind } from '../../workbook/domain/category'
import { isFixedKind } from '../../workbook/domain/category'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A group with its children, each in their order. */
export interface CategoryGroup {
  readonly group: Category
  readonly children: readonly Category[]
}

function byOrder(left: Category, right: Category): number {
  return left.order - right.order || left.name.localeCompare(right.name)
}

/** The groups of the kinds asked for, each with its children, in their order. The fixed categories come apart, with no children. */
export function categoryTree(categories: readonly Category[], kinds: readonly CategoryKind[]): CategoryGroup[] {
  return categories
    .filter((category) => category.parent === null && kinds.includes(category.kind))
    .sort(byOrder)
    .map((group) => ({ group, children: categories.filter((child) => child.parent === group.id).sort(byOrder) }))
}

/** The fixed categories, Between my accounts, Saved to investments, For the company and Loan principal, in the order of the file. */
export function fixedCategories(categories: readonly Category[]): Category[] {
  return categories.filter((category) => isFixedKind(category.kind))
}

/** The group a category counts in: its parent, or itself. */
export function groupOf(category: Category, categories: ReadonlyMap<RecordId, Category>): Category {
  return category.parent === null ? category : (categories.get(category.parent) ?? category)
}
