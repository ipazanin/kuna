import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * What money in a category counts as. Spending and income are the groups you edit. Saving is money sent to
 * investments, transfer money between your own accounts, company money spent for the company, repayment the
 * principal of a bank loan you pay back, and informal-loan money lent to, borrowed from or paid back between you and
 * a person. Each of these five is one fixed category that no spending, income or limit figure counts as spending.
 */
export const CATEGORY_KINDS = ['spending', 'income', 'saving', 'transfer', 'company', 'repayment', 'informal-loan'] as const

export type CategoryKind = (typeof CATEGORY_KINDS)[number]

/** The kinds that hold one fixed category each, with no parent and no children, which cannot be deleted. */
export const FIXED_KINDS = ['transfer', 'saving', 'company', 'repayment', 'informal-loan'] as const satisfies readonly CategoryKind[]

export type FixedKind = (typeof FIXED_KINDS)[number]

export function isFixedKind(kind: CategoryKind): kind is FixedKind {
  return (FIXED_KINDS as readonly CategoryKind[]).includes(kind)
}

/** Whether money under the category moves between your own accounts. A second transfer category, which the reader doubts, does too. */
export function isTransferCategory(category: Pick<Category, 'kind'>): boolean {
  return category.kind === 'transfer'
}

/** The category a new transfer is filed under, which is the first transfer category in file order, or null when the file has none. */
export function transferCategoryOf(categories: readonly Category[]): Category | null {
  return categories.find(isTransferCategory) ?? null
}

/** The fixed category company money spent for the company is filed under, or null when the file has none. */
export function companyCategoryOf(categories: readonly Category[]): Category | null {
  return categories.find((category) => category.kind === 'company') ?? null
}

/** What Kuna files in a spending category of its own: a statement's bank fees, or the interest of a linked loan instalment. */
export const CATEGORY_ROLES = ['bank-fees', 'loan-interest'] as const

export type CategoryRole = (typeof CATEGORY_ROLES)[number]

/** The category that holds the role, the first in file order, or undefined when none does. */
export function categoryWithRole(categories: readonly Category[], role: CategoryRole): Category | undefined {
  return categories.find((category) => category.role === role)
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
  /** What Kuna files in it, kept through a rename, or null for a category Kuna does not fill. */
  readonly role: CategoryRole | null
}

/** What a new category holds unless a person sets it: shown in the pickers. */
export const NEW_CATEGORY_DEFAULTS: Pick<Category, 'hidden' | 'role'> = { hidden: false, role: null }
