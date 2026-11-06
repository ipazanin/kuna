import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** Where a kept receipt photo goes. */
export interface ReceiptPhotos {
  /** Uploads the photo as taken, and gives its file id. */
  keep(photo: File, issuedOn: CivilDate): Promise<string>
}
