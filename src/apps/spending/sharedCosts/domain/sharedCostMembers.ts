import type { Category } from '../../workbook/domain/category'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * Why an item is not a sound member of a shared cost: it names one but is a waiting receipt's line, is not under In a shared cost,
 * carries a link or names a shared cost the file lacks, or it sits under In a shared cost without naming one.
 */
export type MemberProblem = 'no-row' | 'not-filed-in' | 'linked' | 'unknown' | 'without-shared-cost'

/** What a member is checked against: the file's shared costs and its categories. */
export interface MemberBook {
  readonly sharedCosts: readonly { readonly id: RecordId }[]
  readonly categories: readonly Pick<Category, 'id' | 'kind'>[]
}

/**
 * The one rule of a member, which the reader doubts by and every write keeps: a part of an entry's row under In a shared cost,
 * with no link, so an asset page and a shared cost never both count the same money, naming a shared cost the file holds.
 */
export function memberProblem(item: Pick<TransactionItem, 'transaction' | 'category' | 'link' | 'sharedCost'>, book: MemberBook): MemberProblem | null {
  const filedIn = book.categories.some((category) => category.id === item.category && category.kind === 'shared-cost')
  if (item.sharedCost === null) return filedIn ? 'without-shared-cost' : null
  if (item.transaction === null) return 'no-row'
  if (!filedIn) return 'not-filed-in'
  if (item.link !== null) return 'linked'
  return book.sharedCosts.some((sharedCost) => sharedCost.id === item.sharedCost) ? null : 'unknown'
}
