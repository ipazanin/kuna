import type { RouteLocationRaw } from 'vue-router'

import { addExtraPayment, addMovement, publishedLoanTargets } from '../../../loans/facts'
import type { PublishedLoanTargets } from '../../../loans/facts'
import type { AppTargets, ExtraPaymentEffect, ExtraPaymentTarget, InformalLoanTarget, InstalmentTarget, LinkTarget, MovementKind, MovementTarget } from '../domain/linkTarget'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'

/** A record in Loans as Spending shows it on a row, with its page in Loans. */
export type ShownTarget = LinkTarget & { readonly to: RouteLocationRaw }

/** The instalments, extra payments, movements and informal loans Loans publishes, as Spending reads them, each with the link Loans gives it. */
export function loanTargetsFrom(published: PublishedLoanTargets): readonly ShownTarget[] {
  return [
    ...published.instalments.map(({ kind, link, loanName, lender, number, count, due, yourShare, interest, principal, to }): ShownTarget => ({
      kind: 'instalment',
      interim: kind === 'interim-interest',
      link,
      loanName,
      lender,
      number,
      count,
      due,
      yourShare,
      interest,
      principal,
      to,
    })),
    ...published.extraPayments.map(({ link, loanName, day, amount, to }): ShownTarget => ({ kind: 'extra-payment', link, loanName, day, amount, to })),
    ...published.informalLoans.flatMap(({ link, name, counterparty, direction, movements, to }): ShownTarget[] => [
      { kind: 'informal-loan', link, name, counterparty, direction, to },
      ...movements.map((movement): ShownTarget => ({
        kind: 'movement',
        link: movement.link,
        loan: link,
        loanName: name,
        counterparty,
        direction,
        day: movement.day,
        movement: movement.kind,
        amount: movement.amount,
        to,
      })),
    ]),
  ]
}

/** The records of the Loans file on screen that a row can link to, a wait while it opens, a failure, or null while Loans is not set up. */
export function loanTargets(): AppTargets<ShownTarget> {
  const published = publishedLoanTargets()
  return published === null || typeof published === 'string' ? published : loanTargetsFrom(published)
}

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
