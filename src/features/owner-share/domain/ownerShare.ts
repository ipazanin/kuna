import { wholeNumberOf } from '../../workbook/domain/storedFields'
import type { StoredField } from '../../workbook/domain/storedFields'

/**
 * The part of a company cost the owner enjoys privately, as a whole percentage from 0 to 100. A
 * record without one holds null, which is not 0.
 */
export type OwnerShare = number & { readonly __unit: 'percent' }

/** The category roles the owner share selects by, as the `roles` column of `categories` spells them. */
export const OWNER_SHARE_ROLES = {
  /** The owner-pay category the owner's part of a shared cost counts in. */
  ownerBenefit: 'owner-benefit',
} as const

/** The share a whole number from 0 to 100 makes, or null for anything else. */
export function ownerShareOf(percent: number): OwnerShare | null {
  return Number.isInteger(percent) && percent >= 0 && percent <= 100 ? ((percent + 0) as OwnerShare) : null
}

/** The share a stored field holds. A blank field, or one that is not a whole number from 0 to 100, reads as no share. */
export function storedOwnerShare(field: StoredField | undefined): OwnerShare | null {
  const percent = wholeNumberOf(field)
  return percent === null ? null : ownerShareOf(percent)
}

/** Why a filled field reads as no share, or null when it reads as it stands. */
export function ownerShareProblem(field: StoredField | undefined): string | null {
  return field === undefined || storedOwnerShare(field) !== null ? null : `owner_share "${field.text}" is not a whole number from 0 to 100, so it reads as blank`
}

/** What a record's share is copied from: its category's default. */
export interface ShareDefault {
  readonly slug: string
  readonly ownerShare: OwnerShare | null
}

/**
 * The record filed in a category, with the category's default share copied in the same change, over
 * any share it held. A category without a default, or one the categories lack, leaves it blank.
 */
export function filedIn<Filed extends { readonly category: string; readonly ownerShare: OwnerShare | null }>(record: Filed, category: string, categories: readonly ShareDefault[]): Filed {
  return { ...record, category, ownerShare: categories.find((candidate) => candidate.slug === category)?.ownerShare ?? null }
}

/** The record an edit leaves in a category: one that keeps its category keeps its share, and one moved to another takes that category's default. */
export function movedTo<Filed extends { readonly category: string; readonly ownerShare: OwnerShare | null }>(record: Filed, category: string, categories: readonly ShareDefault[]): Filed {
  return record.category === category ? record : filedIn(record, category, categories)
}
