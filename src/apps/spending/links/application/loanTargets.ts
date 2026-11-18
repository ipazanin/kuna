import { addExtraPayment, addMovement } from '../../../loans/facts'
import type { ExtraPaymentEffect, ExtraPaymentTarget, InformalLoanTarget, InstalmentTarget, LinkTarget, MovementKind, MovementTarget } from '../domain/linkTarget'
import type { ShownTarget } from './linkTargets'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'

/** What a row adds to an informal loan in Loans. */
export interface NewMovement {
  readonly day: CivilDate
  readonly kind: MovementKind
  readonly amount: Money
  readonly note: string
}

/** A record added in Loans from a row, as Spending links to it, with the Undo of Loans' write. */
export interface AddedInLoans<Target extends LinkTarget> {
  readonly target: ShownTarget & Target
  undo(): Promise<void>
}

/** Adds the movement to the informal loan in Loans, under the title Spending gives the write. Throws with the reason when Loans refuses it. */
export async function addLoansMovement(loan: ShownTarget & InformalLoanTarget, movement: NewMovement, title: string): Promise<AddedInLoans<MovementTarget>> {
  const added = await addMovement({ loan: loan.link.key, day: movement.day, kind: movement.kind, amount: movement.amount, note: movement.note }, title)
  return {
    target: {
      kind: 'movement',
      link: added.link,
      loan: loan.link,
      loanName: loan.name,
      counterparty: loan.counterparty,
      direction: loan.direction,
      day: movement.day,
      movement: movement.kind,
      amount: movement.amount,
      to: loan.to,
    },
    undo: () => added.undo(),
  }
}

/** What a row adds to a bank loan in Loans as principal paid back early. */
export interface NewExtraPayment {
  readonly day: CivilDate
  readonly amount: Money
  readonly effect: ExtraPaymentEffect
}

/** Adds the extra payment to the bank loan whose instalment is given, under the title Spending gives the write. Throws with the reason when Loans refuses it. */
export async function addLoansExtraPayment(instalment: ShownTarget & InstalmentTarget, payment: NewExtraPayment, title: string): Promise<AddedInLoans<ExtraPaymentTarget>> {
  const added = await addExtraPayment({ loan: instalment.link.key, day: payment.day, amount: payment.amount, effect: payment.effect }, title)
  return {
    target: { kind: 'extra-payment', link: added.link, loanName: instalment.loanName, day: payment.day, amount: payment.amount, to: instalment.to },
    undo: () => added.undo(),
  }
}
