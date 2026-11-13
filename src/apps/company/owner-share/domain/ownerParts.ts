import { ZERO, addMoney, negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { listInWords } from '../../../../shared/text/listInWords'
import type { Bucket } from '../../workbook/domain/bucket'
import type { Category, Workbook, WorkbookProblem } from '../../workbook/domain/workbook'
import { OWNER_SHARE_ROLES, ownerPartOf } from './ownerShare'
import type { OwnerShare } from './ownerShare'
import { words } from './words'

/** What a part of a shared row says about the share it comes from. */
export interface OwnerPart {
  readonly share: OwnerShare
  /** The category the row is filed in, which its business part keeps. */
  readonly sourceCategory: string
  /**
   * The business part stays in the row's category, and the owner's part counts in the benefit
   * category. A row whose owner's part carries VAT the company owes beyond the row has a third
   * part, in the category the VAT is settled in, which takes that VAT back off the row.
   */
  readonly side: 'business' | 'owner' | 'vat'
  /** The VAT the owner's part carries beyond the row's share, signed as the row. Zero when the row holds all its VAT. */
  readonly vatOnShare: Money
}

/** A part of a shared row, with the row as booked. */
export interface OwnerPartOf<Whole> extends OwnerPart {
  readonly whole: Whole
}

/**
 * What the owner's part of a shared row says beside its category, such as "100% to owner, from
 * Equipment", or "50% to owner, with €9.70 VAT, from AI services" when it carries VAT beyond the
 * row. Null on any other row.
 */
export function ownerPartOrigin(part: OwnerPart | undefined, categoryName: (slug: string) => string, money: (amount: Money) => string): string | null {
  if (part?.side !== 'owner') {
    return null
  }
  const category = categoryName(part.sourceCategory)
  return part.vatOnShare === 0 ? words.origin(part.share, category) : words.originWithVat(part.share, money(part.vatOnShare < 0 ? negateMoney(part.vatOnShare) : part.vatOnShare), category)
}

/** How many parts a shared row has: two, or three when its owner's part carries VAT beyond the row. */
export function ownerPartCount(part: OwnerPart): number {
  return part.vatOnShare === 0 ? 2 : 3
}

/** Where a part sits among its row's parts, from 1: the business part, the owner's part, then the VAT part. */
export function ownerPartNumber(part: OwnerPart): number {
  return part.side === 'business' ? 1 : part.side === 'owner' ? 2 : 3
}

/** A key for a part as a screen lists it: the row's own key, marked on the owner's and the VAT part so the parts differ. */
export function ownerPartKey(key: string, part: OwnerPart | undefined): string {
  return part === undefined || part.side === 'business' ? key : `${key}:${part.side}`
}

/** The fields a row needs to be shared: its day, its money, where it counts and its share. */
interface ShareableRow {
  readonly date: CivilDate
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

/** The benefit category the owner's parts count in, or null when the books count no share: the owner-pay module is off, or no single benefit category. */
export function countingBenefitOf(workbook: Pick<Workbook, 'settings' | 'categories'>): Category | null {
  return workbook.settings.ownerPayModule ? benefitCategoryOf(workbook.categories) : null
}

/** The share a row counts with in these books: one above 0 on a row in operating cost while the books count shares, or null. */
export function countedShareIn(workbook: Pick<Workbook, 'settings' | 'categories'>, row: Pick<ShareableRow, 'ownerShare' | 'bucket'>): OwnerShare | null {
  return countingBenefitOf(workbook) === null ? null : countedShare(row)
}

function countedShare(row: Pick<ShareableRow, 'ownerShare' | 'bucket'>): OwnerShare | null {
  return row.ownerShare !== null && row.ownerShare > 0 && row.bucket === 'operating' ? row.ownerShare : null
}

/** VAT the company owes beyond a shared row on the owner's share of it, signed as the row, and the category it is settled in. */
export interface VatOwedOnShare {
  readonly amount: Money
  readonly settlement: Category
}

/**
 * The VAT the company owes beyond a row for the owner's private share of it, such as what the
 * reverse charge self-charges on that share, or null for none. The pack knows the rates and the
 * settlement category, so the owner's part reaches them through the pack's slot.
 */
export type VatOnPrivateShare = (row: Pick<ShareableRow, 'date' | 'amount' | 'category'>, category: Category, share: OwnerShare, categories: readonly Category[]) => VatOwedOnShare | null

/** No VAT beyond the row, as without a pack. */
export const NO_VAT_ON_PRIVATE_SHARE: VatOnPrivateShare = () => null

/**
 * A row with a share above 0 in operating cost as its business part, in its own category, and the
 * owner's part, in the benefit category. The owner's part is the share of the signed amount, rounded
 * to the cent, and the business part is the rest. VAT the company owes beyond the row on the
 * owner's share joins the owner's part, and a third part in its settlement category takes it back
 * off, so the parts add up to the row and a refund gives its share back. A part that comes to
 * nothing is left out. Any other row stays as it is.
 */
export function ownerPartsOf<Row extends ShareableRow>(row: Row, benefit: Category, categories: readonly Category[], vatOnPrivateShare: VatOnPrivateShare): Row[] {
  const share = countedShare(row)
  if (share === null) {
    return [row]
  }
  const ownerShare = ownerPartOf(row.amount, share)
  if (ownerShare === 0) {
    return [row]
  }
  const category = categories.find((candidate) => candidate.slug === row.category)
  const owed = category === undefined ? null : vatOnPrivateShare(row, category, share, categories)
  const vatOnShare = owed?.amount ?? ZERO
  const partOf = (side: OwnerPart['side']): OwnerPartOf<Row> => ({ whole: row, share, sourceCategory: row.category, side, vatOnShare })
  const parts = [
    { ...row, amount: subtractMoney(row.amount, ownerShare), ownerPart: partOf('business') },
    { ...row, amount: addMoney(ownerShare, vatOnShare), category: benefit.slug, family: benefit.family, bucket: benefit.bucket, ownerPart: partOf('owner') },
    ...(owed === null || vatOnShare === 0
      ? []
      : [{ ...row, amount: negateMoney(vatOnShare), category: owed.settlement.slug, family: owed.settlement.family, bucket: owed.settlement.bucket, ownerPart: partOf('vat') }]),
  ]
  return parts.filter((part) => part.amount !== 0)
}

/**
 * The workbook as the cash screens count it: each shared bank row, split part and owner advance as
 * its two parts. With the owner-pay module off, or without one benefit category, it stays as booked.
 */
export function withOwnerParts(workbook: Workbook, vatOnPrivateShare: VatOnPrivateShare): Workbook {
  const benefit = countingBenefitOf(workbook)
  if (benefit === null) {
    return workbook
  }
  const partsOf = <Row extends ShareableRow>(row: Row) => ownerPartsOf(row, benefit, workbook.categories, vatOnPrivateShare)
  return {
    ...workbook,
    transactions: workbook.transactions.flatMap(partsOf),
    ownerAdvances: workbook.ownerAdvances.flatMap(partsOf),
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
      ? words.noRoleCarrier(role)
      : carrying.length > 1
        ? words.severalCarriers(role, listInWords(carrying.map((category) => `"${category.slug}"`)))
        : words.wrongBucket(role, carrying[0]!.slug, carrying[0]!.bucket)
  return [
    {
      tab: 'categories',
      id: null,
      label: role,
      reason: words.sharesCountAsZero(held, why),
    },
  ]
}
