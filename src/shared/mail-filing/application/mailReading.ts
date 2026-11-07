import { GMAIL_AT_ONCE, eachAtMost, searchAll } from './mailFiling'
import type { Mailbox } from './mailFiling'
import type { MailAttachment, MailMessage } from '../domain/mailSource'

/** One attachment of a mail a search found, with its bytes fetched only if asked for. */
export interface MailFileToRead {
  readonly message: MailMessage
  readonly attachment: MailAttachment
  bytes(): Promise<ArrayBuffer>
}

/**
 * What a source makes of each mail a search finds, oldest mail first, with no mail marked or moved and nothing filed. It
 * reads attachments only, as every mail search asks for a mail with one, so a mail with a link instead is never found.
 */
export async function readMail<Read>(mailbox: Mailbox, query: string, read: (message: MailMessage, files: readonly MailFileToRead[]) => Promise<Read>): Promise<readonly Read[]> {
  const messages = await eachAtMost(await searchAll(mailbox, query), GMAIL_AT_ONCE, (id) => mailbox.message(id))
  const oldestFirst = messages.sort((first, second) => first.date - second.date || first.id.localeCompare(second.id))
  return eachAtMost(oldestFirst, GMAIL_AT_ONCE, (message) =>
    read(
      message,
      message.attachments.map((attachment) => ({ message, attachment, bytes: () => mailbox.attachment(message.id, attachment.id) })),
    ),
  )
}
