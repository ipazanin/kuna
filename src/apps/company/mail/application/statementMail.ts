import { readMail } from '../../../../shared/mail/application/mailReading'
import type { Mailbox, PlannedMail } from '../../../../shared/mail/application/mailReading'
import { mailQuery } from '../../../../shared/mail/domain/mailSource'
import type { MailSearch, MailWindow } from '../../../../shared/mail/domain/mailSource'
import { accountsByIban, statementReadings } from '../../imports/application/importStatements'
import type { LoadedImportFile } from '../../imports/application/importStatements'
import { camtStatementHead } from '../../imports/domain/camtStatement'
import type { StatementReading } from '../../imports/domain/importedStatement'
import type { Workbook } from '../../workbook/domain/workbook'
import { words } from './words'

/** What one attachment of the bank's mail gave: a statement by its label, an XML that is no statement with why, or a file the step passes over, such as the PDF beside each statement. */
export type StatementMailEntry = { readonly mail: PlannedMail; readonly attachment: string } & (
  { readonly kind: 'read'; readonly label: string } | { readonly kind: 'not-read'; readonly reason: string } | { readonly kind: 'passed-over' }
)

/** Which mail a statement came in, so a statement the sync holds is found again. */
export interface StatementMailOrigin {
  readonly mailId: string
  /** When the mail came, in epoch milliseconds. */
  readonly mailedAt: number
  readonly attachment: string
  readonly label: string
}

/** What one sync found in the bank's mail: where it searched, what each attachment gave, and the statements it read, each once with the mail it came in. */
export interface StatementMailPlan {
  readonly window: MailWindow
  readonly query: string
  readonly entries: readonly StatementMailEntry[]
  readonly readings: readonly StatementReading[]
  /** Where each reading came from, in the order of `readings`. */
  readonly origins: readonly StatementMailOrigin[]
}

/** An attachment read on an earlier sync of the page, or why it could not be. */
export type KnownAttachment = { readonly kind: 'loaded'; readonly file: LoadedImportFile } | { readonly kind: 'failed'; readonly reason: string }

export interface StatementMailPorts {
  readonly mailbox: Mailbox
  readonly search: MailSearch
  readonly window: MailWindow
  /** The books the statements are read against, which name the account of each IBAN. */
  readonly workbook: Pick<Workbook, 'accounts'>
  load(fileName: string, bytes: ArrayBuffer): Promise<LoadedImportFile>
  /** What an earlier sync of this page read of each attachment, by its mail and name, so a sync on a timer fetches it once. */
  readonly known: Map<string, KnownAttachment>
}

/**
 * Reads the bank's statement mail into statements, as Import reads a camt file, and files nothing on Drive. Each XML attachment
 * that holds a camt.053 statement is read, and one that does not is listed with why. Any other attachment, such as the PDF and
 * the HTML copy the bank mails beside each statement, is passed over. The bank mails each statement twice, so a statement of an
 * IBAN and number read from an earlier mail is not read again.
 */
export async function readStatementMail(ports: StatementMailPorts): Promise<StatementMailPlan> {
  const { mailbox, search, window, workbook, known } = ports
  const query = mailQuery(search, window)
  const ibans = accountsByIban(workbook)
  const perMail = await readMail(mailbox, query, (message, files) =>
    Promise.all(
      files.map(async ({ attachment, bytes }): Promise<{ readonly entry: StatementMailEntry; readonly readings: readonly MailedReading[] }> => {
        const at = { mail: { id: message.id, subject: message.subject, date: message.date }, attachment: attachment.name }
        if (!/\.xml$/i.test(attachment.name)) return { entry: { ...at, kind: 'passed-over' }, readings: [] }
        const seen = `${message.id}/${attachment.name}`
        const read = known.get(seen) ?? (await loaded(ports, attachment.name, await bytes()))
        known.set(seen, read)
        if (read.kind === 'failed') return { entry: { ...at, kind: 'not-read', reason: read.reason }, readings: [] }
        const head = read.file.kind === 'camt' ? camtStatementHead(read.file.document, ibans) : null
        if (head === null) return { entry: { ...at, kind: 'not-read', reason: words.statements.notCamt }, readings: [] }
        return {
          entry: { ...at, kind: 'read', label: head.label },
          readings: statementReadings(read.file, workbook, null).map((reading) => ({ reading, origin: originOf(message, attachment.name, reading) })),
        }
      }),
    ),
  )
  const found = perMail.flat()
  const once = eachOnce(found.flatMap(({ readings }) => readings))
  return { window, query, entries: found.map(({ entry }) => entry), readings: once.map(({ reading }) => reading), origins: once.map(({ origin }) => origin) }
}

/** A statement read from one attachment, with the mail it came in. */
interface MailedReading {
  readonly reading: StatementReading
  readonly origin: StatementMailOrigin
}

function originOf(message: PlannedMail, attachment: string, reading: StatementReading): StatementMailOrigin {
  return { mailId: message.id, mailedAt: message.date, attachment, label: 'statement' in reading ? reading.statement.label : reading.label }
}

async function loaded(ports: StatementMailPorts, fileName: string, bytes: ArrayBuffer): Promise<KnownAttachment> {
  try {
    return { kind: 'loaded', file: await ports.load(fileName, bytes) }
  } catch (failure) {
    return { kind: 'failed', reason: failure instanceof Error ? failure.message : String(failure) }
  }
}

/** The readings with a camt statement of an IBAN and number already read left out, since its rows are the same. */
function eachOnce(readings: readonly MailedReading[]): MailedReading[] {
  const seen = new Set<string>()
  return readings.filter(({ reading }) => {
    if (!('statement' in reading) || reading.statement.source.kind !== 'camt') return true
    const key = JSON.stringify([reading.statement.source.iban, reading.statement.source.sequence])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
