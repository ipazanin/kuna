import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'
import type { Account } from '../../workbook/domain/account'
import type { RowLink } from '../../workbook/domain/rowLink'
import { normaliseIban } from '../../../../shared/text/fold'
import type { Transaction } from '../../workbook/domain/transaction'

/** A bank loan's instalment in Loans that a row can pay, or its interim interest: when it falls due and what of it you pay. */
export interface InstalmentTarget {
  readonly kind: 'instalment'
  /** The interest charged before the first instalment, which is all interest. */
  readonly interim: boolean
  readonly link: RowLink
  readonly loanName: string
  /** The bank the loan is from, which may be blank. */
  readonly lender: string
  /** Its number in the plan counting from 1, null for interim interest. */
  readonly number: number | null
  /** How many instalments the plan has. */
  readonly count: number
  readonly due: CivilDate
  readonly yourShare: Money
  readonly interest: Money
  readonly principal: Money
}

/** Which way money owed between you and someone else runs. */
export type LoanDirection = 'you-owe' | 'owed-to-you'

/** Money owed between you and someone else in Loans, which older rows name as a whole. */
export interface InformalLoanTarget {
  readonly kind: 'informal-loan'
  readonly link: RowLink
  readonly name: string
  readonly counterparty: string
  readonly direction: LoanDirection
}

/** What happened on an informal loan, as Loans names it. */
export type MovementKind = 'borrowed' | 'borrowed-in-kind' | 'repaid' | 'repaid-in-kind' | 'forgiven'

/** One dated change to what an informal loan owes in Loans, which a row can be. */
export interface MovementTarget {
  readonly kind: 'movement'
  readonly link: RowLink
  /** The informal loan's own link, which a movement added from a row names. */
  readonly loan: RowLink
  readonly loanName: string
  readonly counterparty: string
  readonly direction: LoanDirection
  readonly day: CivilDate
  readonly movement: MovementKind
  /** Above zero. */
  readonly amount: Money
}

/** Principal paid back early on a bank loan in Loans, which a row can be. */
export interface ExtraPaymentTarget {
  readonly kind: 'extra-payment'
  readonly link: RowLink
  readonly loanName: string
  readonly day: CivilDate
  readonly amount: Money
}

/** What an extra payment a row adds in Loans does to the rest of its loan: ends it sooner, or keeps the term with a lower instalment. */
export type ExtraPaymentEffect = 'shorter-term' | 'lower-instalment'

/** What money in a payment from or to your company is: salary, rent, a profit payout, an owner loan, a cost paid back, a travel allowance, other tax-free pay or other money. */
export type CompanyMoney = 'salary' | 'rent' | 'profit-payout' | 'owner-loan' | 'cost-refund' | 'travel-allowance' | 'tax-free-pay' | 'other'

/** One kind of money in a payment with your company. Above zero. */
export interface CompanyMoneyPart {
  readonly kind: CompanyMoney
  readonly amount: Money
}

/** A bank row between your company and you in Company, which a row on your own account can be. */
export interface OwnerPaymentTarget {
  readonly kind: 'owner-payment'
  readonly link: RowLink
  readonly day: CivilDate
  /** Above zero, whichever way the money went. */
  readonly amount: Money
  /** Money from the company to you, or from you to the company. */
  readonly direction: 'to-owner' | 'from-owner'
  /** Your IBAN the company paid to or was paid from. */
  readonly ownerIban: string
  /** One part per kind, larger first, which add up to the amount. */
  readonly parts: readonly CompanyMoneyPart[]
}

/** The kinds of money from your company that are an employee's pay. A trip's allowances and other tax-free pay are paid for work as salary is. */
const PAY: ReadonlySet<CompanyMoney> = new Set(['salary', 'travel-allowance', 'tax-free-pay'])

/**
 * Whether money linked to a record of a company app is an employee's pay, which stays on this device while Anonymise is on: a
 * payment with a part of pay, or any payment while the company's books cannot be read to tell. A link to a row it no longer has is not.
 */
export function isPayLink(read: LinkState<LinkTarget>): boolean {
  if (read.state === 'there') return read.target.kind === 'owner-payment' && read.target.parts.some((part) => PAY.has(part.kind))
  return read.state !== 'gone'
}

/** A record in another app that a row can be. */
export type LinkTarget = InstalmentTarget | InformalLoanTarget | MovementTarget | ExtraPaymentTarget | OwnerPaymentTarget

/** A record in Loans that a row can be. */
export type LoanTarget = Exclude<LinkTarget, OwnerPaymentTarget>

/** Which kind of app a link names: Loans with its loans, or a company app with its payments with the owner. Its words for a link it cannot show depend on it. */
export type TargetSource = 'loans' | 'company'

/** An app's targets, a wait while its file opens, a failure, or null while the app is not set up on this device. */
export type AppTargets<Target> = readonly Target[] | 'opening' | 'failed' | null

/** One app's targets under the app's id, as a row's link names it. */
export interface TargetsOfApp<Target> {
  readonly app: string
  readonly targets: AppTargets<Target>
}

/** The targets of the app among every app's. An app that publishes none has no targets, so a link to it reads as gone. */
export function targetsIn<Target>(apps: readonly TargetsOfApp<Target>[], app: string): AppTargets<Target> {
  return apps.find((entry) => entry.app === app)?.targets ?? []
}

/** What a row's link reads as: the record it names, or why that record cannot be shown. A row whose target is not there counts by its category as any row does. */
export type LinkState<Target> =
  { readonly state: 'there'; readonly target: Target } | { readonly state: 'opening' } | { readonly state: 'failed' } | { readonly state: 'not-set-up' } | { readonly state: 'gone' }

/** The record a link names among the targets its app publishes, each naming itself, or why it is not there. A link no target names reads as gone. */
export function linkStateOf<Target extends { readonly link: RowLink }>(link: RowLink, targets: AppTargets<Target>): LinkState<Target> {
  if (targets === null) return { state: 'not-set-up' }
  if (targets === 'opening' || targets === 'failed') return { state: targets }
  const target = targets.find((candidate) => sameRecord(candidate.link, link))
  return target === undefined ? { state: 'gone' } : { state: 'there', target }
}

/** A bank loan whose instalments a row can pay, named as a rule whose rows pay it names it. */
export interface PaidLoan {
  /** The link of its instalments with no due date. */
  readonly link: RowLink
  readonly loanName: string
}

/** The loan an instalment's link names, the same for every instalment of the loan. */
export function loanLinkOf(link: RowLink): RowLink {
  return { ...link, due: null }
}

/** Each bank loan the targets have instalments of, in the order the targets name them first. */
export function paidLoansIn(targets: readonly LinkTarget[]): readonly PaidLoan[] {
  const loans: PaidLoan[] = []
  for (const target of targets) {
    if (target.kind !== 'instalment' || loans.some((loan) => sameRecord(loan.link, loanLinkOf(target.link)))) continue
    loans.push({ link: loanLinkOf(target.link), loanName: target.loanName })
  }
  return loans
}

/** Whether two links name the same record. */
export function sameRecord(one: RowLink, other: RowLink): boolean {
  return one.app === other.app && one.kind === other.kind && one.key === other.key && one.due === other.due
}

/**
 * The movement kinds money in or out of your account can be on a loan running that way. Money you lent or paid for the
 * borrower goes out, and money repaid to you comes in. Money you borrowed comes in, and what you repay or pay for the lender
 * goes out. What the other person paid for something of yours moves none of your accounts, so no row is it.
 */
export function movementKindsFor(amount: AccountMoney, direction: LoanDirection): readonly MovementKind[] {
  const out = amount < 0
  if (direction === 'owed-to-you') return out ? ['borrowed', 'borrowed-in-kind'] : ['repaid']
  return out ? ['repaid', 'repaid-in-kind'] : ['borrowed']
}

/** Instalments fall due a month apart, so half a month either side of an entry's day finds the one it pays. Movements and extra payments are looked for as far. */
const NEAR_DAYS = 15

/** The targets within half a month of the day, nearest first. */
function nearest<Target>(targets: readonly Target[], day: CivilDate, dayOf: (target: Target) => CivilDate): readonly Target[] {
  return targets
    .map((target) => ({ target, away: Math.abs(daysBetween(day, dayOf(target))) }))
    .filter(({ away }) => away <= NEAR_DAYS)
    .sort((one, other) => one.away - other.away)
    .map(({ target }) => target)
}

/** Whether the row on the account can be the payment between your company and you: money the way the payment went, on a euro account whose IBAN the payment names. */
export function maybeCompanyPayment(row: Pick<Transaction, 'amount'>, account: Pick<Account, 'currency' | 'iban'>, target: OwnerPaymentTarget): boolean {
  const iban = normaliseIban(account.iban)
  return account.currency === EURO && iban !== '' && iban === target.ownerIban && (target.direction === 'to-owner' ? row.amount > 0 : row.amount < 0)
}

/**
 * The records an entry can be linked to, each kind nearest its day first within half a month: for money out the instalments,
 * then the movements its money can be as `movementKindsFor` has it, then for money out of a euro account the extra payments,
 * then the payments between your company and you that `maybeCompanyPayment` lets it be.
 */
export function targetsFor<Target extends LinkTarget>(row: Pick<Transaction, 'date' | 'amount'>, account: Pick<Account, 'currency' | 'iban'>, targets: readonly Target[]): readonly Target[] {
  const { currency } = account
  const out = row.amount < 0
  const instalments = out ? targets.filter((target) => target.kind === 'instalment') : []
  const movements = targets.filter((target) => target.kind === 'movement' && movementKindsFor(row.amount, target.direction).includes(target.movement))
  const extraPayments = out && currency === EURO ? targets.filter((target) => target.kind === 'extra-payment') : []
  const payments = targets.filter((target) => target.kind === 'owner-payment' && maybeCompanyPayment(row, account, target))
  const dayOf = (target: Target): CivilDate => (target.kind === 'instalment' ? target.due : target.kind === 'informal-loan' ? row.date : target.day)
  return [...nearest(instalments, row.date, dayOf), ...nearest(movements, row.date, dayOf), ...nearest(extraPayments, row.date, dayOf), ...nearest(payments, row.date, dayOf)]
}
