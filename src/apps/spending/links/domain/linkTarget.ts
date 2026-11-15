import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { EURO } from '../../../../shared/money/currencyCode'
import type { Money } from '../../../../shared/money/money'
import type { RowLink } from '../../workbook/domain/rowLink'
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

/** A record in another app that a row can be. */
export type LinkTarget = InstalmentTarget | InformalLoanTarget | MovementTarget | ExtraPaymentTarget

/** An app's targets, a wait while its file opens, a failure, or null while the app is not set up on this device. */
export type AppTargets<Target> = readonly Target[] | 'opening' | 'failed' | null

/** What a row's link reads as: the record it names, or why that record cannot be shown. A row whose target is not there counts by its category as any row does. */
export type LinkState<Target> =
  { readonly state: 'there'; readonly target: Target } | { readonly state: 'opening' } | { readonly state: 'failed' } | { readonly state: 'not-set-up' } | { readonly state: 'gone' }

/** The record a link names among the targets Loans publishes, each naming itself, or why it is not there. A link no target names reads as gone. */
export function linkStateOf<Target extends { readonly link: RowLink }>(link: RowLink, targets: AppTargets<Target>): LinkState<Target> {
  if (targets === null) return { state: 'not-set-up' }
  if (targets === 'opening' || targets === 'failed') return { state: targets }
  const target = targets.find((candidate) => sameRecord(candidate.link, link))
  return target === undefined ? { state: 'gone' } : { state: 'there', target }
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

/**
 * The records an entry can be linked to, each kind nearest its day first within half a month: for money out the instalments,
 * then the movements its money can be as `movementKindsFor` has it, then for money out of a euro account the extra payments.
 */
export function targetsFor<Target extends LinkTarget>(row: Pick<Transaction, 'date' | 'amount'>, currency: CurrencyCode, targets: readonly Target[]): readonly Target[] {
  const out = row.amount < 0
  const instalments = out ? targets.filter((target) => target.kind === 'instalment') : []
  const movements = targets.filter((target) => target.kind === 'movement' && movementKindsFor(row.amount, target.direction).includes(target.movement))
  const extraPayments = out && currency === EURO ? targets.filter((target) => target.kind === 'extra-payment') : []
  const dayOf = (target: Target): CivilDate => (target.kind === 'instalment' ? target.due : target.kind === 'informal-loan' ? row.date : target.day)
  return [...nearest(instalments, row.date, dayOf), ...nearest(movements, row.date, dayOf), ...nearest(extraPayments, row.date, dayOf)]
}
