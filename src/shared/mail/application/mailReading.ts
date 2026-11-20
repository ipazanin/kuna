import type { MailAttachment, MailMessage } from '../domain/mailSource'
import { words } from './words'

/** Gmail still asking the app to slow down after it waited and tried again, which stops the step. */
export class MailRateLimited extends Error {
  constructor() {
    super(words.rateLimited)
    this.name = 'MailRateLimited'
  }
}

/** The mailbox, read only. The app never marks, labels or moves a mail. A call Gmail keeps asking to slow down throws `MailRateLimited`. */
export interface Mailbox {
  /** One page of the ids of the mail a search finds, and the token of the next page, or null after the last. */
  search(query: string, pageToken: string | null): Promise<{ readonly ids: readonly string[]; readonly next: string | null }>
  message(id: string): Promise<MailMessage>
  attachment(messageId: string, attachmentId: string): Promise<ArrayBuffer>
}

/** One mail as a list names it. */
export interface PlannedMail {
  readonly id: string
  readonly subject: string
  readonly date: number
}

/**
 * How many Gmail calls a step has in flight at once, which keeps it well under Gmail's per-user rate. It also reads this
 * many mails at once, since more would only wait for a turn.
 */
export const GMAIL_AT_ONCE = 10

/**
 * The work of each item, at most `count` at once, in the items' order. Once one fails no other
 * starts, and the first failure is thrown after the ones running end.
 */
export async function eachAtMost<Item, Result>(items: readonly Item[], count: number, work: (item: Item) => Promise<Result>): Promise<Result[]> {
  const results: Result[] = []
  const failures: unknown[] = []
  let next = 0
  async function worker(): Promise<void> {
    while (failures.length === 0 && next < items.length) {
      const index = next
      next += 1
      try {
        results[index] = await work(items[index]!)
      } catch (failure) {
        failures.push(failure)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, worker))
  if (failures.length > 0) throw failures[0]
  return results
}

export async function searchAll(mailbox: Mailbox, query: string): Promise<string[]> {
  const ids: string[] = []
  let page: string | null = null
  do {
    const found: { readonly ids: readonly string[]; readonly next: string | null } = await mailbox.search(query, page)
    ids.push(...found.ids)
    page = found.next
  } while (page !== null)
  return [...new Set(ids)]
}

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
