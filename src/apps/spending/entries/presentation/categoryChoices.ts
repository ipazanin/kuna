import { categoryTree, fixedCategories } from '../../categories/domain/categoryTree'
import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { PickedFiling } from '../../sharedCosts/application/sharedCostWrites'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { words } from '../../sharedCosts/presentation/words'

/** A row of a category list: a heading over a group's children, of type label with no value, or a category to pick. */
export interface CategoryChoice {
  readonly label: string
  readonly value?: string
  readonly type?: 'label'
  readonly description?: string
}

/** Which way the money of an entry went. */
export type EntrySide = 'out' | 'in'

/** What else an entry's category list offers besides its spending and income categories. */
export interface ChoiceOptions {
  /** Between my accounts, which a list offers only an entry that has it unless this is set. */
  readonly withTransfer?: boolean
  /** False leaves out every fixed category, as a shared cost's list does, since a shared cost counts under spending or income alone. */
  readonly withFixed?: boolean
  /** The shared costs to offer as a group of their own, as `openSharedCosts` gives them, each by its name. */
  readonly sharedCosts?: readonly { readonly sharedCost: SharedCost; readonly name: string }[]
}

/**
 * The categories an entry can be filed under, one list per group: the children of each spending group for money out, or
 * of each income group and then each spending group for money in, where it is a refund, under the group's name, a group
 * without children as itself, then the fixed categories unless `withFixed` is false, Between my accounts for an entry that has
 * it or with `withTransfer`, and the shared costs given under their own heading. In a shared cost is never a bare choice, since
 * only joining a shared cost files there, so a part already in one finds it among the shared costs, or as itself in a list that
 * offers none. Hidden categories, and the children of a hidden group, are left out but for the one the entry already has.
 */
export function entryCategoryChoices(
  categories: readonly Category[],
  side: EntrySide,
  own: RecordId | null,
  { withTransfer = false, withFixed = true, sharedCosts }: ChoiceOptions = {},
): CategoryChoice[][] {
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
  const fixed = fixedCategories(categories).filter(
    (category) =>
      withFixed && (category.kind !== 'shared-cost' || (category.id === own && sharedCosts === undefined)) && (!isTransferCategory(category) || withTransfer || category.id === own) && shown(category),
  )
  const shared = (sharedCosts ?? []).map(({ sharedCost, name }) => ({ label: name, value: sharedCost.id as string, description: dayLabel(sharedCost.day) }))
  return [...groups, ...(fixed.length === 0 ? [] : [fixed.map(choice)]), ...(shared.length === 0 ? [] : [[{ type: 'label' as const, label: words.sharedCosts }, ...shared]])]
}

/** A choice of `entryCategoryChoices` read back as the category or the shared cost it names, or null for neither. */
export function pickedFilingOf(value: string, categories: readonly Pick<Category, 'id'>[], sharedCosts: readonly Pick<SharedCost, 'id'>[]): PickedFiling | null {
  const sharedCost = sharedCosts.find((candidate) => candidate.id === value)
  if (sharedCost !== undefined) return { sharedCost: sharedCost.id }
  const category = categories.find((candidate) => candidate.id === value)
  return category === undefined ? null : { category: category.id }
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
