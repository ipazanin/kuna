import type { InstalmentTarget, LinkTarget } from './linkTarget'
import type { Category } from '../../workbook/domain/category'
import { ITEM_RECORDS } from '../../workbook/domain/spendingKinds'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { filedAsTransfer, wholeRowItemId } from '../../workbook/domain/rowItems'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * Why a link leaves an entry's money as it is: it names an informal loan, the instalment is all interest, the entry is money in,
 * its account is not in euros as Loans' plan is, it is a transfer's leg, a receipt split it, or it has no category to keep the interest under.
 */
export type WholeReason = 'informal-loan' | 'no-principal' | 'money-in' | 'not-euro' | 'transfer-leg' | 'receipt' | 'unfiled'

/**
 * How a link files an entry: whole, or split into the instalment's interest and principal as the plan has them, with what the
 * entry paid beyond the plan as a part of its own. Each amount is signed as the entry is, and the difference is zero when the
 * entry pays the plan's share, or of the other sign when it pays less.
 */
export type LinkFiling = { readonly split: false; readonly why: WholeReason } | InstalmentSplit

/** An entry's money as an instalment splits it, each amount signed as the entry is, the interest and the difference under `category`. */
export interface InstalmentSplit {
  readonly split: true
  readonly category: RecordId
  readonly interest: AccountMoney
  readonly principal: AccountMoney
  readonly difference: AccountMoney
}

/** What a link reads of the entry's account and the file beside its rows. */
export interface LinkedOn {
  readonly currency: CurrencyCode
  /** Whether a receipt split the entry. */
  readonly receipt: boolean
  readonly categories: readonly Category[]
}

/** Euros of the plan as money out of a euro account. */
function paidOut(euros: Money): AccountMoney {
  return negateAccountMoney(accountMoneyOfEuros(euros))
}

/** The instalment's interest and principal as money out of the entry, and what the entry pays besides them, signed as the entry is. */
function planParts(amount: AccountMoney, target: InstalmentTarget): Pick<InstalmentSplit, 'interest' | 'principal' | 'difference'> {
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
 * How linking the entry to the target files its money. An instalment on money out of a euro account splits into the plan's
 * interest, under the category most of the entry's money is in besides Loan principal, and its principal, which goes under
 * Loan principal and counts as no spending. A part the entry already had gives way to them.
 */
export function linkFiling({ row, items }: ItemizedRow, target: LinkTarget, on: LinkedOn): LinkFiling {
  const whole = (why: WholeReason): LinkFiling => ({ split: false, why })
  if (target.kind !== 'instalment') return whole('informal-loan')
  if (target.principal === 0) return whole('no-principal')
  if (row.amount >= 0) return whole('money-in')
  if (on.currency !== EURO) return whole('not-euro')
  const kinds = new Map(on.categories.map((category) => [category.id, category.kind]))
  if (row.pair !== null || filedAsTransfer(on.categories)(items)) return whole('transfer-leg')
  if (on.receipt) return whole('receipt')
  const filed = items.filter((item): item is TransactionItem & { readonly category: RecordId } => item.category !== null && kinds.get(item.category) !== 'repayment')
  if (filed.length === 0) return whole('unfiled')
  return { split: true, category: mainCategoryOf(filed), ...planParts(row.amount, target) }
}

/** The words a split gives its parts, in the language the person reads. */
export interface PartNotes {
  readonly interest: string
  readonly difference: string
}

/**
 * The entry in the instalment's parts, in place of the items it had, each linked: the interest, the principal under
 * `principal`, then the difference, leaving out a part of nothing. The first part keeps the id of the entry's first item, and
 * the entry is filed by you.
 */
export function splitByInstalment(entry: ItemizedRow, link: RowLink, split: InstalmentSplit, principal: RecordId, notes: PartNotes, newKey: () => string = newRecordId): ItemizedRow {
  const firstId = entry.items[0]?.id ?? wholeRowItemId(entry.row)
  const parts: readonly (readonly [AccountMoney, RecordId, string])[] = [
    [split.interest, split.category, notes.interest],
    [split.principal, principal, ''],
    [split.difference, split.category, notes.difference],
  ]
  const items = parts
    .filter(([amount]) => amount !== 0)
    .map(([amount, category, note], place): TransactionItem => ({
      id: place === 0 ? firstId : recordIdOf(ITEM_RECORDS, newKey()),
      transaction: entry.row.id,
      receipt: null,
      printed: '',
      note,
      amount,
      category,
      link,
    }))
  return { row: { ...entry.row, categorisedBy: 'person' }, items }
}
