import { yearFolderName } from '../../../../shared/mail-filing/domain/mailSource'
import type { AttachmentNaming, MailAttachment } from '../../../../shared/mail-filing/domain/mailSource'

/**
 * Where a camt statement goes, named by its label and the account the books give its IBAN, as
 * `<label>-<account>.xml` in the label's year folder, or `<label>.xml` for an IBAN no account has.
 * A file whose name ends in the same statement number and account is the same statement, since a
 * redelivery a day later carries another day in its label.
 */
export function statementXmlNaming(attachment: MailAttachment, head: { readonly label: string; readonly account: string }, folder: readonly string[]): AttachmentNaming {
  const name = `${head.label}${head.account === '' ? '' : `-${head.account}`}.xml`
  return { kind: 'named', attachment, folders: [yearFolderName(head.label.slice(0, 4), folder)], name, redelivery: name.slice(name.indexOf('-statement-')) }
}
