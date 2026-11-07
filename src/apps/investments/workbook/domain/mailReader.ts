import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How a recipe's mail is found in this person's mailbox, and what they have said about its rows. */
export interface MailReader {
  readonly id: RecordId
  /** The recipe that reads the mail, by its id. */
  readonly recipe: string
  readonly on: boolean
  readonly senders: readonly string[]
  /** A phrase of the subject, blank for any. */
  readonly subject: string
  /** A phrase of the contents, blank for any. */
  readonly contents: string
  /** Rows dated before it are left out, so a file's overlap with what is already booked does not double it. */
  readonly since: CivilDate
  /** The keys of rows the person said to stop asking about. */
  readonly leftOut: readonly string[]
}
