import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

export const LOAN_DIRECTIONS = ['you-owe', 'owed-to-you'] as const

/** Money owed between people, with no interest and no plan: an opening balance and the movements after it. */
export interface InformalLoan {
  readonly id: RecordId
  readonly name: string
  readonly counterparty: string
  readonly direction: (typeof LOAN_DIRECTIONS)[number]
  readonly openingBalance: Money
  readonly start: CivilDate
  readonly note: string
}
