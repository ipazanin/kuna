import type { RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../calendar/civilDate'
import type { Money } from '../money/money'
import type { PublishedLinkTarget } from './rowLinks'

/** A bank loan's instalment, or its interest before the first instalment, as another app reads it: when it falls due and what of it you pay, as interest and as principal. */
export interface PublishedInstalment {
  /** Interim interest is all interest. */
  readonly kind: 'instalment' | 'interim-interest'
  /** The loan's bare UUID. */
  readonly loan: string
  readonly loanName: string
  /** The bank the loan is from, as you typed it, which may be blank. */
  readonly lender: string
  /** The instalment's number in the plan counting from 1, null for interim interest. */
  readonly number: number | null
  /** How many instalments the plan has. */
  readonly count: number
  readonly due: CivilDate
  /** What you pay of it, the subsidy left out, which is your interest and your principal together. */
  readonly yourShare: Money
  readonly interest: Money
  readonly principal: Money
  /** What a row that pays it names. */
  readonly link: PublishedLinkTarget
  readonly to: RouteLocationRaw
}

/** What happened on an informal loan: money borrowed or repaid, in money or by paying something of the other's, or let go. */
export type PublishedMovementKind = 'borrowed' | 'borrowed-in-kind' | 'repaid' | 'repaid-in-kind' | 'forgiven'

/** One dated change to what an informal loan owes, as another app reads it. */
export interface PublishedMovement {
  readonly day: CivilDate
  readonly kind: PublishedMovementKind
  /** Above zero. The kind gives its direction. */
  readonly amount: Money
  readonly note: string
  readonly link: PublishedLinkTarget
}

/** Money owed between people, as another app reads it: who it is with, which way it runs and its movements. */
export interface PublishedInformalLoan {
  /** The loan's bare UUID. */
  readonly key: string
  readonly name: string
  readonly counterparty: string
  readonly direction: 'you-owe' | 'owed-to-you'
  readonly movements: readonly PublishedMovement[]
  readonly link: PublishedLinkTarget
  readonly to: RouteLocationRaw
}

/** Principal paid back early on a bank loan, as another app reads it. */
export interface PublishedExtraPayment {
  readonly loanName: string
  readonly day: CivilDate
  readonly amount: Money
  readonly link: PublishedLinkTarget
  readonly to: RouteLocationRaw
}

/** What a payment in another app may name in a loans app: each instalment and interim interest of a bank loan whose plan can be worked out, each extra payment, and each informal loan with its movements. */
export interface PublishedLoanTargets {
  readonly instalments: readonly PublishedInstalment[]
  readonly extraPayments: readonly PublishedExtraPayment[]
  readonly informalLoans: readonly PublishedInformalLoan[]
}

/** An app's loan records a payment may name, a wait while its file opens, a failure, or null while the app is not set up. */
export type AppLoanTargets = PublishedLoanTargets | 'opening' | 'failed' | null

/** The loan records one app publishes, under the app's id. */
export interface LoanTargetsOfApp {
  readonly app: string
  readonly targets: AppLoanTargets
}
