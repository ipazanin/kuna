import type { InstalmentTarget, LinkTarget } from './linkTarget'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { DatedMoney } from '../../../../shared/app/moneyMatch'
import { eventOfLargest, ruleLabelsOf } from '../../workbook/domain/carriedChoices'
import { categoryWithRole } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import { ITEM_RECORDS } from '../../workbook/domain/spendingKinds'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { wholeRowItemId } from '../../workbook/domain/rowItems'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An entry's money as an instalment splits it, each amount signed as the entry is, the interest and the difference under `category`. */
export interface InstalmentSplit {
  readonly split: true
  /** Null for an entry with no category in a file with no Loan interest yet, which the write adds and files them under. */
  readonly category: RecordId | null
  readonly interest: AccountMoney
  readonly principal: AccountMoney
  readonly difference: AccountMoney
}

/** Euros of the plan as money out of a euro account. */
export function paidOut(euros: Money): AccountMoney {
  return negateAccountMoney(accountMoneyOfEuros(euros))
}

/** The instalment's share as the money out of a euro account that pays it, on its due date. */
export function expectedOf(target: InstalmentTarget): DatedMoney {
  return { date: target.due, amount: paidOut(target.youPay) }
}

/** The instalment's interest and principal as money out of the entry, and what the entry pays besides them, signed as the entry is. */
export function planParts(amount: AccountMoney, target: InstalmentTarget): Pick<InstalmentSplit, 'interest' | 'principal' | 'difference'> {
  const interest = paidOut(target.interest)
  const principal = paidOut(target.principal)
  return { interest, principal, difference: restOfWhole(amount, [interest, principal]) }
}

/**
 * What the entry paid beyond its instalment's interest and principal in the plan, below zero when it paid less, or null when
 * the two do not compare: an informal loan, money in, or an account not in euros.
 */
export function beyondPlan(target: LinkTarget, row: Pick<Transaction, 'amount'>, currency: CurrencyCode): AccountMoney | null {
  if (target.kind !== 'instalment' || row.amount >= 0 || currency !== EURO) return null
  return negateAccountMoney(planParts(row.amount, target).difference)
}

/**
 * The category an instalment's interest and the difference go under: the one most of the entry's money is in besides Loan
 * principal, or Loan interest for an entry with no category, null while the file has no Loan interest yet.
 */
export function interestCategoryOf(items: readonly TransactionItem[], categories: readonly Category[]): RecordId | null {
  const kinds = new Map(categories.map((category) => [category.id, category.kind]))
  const filed = items.filter((item): item is TransactionItem & { readonly category: RecordId } => item.category !== null && kinds.get(item.category) !== 'repayment')
  return filed.length === 0 ? (categoryWithRole(categories, 'loan-interest')?.id ?? null) : mainCategoryOf(filed)
}

/** The words a split gives its parts, in the language the person reads. */
export interface PartNotes {
  readonly interest: string
  readonly difference: string
}

/** One part a link splits an entry into: its amount signed as the entry is, its category, its note and the record it is linked to. */
export type LinkedPart = readonly [AccountMoney, RecordId, string, RowLink]

/**
 * The entry in the parts given, in place of the items it had, leaving out a part of nothing. The first part keeps the id of
 * the entry's first item, and the entry is filed by you. Every part carries every label of the entry and says a link split it off.
 */
export function splitIntoParts(entry: ItemizedRow, parts: readonly LinkedPart[], newKey: () => string): ItemizedRow {
  const firstId = entry.items[0]?.id ?? wholeRowItemId(entry.row)
  const labels = labelsOf(entry.items)
  const ruleLabels = ruleLabelsOf(entry.items)
  const event = eventOfLargest(entry.items)
  const items = parts
    .filter(([amount]) => amount !== 0)
    .map(([amount, category, note, link], place): TransactionItem => ({
      id: place === 0 ? firstId : recordIdOf(ITEM_RECORDS, newKey()),
      transaction: entry.row.id,
      receipt: null,
      printed: '',
      note,
      amount,
      category,
      link,
      labels,
      ruleLabels,
      event,
      splitByLink: true,
    }))
  return { row: { ...entry.row, categorisedBy: 'person' }, items }
}

/** The entry in the instalment's parts, each linked to it: the interest, the principal under `principal`, then the difference. */
export function splitByInstalment(
  entry: ItemizedRow,
  link: RowLink,
  split: InstalmentSplit & { readonly category: RecordId },
  principal: RecordId,
  notes: PartNotes,
  newKey: () => string = newRecordId,
): ItemizedRow {
  return splitIntoParts(
    entry,
    [
      [split.interest, split.category, notes.interest, link],
      [split.principal, principal, '', link],
      [split.difference, split.category, notes.difference, link],
    ],
    newKey,
  )
}
