import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * What money in a category counts as. Spending and income are the groups you edit. Saving is money sent to
 * investments, transfer money between your own accounts, and company money spent for the company, and each of
 * these three is one fixed category that no spending, income or limit figure counts as spending.
 */
export const CATEGORY_KINDS = ['spending', 'income', 'saving', 'transfer', 'company'] as const

export type CategoryKind = (typeof CATEGORY_KINDS)[number]

/** The kinds that hold one fixed category each, with no parent and no children, which cannot be deleted. */
export const FIXED_KINDS = ['transfer', 'saving', 'company'] as const satisfies readonly CategoryKind[]

export type FixedKind = (typeof FIXED_KINDS)[number]

export function isFixedKind(kind: CategoryKind): kind is FixedKind {
  return (FIXED_KINDS as readonly CategoryKind[]).includes(kind)
}

/** A group, with no parent, or a child of a group of the same kind. */
export interface Category {
  readonly id: RecordId
  readonly name: string
  readonly kind: CategoryKind
  readonly parent: RecordId | null
  /** Its place among its siblings, lowest first. */
  readonly order: number
  /** The stored light step of its swatch, or blank for its group's colour. */
  readonly colour: string
  /** Hidden from the pickers, while its rows keep counting. */
  readonly hidden: boolean
}

/** What a new category holds unless a person sets it: shown in the pickers. */
export const NEW_CATEGORY_DEFAULTS: Pick<Category, 'hidden'> = { hidden: false }
