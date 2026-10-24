import { subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { Bucket } from '../../workbook/domain/bucket'
import { listInWords } from '../../workbook/domain/slug'
import type { Category, Workbook, WorkbookProblem } from '../../workbook/domain/workbook'
import { OWNER_SHARE_ROLES, ownerPartOf } from './ownerShare'
import type { OwnerShare } from './ownerShare'

/** What a part of a shared row says about the share it comes from. */
export interface OwnerPart {
  readonly share: OwnerShare
  /** The category the row is filed in, which its business part keeps. */
  readonly sourceCategory: string
  /** The business part stays in the row's category, and the owner's part counts in the benefit category. */
  readonly side: 'business' | 'owner'
}

/** A part of a shared row, with the row as booked. */
export interface OwnerPartOf<Whole> extends OwnerPart {
  readonly whole: Whole
}

/** A key for a part as a screen lists it: the row's own key, marked on the owner's part so the two parts differ. */
export function ownerPartKey(key: string, part: OwnerPart | undefined): string {
  return part?.side === 'owner' ? `${key}:owner` : key
}

/** The fields a row needs to be shared: its money, where it counts and its share. */
interface ShareableRow {
  readonly amount: Money
  readonly category: string
  readonly family: string
  readonly bucket: Bucket
  readonly ownerShare: OwnerShare | null
}

/** The one owner-pay category with the owner-benefit role, or null when no category carries the role, two do, or it sits in another bucket. */
export function benefitCategoryOf(categories: readonly Category[]): Category | null {
  const carrying = categories.filter((category) => category.roles.includes(OWNER_SHARE_ROLES.ownerBenefit))
  return carrying.length === 1 && carrying[0]!.bucket === 'owner-pay' ? carrying[0]! : null
}

/** The share a row counts with: one above 0 on a row in operating cost, or null. */
function countedShare(row: ShareableRow): OwnerShare | null {
  return row.ownerShare !== null && row.ownerShare > 0 && row.bucket === 'operating' ? row.ownerShare : null
}

/**
 * A row with a share above 0 in operating cost as its business part, in its own category, and the
 * owner's part, in the benefit category. The owner's part is the share of the signed amount, rounded
 * to the cent, and the business part is the rest, so the two add up to the row and a refund gives
 * its share back. A part that comes to nothing is left out. Any other row stays as it is.
 */
export function ownerPartsOf<Row extends ShareableRow>(row: Row, benefit: Category): Row[] {
  const share = countedShare(row)
  if (share === null) {
    return [row]
  }
  const owner = ownerPartOf(row.amount, share)
  if (owner === 0) {
    return [row]
  }
  const partOf = (side: OwnerPart['side']): OwnerPartOf<Row> => ({ whole: row, share, sourceCategory: row.category, side })
  const parts = [
    { ...row, amount: subtractMoney(row.amount, owner), ownerPart: partOf('business') },
    { ...row, amount: owner, category: benefit.slug, family: benefit.family, bucket: benefit.bucket, ownerPart: partOf('owner') },
  ]
  return parts.filter((part) => part.amount !== 0)
}

/**
 * The workbook as the cash screens count it: each shared bank row, split part and owner advance as
 * its two parts. With the owner-pay module off, or without one benefit category, it stays as booked.
 */
export function withOwnerParts(workbook: Workbook): Workbook {
  const benefit = benefitCategoryOf(workbook.categories)
  if (!workbook.settings.ownerPayModule || benefit === null) {
    return workbook
  }
  return {
    ...workbook,
    transactions: workbook.transactions.flatMap((row) => ownerPartsOf(row, benefit)),
    ownerAdvances: workbook.ownerAdvances.flatMap((advance) => ownerPartsOf(advance, benefit)),
  }
}

/**
 * Why the shares count as 0 while rows hold them: no single owner-pay category carries the
 * owner-benefit role. Nothing to say with the owner-pay module off, where shares never count.
 */
export function ownerShareProblems(workbook: Workbook): WorkbookProblem[] {
  if (!workbook.settings.ownerPayModule || benefitCategoryOf(workbook.categories) !== null) {
    return []
  }
  const held = [...workbook.transactions, ...workbook.ownerAdvances].filter((row) => countedShare(row) !== null).length
  if (held === 0) {
    return []
  }
  const role = OWNER_SHARE_ROLES.ownerBenefit
  const carrying = workbook.categories.filter((category) => category.roles.includes(role))
  const why =
    carrying.length === 0
      ? `no category carries the ${role} role`
      : carrying.length > 1
        ? `the ${role} role is on ${listInWords(carrying.map((category) => `"${category.slug}"`))}, and only one category may carry it`
        : `the ${role} role is on "${carrying[0]!.slug}" in the ${carrying[0]!.bucket} bucket, and only an owner-pay category may carry it`
  return [
    {
      tab: 'categories',
      id: null,
      label: role,
      reason: `${held} ${held === 1 ? 'row holds' : 'rows hold'} an owner share, but ${why}. So every share counts as 0 until one owner-pay category carries the role.`,
    },
  ]
}
