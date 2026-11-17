import type { OwnerMoneyKind as PublishedKind, OwnerPayment as PublishedPayment } from '../../packContribution'
import type { OwnerPayment } from '../domain/ownerPayments'
import type { OwnerMoneyKind } from '../domain/packRoles'

/** The published kind of each of the pack's kinds, which core reads without the pack's role words. */
const PUBLISHED_KINDS = {
  salary: 'net-salary',
  rent: 'rent',
  dividend: 'dividend',
  'owner-loan': 'owner-loan',
  reimbursement: 'cost-refund',
  other: 'other',
} as const satisfies Record<Exclude<OwnerMoneyKind['kind'], 'tax-free'>, Exclude<PublishedKind['kind'], 'tax-free'>>

/** The payments between the company and the owner as the pack publishes them to core. */
export function publishedOwnerPayments(payments: readonly OwnerPayment[]): PublishedPayment[] {
  return payments.map((payment) => ({
    ...payment,
    parts: payment.parts.map((part) => (part.kind === 'tax-free' ? part : { kind: PUBLISHED_KINDS[part.kind], amount: part.amount })),
  }))
}
