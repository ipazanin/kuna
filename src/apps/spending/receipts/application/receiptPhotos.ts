import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** The folder beside the Spending file that holds the kept photos. */
export const RECEIPTS_FOLDER = 'Receipts'

/** Where a kept receipt photo goes. */
export interface ReceiptPhotos {
  /** Uploads the photo as taken, and gives its file id. */
  keep(photo: File, issuedOn: CivilDate): Promise<string>
}
