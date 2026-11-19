import { loanLinkOf, sameRecord } from './linkTarget'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import type { AppTargets, InstalmentTarget, LinkTarget, LoanTarget } from './linkTarget'
import { companyLinkedEntry, companyPaymentFiling } from './companyPaymentFiling'
import type { CompanyPaymentSplit } from './companyPaymentFiling'
import { inWindow, isNear, nearestTo } from '../../../../shared/app/moneyMatch'
import type { DatedMoney } from '../../../../shared/app/moneyMatch'
import { fixedCategoryIn, loanInterestCategoryIn } from '../../categories/domain/starterCategories'
import { eventOfLargest, ruleLabelsOf } from '../../workbook/domain/carriedChoices'
import { categoryWithRole } from '../../workbook/domain/category'
import type { Category, FixedKind } from '../../workbook/domain/category'
import { ITEM_RECORDS } from '../../workbook/domain/spendingKinds'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { filedAsTransfer, linkedItems, wholeItemOf, wholeRowItemId } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { absAccountMoney, accountMoneyOfEuros, negateAccountMoney, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Language } from '../../../../shared/text/language'

/**
 * Why a link files an entry whole: it names money lent, borrowed or paid back early, which goes under the fixed category
 * `wholeLoanKindOf` names, or it
 * leaves the entry's money as it is, since the instalment is all interest, the entry is money in, its account is not in euros
 * as Loans' plan is, it is a transfer's leg, or a receipt split it.
 */
export type WholeReason = 'principal' | 'no-principal' | 'money-in' | 'not-euro' | 'transfer-leg' | 'receipt'

/**
 * How a link files an entry: whole, under its loan's fixed category or as it is, split into the instalment's interest and principal as
 * the plan has them, with what the entry paid beyond the plan as a part of its own, or in the parts of a payment from or to your company.
 * Each amount is signed as the entry is, and the difference is zero when the entry pays the plan's share, or of the other sign when it pays less.
 */
export type LinkFiling = LoanFiling | CompanyPaymentSplit

/** How a link to a record in Loans files an entry: whole, or split by an instalment. */
export type LoanFiling = { readonly split: false; readonly why: WholeReason } | InstalmentSplit

/** An entry's money as an instalment splits it, each amount signed as the entry is, the interest and the difference under `category`. */
export interface InstalmentSplit {
  readonly split: true
  /** Null for an entry with no category in a file with no Loan interest yet, which the write adds and files them under. */
  readonly category: RecordId | null
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

/** The fixed category a link that files the whole entry puts it under: Loans to and from people for an informal loan's money, Loan principal for a bank loan's. */
export function wholeLoanKindOf(target: LoanTarget): Extract<FixedKind, 'repayment' | 'informal-loan'> {
  return target.kind === 'informal-loan' || target.kind === 'movement' ? 'informal-loan' : 'repayment'
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
 * How much more the entry moved than the movement or extra payment it is linked to, below zero when it moved less, or null for
 * another target or an account not in euros as Loans is. An instalment compares with its plan through `beyondPlan`.
 */
export function beyondRecord(target: LinkTarget, row: Pick<Transaction, 'amount'>, currency: CurrencyCode): AccountMoney | null {
  if ((target.kind !== 'movement' && target.kind !== 'extra-payment') || currency !== EURO) return null
  return subtractAccountMoney(absAccountMoney(row.amount), accountMoneyOfEuros(target.amount))
}

/**
 * How linking the entry to the target files its money. An instalment on money out of a euro account splits into the plan's
 * interest, under the category most of the entry's money is in besides Loan principal or under Loan interest for an entry
 * with no category, and its principal, which goes under Loan principal and counts as no spending. A part the entry already
 * had gives way to them. An extra payment is all principal, so the whole entry goes under Loan principal, and an informal
 * loan or its movement goes whole under Loans to and from people. A transfer's leg and a receipt's row keep their parts. A payment
 * from or to your company files as `companyPaymentFiling` says.
 */
export function linkFiling(entry: ItemizedRow, target: LoanTarget, on: LinkedOn): LoanFiling
export function linkFiling(entry: ItemizedRow, target: LinkTarget, on: LinkedOn): LinkFiling
export function linkFiling({ row, items }: ItemizedRow, target: LinkTarget, on: LinkedOn): LinkFiling {
  if (target.kind === 'owner-payment') return companyPaymentFiling({ row, items }, target, on)
  const whole = (why: WholeReason): LoanFiling => ({ split: false, why })
  if (row.pair !== null || filedAsTransfer(on.categories)(items)) return whole('transfer-leg')
  if (on.receipt) return whole('receipt')
  if (target.kind !== 'instalment') return whole('principal')
  if (target.principal === 0) return whole('no-principal')
  if (row.amount >= 0) return whole('money-in')
  if (on.currency !== EURO) return whole('not-euro')
  const kinds = new Map(on.categories.map((category) => [category.id, category.kind]))
  const filed = items.filter((item): item is TransactionItem & { readonly category: RecordId } => item.category !== null && kinds.get(item.category) !== 'repayment')
  const category = filed.length === 0 ? (categoryWithRole(on.categories, 'loan-interest')?.id ?? null) : mainCategoryOf(filed)
  return { split: true, category, ...planParts(row.amount, target) }
}

/** The words a split gives its parts, in the language the person reads. */
export interface PartNotes {
  readonly interest: string
  readonly difference: string
}

/**
 * The entry in the instalment's parts, in place of the items it had, each linked: the interest, the principal under
 * `principal`, then the difference, leaving out a part of nothing. The first part keeps the id of the entry's first item, and
 * the entry is filed by you. Every part carries every label of the entry and says the link split it off.
 */
export function splitByInstalment(
  entry: ItemizedRow,
  link: RowLink,
  split: InstalmentSplit & { readonly category: RecordId },
  principal: RecordId,
  notes: PartNotes,
  newKey: () => string = newRecordId,
): ItemizedRow {
  const firstId = entry.items[0]?.id ?? wholeRowItemId(entry.row)
  const labels = labelsOf(entry.items)
  const ruleLabels = ruleLabelsOf(entry.items)
  const event = eventOfLargest(entry.items)
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
      labels,
      ruleLabels,
      event,
      splitByLink: true,
    }))
  return { row: { ...entry.row, categorisedBy: 'person' }, items }
}

/** What linking an entry reads beside the file's rows: its account's currency, the file's categories, and the language and notes of the parts a split adds. */
export interface LinkPlace {
  readonly currency: CurrencyCode
  readonly categories: readonly Category[]
  readonly language: Language
  readonly notes: PartNotes
}

/** An entry as a link left it, with the categories it needs that a file made before them lacks: Loan principal or Loans to and from people, and Loan interest for an entry with no category. */
export interface LinkedEntry {
  readonly entry: ItemizedRow
  /** The category the instalment's interest went under, or null when the link left the entry whole. */
  readonly interest: RecordId | null
  readonly added: readonly Category[]
}

/**
 * The entry linked to the record in Loans it is, filed as `linkFiling` says: split by an instalment, whole under its loan's
 * fixed category and filed by you, its parts joined into one that keeps every label, or each item as it is with the link on it.
 */
export function linkedEntry(entry: ItemizedRow, target: LinkTarget, place: LinkPlace & Pick<LinkedOn, 'receipt'>, newKey: () => string = newRecordId): LinkedEntry {
  if (target.kind === 'owner-payment') return companyLinkedEntry(entry, target, place, newKey)
  const filing = linkFiling(entry, target, place)
  if (!filing.split && filing.why !== 'principal') return { entry: { row: entry.row, items: linkedItems(entry.items, target.link) }, interest: null, added: [] }
  const principal = fixedCategoryIn(place.categories, filing.split ? 'repayment' : wholeLoanKindOf(target), place.language, newKey)
  const principalAdded = principal.added ? [principal.category] : []
  if (!filing.split) {
    const first = entry.items[0] ?? wholeItemOf(entry.row, { category: null, note: '', link: null, labels: [] })
    const whole: TransactionItem = {
      ...first,
      amount: entry.row.amount,
      category: principal.category.id,
      link: target.link,
      labels: labelsOf(entry.items),
      ruleLabels: ruleLabelsOf(entry.items),
      splitByLink: false,
    }
    return { entry: { row: { ...entry.row, categorisedBy: 'person' }, items: [whole] }, interest: null, added: principalAdded }
  }
  const interest = filing.category === null ? loanInterestCategoryIn(place.categories, place.language, newKey) : { category: { id: filing.category }, added: [] }
  return {
    entry: splitByInstalment(entry, target.link, { ...filing, category: interest.category.id }, principal.category.id, place.notes, newKey),
    interest: interest.category.id,
    added: [...principalAdded, ...interest.added],
  }
}

/** The records in Loans a write may link rows to, null while Loans cannot be read, with the language and notes of the parts and categories a link adds. */
export type InstalmentLinks = Pick<LinkPlace, 'language' | 'notes'> & { readonly targets: readonly LinkTarget[] | null }

/** An entry a rule linked to the instalment it pays. */
export type RuleLinked = LinkedEntry & { readonly target: InstalmentTarget }

/**
 * What a rule whose rows pay a loan does to an entry it filed: links it to the loan's instalment due nearest its day inside the
 * window that no row is linked to yet, as `linked` names them, when the entry is money out of a euro account paying the share
 * within a tenth, and splits it as `linkedEntry` does, the interest under the rule's category. Null leaves it filed whole.
 */
export function ruleLinking(entry: ItemizedRow, loan: RowLink, targets: readonly LinkTarget[], linked: ReadonlySet<string>, place: LinkPlace, newKey: () => string = newRecordId): RuleLinked | null {
  if (entry.row.amount >= 0 || entry.row.pair !== null || place.currency !== EURO) return null
  const open = targets.filter(
    (target): target is InstalmentTarget =>
      target.kind === 'instalment' && sameRecord(loanLinkOf(target.link), loan) && !linked.has(rowLinkText(target.link)) && inWindow(expectedOf(target), entry.row),
  )
  const nearest = nearestTo(
    entry.row.date,
    open.map((target) => ({ date: target.due, target })),
  )?.target
  if (nearest === undefined || !isNear(expectedOf(nearest), entry.row)) return null
  return { ...linkedEntry(entry, nearest, { ...place, receipt: false }, newKey), target: nearest }
}

/** The records an app's targets give a write to link rows to: none while the app opens, failed or is not set up. */
export function instalmentLinksOf(targets: AppTargets<LinkTarget>, words: Pick<LinkPlace, 'language' | 'notes'>): InstalmentLinks {
  return { targets: targets === null || typeof targets === 'string' ? null : targets, language: words.language, notes: words.notes }
}
