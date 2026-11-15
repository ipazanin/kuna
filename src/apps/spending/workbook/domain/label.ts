import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A name that groups money across categories and months, such as a trip or a renovation. Items name the labels they carry. */
export interface Label {
  readonly id: RecordId
  readonly name: string
}
