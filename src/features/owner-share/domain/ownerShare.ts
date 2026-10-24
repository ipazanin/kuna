import { divideMoney, moneyFromCents } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { countedSplits } from '../../transactions/domain/countedSplits'
import type { RecordId } from '../../workbook/domain/recordId'
import { wholeNumberOf } from '../../workbook/domain/storedFields'
import type { StoredField } from '../../workbook/domain/storedFields'
import type { Workbook } from '../../workbook/domain/workbook'

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

/** The share a person typed: null for a blank field, which holds no share, and undefined for anything but a whole number from 0 to 100. */
export function typedOwnerShare(text: string): OwnerShare | null | undefined {
  const typed = text.trim()
  if (typed === '') {
    return null
  }
  return /^\d{1,3}$/.test(typed) ? (ownerShareOf(Number(typed)) ?? undefined) : undefined
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

/** The owner's part of an amount at a share, rounded to the cent. The rest is the company's, so the two add up to the amount. */
export function ownerPartOf(amount: Money, share: OwnerShare): Money {
  return divideMoney(moneyFromCents(amount * share), 100)
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

/** The record a share sits on: a ledger row that is not split, a part of a split row, or an owner advance. */
export interface ShareTarget {
  readonly holder: 'ledger' | 'split-part' | 'owner-advance'
  readonly id: RecordId
}

/** A category whose default a save sets or changes, with the records filed in it that hold no share yet. */
export interface ShareFill {
  readonly category: string
  readonly ownerShare: OwnerShare
  readonly targets: readonly ShareTarget[]
}

/**
 * What a save of the categories may fill: for each default it sets or changes, the records filed in
 * that category, as the workbook counts them, that hold no share. A record holding 0 keeps it. The
 * ledger cell of a split row is left alone, since its parts carry the shares that count. A row the
 * pack keeps whole counts whole, so its cell is filled and its parts are not.
 */
export function shareFillsOf(workbook: Pick<Workbook, 'categories' | 'transactions' | 'splits' | 'rowsKeptWhole' | 'ownerAdvances'>, saved: readonly ShareDefault[]): ShareFill[] {
  const { splits } = countedSplits(workbook.splits, workbook.rowsKeptWhole)
  const splitRows = new Set(splits.map((split) => split.row.id))
  const parts = splits.flatMap((split) => split.parts)
  return saved.flatMap(({ slug, ownerShare }) => {
    if (ownerShare === null || ownerShare === (workbook.categories.find((category) => category.slug === slug)?.ownerShare ?? null)) {
      return []
    }
    const blank = (filed: { readonly category: string; readonly ownerShare: OwnerShare | null }): boolean => filed.category === slug && filed.ownerShare === null
    const targets = [
      ...workbook.transactions.filter((row) => !splitRows.has(row.id) && blank(row)).map((row): ShareTarget => ({ holder: 'ledger', id: row.id })),
      ...parts.filter(blank).map((part): ShareTarget => ({ holder: 'split-part', id: part.id })),
      ...workbook.ownerAdvances.filter(blank).map((advance): ShareTarget => ({ holder: 'owner-advance', id: advance.id })),
    ]
    return targets.length === 0 ? [] : [{ category: slug, ownerShare, targets }]
  })
}
