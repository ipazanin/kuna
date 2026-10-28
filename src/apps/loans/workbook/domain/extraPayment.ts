import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the bank does after an extra payment: keep the instalment and end sooner, or keep the end and lower the instalment. */
export const EXTRA_PAYMENT_EFFECTS = ['shorter-term', 'lower-instalment'] as const

/** Principal paid back early, on top of the instalments. */
export interface ExtraPayment {
  readonly id: RecordId
  readonly loan: RecordId
  readonly date: CivilDate
  readonly amount: Money
  readonly effect: (typeof EXTRA_PAYMENT_EFFECTS)[number]
}
