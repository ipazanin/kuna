import type { PaymentSplit } from '../domain/loanFigures'

/**
 * The token a subsidy's key takes: the interest colour when it only ever pays interest, the
 * principal colour when it only pays principal, and the neutral one when it pays both.
 */
export function subsidyColourOf(split: Pick<PaymentSplit, 'subsidyPrincipal' | 'subsidyInterest'>): string {
  if (split.subsidyPrincipal === 0) return 'var(--loan-interest)'
  if (split.subsidyInterest === 0) return 'var(--loan-principal)'
  return 'var(--chart-deemphasis)'
}
