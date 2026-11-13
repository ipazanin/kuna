import type { UpcomingPayment } from '../domain/loansTogether'
import type { BankLoan } from '../../workbook/domain/bankLoan'

/** What a payment is called in Croatian: an annuity loan's, an equal principal loan's or an informal loan's. */
export type PaymentKind = BankLoan['repayment'] | 'informal'

export function paymentKindOf(payment: UpcomingPayment): PaymentKind {
  return payment.kind === 'bank' ? payment.loan.repayment : 'informal'
}

/** The one kind every payment in the list is, or mixed when the list holds several, or none. */
export function commonPaymentKind(payments: readonly UpcomingPayment[]): PaymentKind | 'mixed' {
  const [first] = payments.map(paymentKindOf)
  return first !== undefined && payments.every((payment) => paymentKindOf(payment) === first) ? first : 'mixed'
}

/** English words that read the same for both repayments of a bank loan. */
export function forEachRepayment<Words>(words: Words): Readonly<Record<BankLoan['repayment'], Words>> {
  return { annuity: words, 'equal-principal': words }
}

/** English words that read the same for every kind of payment. */
export function forEachPaymentKind<Words>(words: Words): Readonly<Record<PaymentKind, Words>> {
  return { ...forEachRepayment(words), informal: words }
}

/** English words that read the same for every kind of payment and for a list that mixes them. */
export function forEachPaymentKindOrMixed<Words>(words: Words): Readonly<Record<PaymentKind | 'mixed', Words>> {
  return { ...forEachPaymentKind(words), mixed: words }
}
