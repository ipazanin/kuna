import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { EventChoice } from './event'

/**
 * Money several rows make together, such as a gift you paid for in three shops and two friends paid back their share of. Its rows
 * are filed under In a shared cost and count nowhere, and it counts their sum on its own day, under its own payee and category.
 */
export interface SharedCost {
  readonly id: RecordId
  /** The day it counts on, whatever the days of its rows. */
  readonly day: CivilDate
  /** Who it counts under, as a payee record or a row names them, or blank for none. */
  readonly payee: string
  /** A spending or an income category, never a fixed one. */
  readonly category: RecordId
  readonly labels: readonly RecordId[]
  /** Whether it joins an event by its day, was put in one by hand, or was taken out of every event. */
  readonly event: EventChoice
  readonly note: string
  /** Settled once nobody owes anything more on it. It changes nothing it counts. */
  readonly settled: boolean
}
