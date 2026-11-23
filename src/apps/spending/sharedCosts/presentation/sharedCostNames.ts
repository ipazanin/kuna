import { words } from './words'
import { openSharedCosts } from '../domain/openSharedCosts'
import type { Category } from '../../workbook/domain/category'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How a shared cost reads: who it counts under, or its category while it names nobody. */
export function sharedCostName(sharedCost: SharedCost, categories: readonly Pick<Category, 'id' | 'name'>[]): string {
  return sharedCost.payee.trim() || (categories.find((category) => category.id === sharedCost.category)?.name ?? words.dialog.title)
}

/** The shared costs a picker offers a part, as `openSharedCosts` gives them, each with its name. */
export function sharedCostOffers(
  book: { readonly sharedCosts: readonly SharedCost[]; readonly categories: readonly Pick<Category, 'id' | 'name'>[] } | null,
  own: readonly (RecordId | null)[] = [],
): { readonly sharedCost: SharedCost; readonly name: string }[] {
  return book === null ? [] : openSharedCosts(book.sharedCosts, own).map((sharedCost) => ({ sharedCost, name: sharedCostName(sharedCost, book.categories) }))
}

/** Each shared cost's name by its id, which a part in one reads beside its category. */
export function sharedCostHomes(book: { readonly sharedCosts: readonly SharedCost[]; readonly categories: readonly Pick<Category, 'id' | 'name'>[] } | null): ReadonlyMap<RecordId, string> {
  return new Map((book?.sharedCosts ?? []).map((sharedCost) => [sharedCost.id, sharedCostName(sharedCost, book!.categories)]))
}
