import type { PlanRow } from './loanPlan'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { absMoney, moneyFromCents, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** How far Kuna's instalment may stray from the one the bank printed before the card warns. A cent, until a real contract shows how banks round. */
const INSTALMENT_TOLERANCE = moneyFromCents(1)

/** Whether Kuna's instalment and the printed one agree within the tolerance, and both figures when they do not. */
export type InstalmentAgreement = { readonly kind: 'agrees' } | { readonly kind: 'differs'; readonly planned: Money; readonly printed: Money } | { readonly kind: 'not-compared' }

/** What the bank receives on the plan's first instalment due on or after `from`, before any subsidy, or null when none is left by then. */
export function instalmentFrom(rows: readonly PlanRow[], from: CivilDate): Money | null {
  return rows.find((row) => row.kind === 'instalment' && row.date >= from)?.payment ?? null
}

/** Kuna's instalment against the printed one, which agree within a cent either way. Nothing is compared while either is missing. */
export function instalmentAgreement(planned: Money | null, printed: Money | null): InstalmentAgreement {
  if (planned === null || printed === null) return { kind: 'not-compared' }
  return absMoney(subtractMoney(planned, printed)) > INSTALMENT_TOLERANCE ? { kind: 'differs', planned, printed } : { kind: 'agrees' }
}
