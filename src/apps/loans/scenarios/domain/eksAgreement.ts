import { percentagePoints } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'

/** How far Kuna's EKS estimate may stray from the one the bank printed, in percentage points, before the offer is warned about. */
const EKS_TOLERANCE_POINTS = 0.1

/** Whether Kuna's EKS estimate and the bank's printed EKS tell the same story, or what lies between them. */
export type EksAgreement =
  { readonly kind: 'agrees' } | { readonly kind: 'differs'; readonly estimated: YearlyRate; readonly printed: YearlyRate; readonly points: number } | { readonly kind: 'not-compared' }

/** Kuna's estimate against the printed EKS, which agree within 0.1 percentage points either way. Nothing is compared while either is missing. */
export function eksAgreement(estimated: YearlyRate | null, printed: YearlyRate | null): EksAgreement {
  if (estimated === null || printed === null) {
    return { kind: 'not-compared' }
  }
  const points = percentagePoints(estimated - printed)
  return points > EKS_TOLERANCE_POINTS ? { kind: 'differs', estimated, printed, points } : { kind: 'agrees' }
}
