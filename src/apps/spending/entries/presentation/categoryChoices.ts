import { categoryTree, fixedCategories } from '../../categories/domain/categoryTree'
import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A row of a category list: a heading over a group's children, of type label with no value, or a category to pick. */
export interface CategoryChoice {
  readonly label: string
  readonly value?: string
  readonly type?: 'label'
  readonly description?: string
}

/** Which way the money of an entry went. */
export type EntrySide = 'out' | 'in'

/**
 * The categories an entry can be filed under, one list per group: the children of each spending group for money out, or
 * of each income group and then each spending group for money in, where it is a refund, under the group's name, a group
 * without children as itself, then Saved to investments and For the company, and Between my accounts for an entry that
 * has it or with `withTransfer`. Hidden categories, and the children of a hidden group, are left out but for the one the entry already has.
 */
export function entryCategoryChoices(categories: readonly Category[], side: EntrySide, own: RecordId | null, withTransfer = false): CategoryChoice[][] {
  const shown = (category: Category): boolean => !category.hidden || category.id === own
  const choice = (category: Category): CategoryChoice => ({ label: category.name, value: category.id })
  const kinds = side === 'out' ? (['spending'] as const) : (['income', 'spending'] as const)
  const groups = kinds.flatMap((kind) =>
    categoryTree(categories, [kind]).flatMap(({ group, children }) => {
      if (children.length === 0) return shown(group) ? [[choice(group)]] : []
      const picked = children.filter((child) => child.id === own || (shown(child) && !group.hidden))
      return picked.length === 0 ? [] : [[{ type: 'label' as const, label: group.name }, ...picked.map(choice)]]
    }),
  )
  const fixed = fixedCategories(categories).filter((category) => (!isTransferCategory(category) || withTransfer || category.id === own) && shown(category))
  return [...groups, ...(fixed.length === 0 ? [] : [fixed.map(choice)])]
}

/** Every category to filter entries by, hidden ones too since their entries keep counting: each group then its children, which name it, then the fixed ones. */
export function filterCategoryChoices(categories: readonly Category[]): CategoryChoice[][] {
  const groups = categoryTree(categories, ['spending', 'income']).map(({ group, children }) => [
    { label: group.name, value: group.id },
    ...children.map((child) => ({ label: child.name, value: child.id, description: group.name })),
  ])
  const fixed = fixedCategories(categories).map((category) => ({ label: category.name, value: category.id }))
  return [...groups, ...(fixed.length === 0 ? [] : [fixed])]
}
