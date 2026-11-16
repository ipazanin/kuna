import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A name that groups money across categories and months with no days of its own, such as a renovation. A stretch of days, such as a trip, is an event. Items name the labels they carry. */
export interface Label {
  readonly id: RecordId
  readonly name: string
}
