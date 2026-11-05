import type { CivilDate } from '../../calendar/civilDate'
import { fold } from '../../text/fold'
import { strippedSubject, yearFolderName } from './mailSource'
import type { AttachmentNaming, MailAttachment } from './mailSource'

/** A bank's PDF that names its statement day as `IZV_2026_08_04`, as Croatian banks name their statement files. */
const DATED_STATEMENT = /IZV_(\d{4})_(\d{2})_(\d{2})/

/** The number after the phrase wherever the subject carries it, as "ERSTE Izvadak 004, ..." does for the phrase Izvadak. */
function statementNumber(subject: string, phrase: string): string | undefined {
  const folded = fold(strippedSubject(subject))
  const at = folded.indexOf(fold(phrase))
  return at === -1 ? undefined : /^\s+(\d+)/.exec(folded.slice(at + fold(phrase).length))?.[1]
}

/**
 * Where a statement PDF goes. With the statement day in its name and the statement number after
 * the subject phrase, such as "Izvadak 004", it is `<day>-statement-004.pdf` in that day's year
 * folder. Any other PDF keeps the bank's own name behind the day the mail came, in that day's year.
 */
export function statementPdfNaming(attachment: MailAttachment, subject: string, phrase: string, mailDay: CivilDate, folder: readonly string[]): AttachmentNaming {
  const dated = DATED_STATEMENT.exec(attachment.name)
  const number = statementNumber(subject, phrase)
  if (dated !== null && number !== undefined) {
    const day = `${dated[1]}-${dated[2]}-${dated[3]}`
    return { kind: 'named', attachment, folders: [yearFolderName(dated[1]!, folder)], name: `${day}-statement-${number.padStart(3, '0')}.pdf`, redelivery: null }
  }
  return { kind: 'named', attachment, folders: [yearFolderName(mailDay.slice(0, 4), folder)], name: `${mailDay}-${attachment.name}`, redelivery: null }
}
