import { civilDateIn } from '../../../shared/calendar/civilDate'
import { accountsByIban } from '../../imports/application/importStatements'
import type { LoadedImportFile } from '../../imports/application/importStatements'
import { camtStatementHead } from '../../imports/domain/camtStatement'
import { statementPdfNaming, statementXmlNaming } from '../domain/statementMailFiling'
import type { AttachmentNaming } from '../domain/mailSource'
import type { MailSource } from './mailFiling'

/**
 * The bank's statement mail, which the statements step then reads from the statements folder. A
 * PDF is named by its rule, and a camt XML is read as Import reads it and named by its label and
 * the account the books give its IBAN. Any other attachment, such as the HTML copy the bank mails
 * beside each PDF, is passed over. `timeZone` is this device's, which the day of a mail is read in.
 */
export function statementMailSource(load: (fileName: string, bytes: ArrayBuffer) => Promise<LoadedImportFile>, timeZone: string): MailSource {
  return {
    id: 'statements',
    label: 'Bank statements',
    duplicates: 'redelivery',
    terms: (workbook) => {
      const { statementsMailFrom, statementsMailSubject, statementsFolder } = workbook.settings
      return statementsMailFrom.length === 0 || statementsMailSubject === '' ? null : { senders: statementsMailFrom, subject: statementsMailSubject, folder: statementsFolder }
    },
    name: (message, terms, reading) =>
      Promise.all(
        message.attachments.filter((attachment) => /\.(pdf|xml)$/i.test(attachment.name)).map(async (attachment): Promise<AttachmentNaming> => {
          if (/\.pdf$/i.test(attachment.name)) {
            return statementPdfNaming(attachment, message.subject, terms.subject, civilDateIn(message.date, timeZone), terms.folder)
          }
          const bytes = await reading.bytes(attachment)
          let loaded: LoadedImportFile
          try {
            loaded = await load(attachment.name, bytes)
          } catch (failure) {
            return { kind: 'unmatched', attachment, reason: failure instanceof Error ? failure.message : String(failure) }
          }
          const head = loaded.kind === 'camt' ? camtStatementHead(loaded.document, accountsByIban(reading.workbook)) : null
          return head === null ? { kind: 'unmatched', attachment, reason: 'It is not a camt.053 statement with a creation day and a number.' } : statementXmlNaming(attachment, head, terms.folder)
        }),
      ),
  }
}
