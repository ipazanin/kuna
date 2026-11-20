import { fold } from '../../../text/fold'
import { MailRateLimited } from '../../application/mailReading'
import type { Mailbox } from '../../application/mailReading'
import type { MailMessage } from '../../domain/mailSource'

const PAGE_SIZE = 3

/** One attachment of a fake mail, by the content the seed's `bytesOf` turns into its bytes. */
export interface FakeAttachment {
  readonly name: string
  readonly content: string
}

export interface FakeMail {
  readonly id: string
  readonly subject: string
  /** An ISO time. */
  readonly at: string
  readonly attachments: readonly FakeAttachment[]
  /** Whether `?fake=mail-nothing-new` keeps it, since the books already hold what it brings. */
  readonly filed: boolean
}

/** What the fake Gmail answers when `?fake=mail-failed` fails a search, in place of the answer Google would send. */
export const FAKE_SEARCH_FAILURE = 'Gmail did not answer the search. Sync again later'

/**
 * A fake Gmail over an app's made-up mail. It answers a search by its subject phrase and its window,
 * three ids a page, so a run reads more than one page. `?fake=mail-failed` fails the search for
 * `failingSearchPhrase`, and `?fake=mail-rate-limited` answers every search as Gmail still asking to
 * slow down after the retries.
 */
export function fakeMailboxOf(seed: { readonly mails: readonly FakeMail[]; readonly failingSearchPhrase: string; bytesOf(content: string): ArrayBuffer }, variant: string | null): Mailbox {
  const mails = seed.mails.filter((mail) => variant !== 'mail-nothing-new' || mail.filed)
  const byId = new Map(mails.map((mail) => [mail.id, mail]))
  return {
    async search(query, pageToken) {
      const phrase = /subject:"([^"]*)"/.exec(query)?.[1] ?? ''
      const after = Number(/after:(\d+)/.exec(query)?.[1] ?? '0') * 1000
      if (variant === 'mail-failed' && phrase === seed.failingSearchPhrase) {
        throw new Error(FAKE_SEARCH_FAILURE)
      }
      if (variant === 'mail-rate-limited') {
        throw new MailRateLimited()
      }
      const found = mails.filter((mail) => fold(mail.subject).includes(fold(phrase)) && Date.parse(mail.at) > after).map((mail) => mail.id)
      const start = pageToken === null ? 0 : Number(pageToken)
      return { ids: found.slice(start, start + PAGE_SIZE), next: start + PAGE_SIZE < found.length ? String(start + PAGE_SIZE) : null }
    },

    async message(id): Promise<MailMessage> {
      const mail = byId.get(id)
      if (mail === undefined) throw new Error(`The fake mailbox holds no mail ${id}.`)
      return { id, subject: mail.subject, date: Date.parse(mail.at), attachments: mail.attachments.map((attachment, index) => ({ id: `${id}-${index}`, name: attachment.name })) }
    },

    async attachment(messageId, attachmentId) {
      const attachment = byId.get(messageId)?.attachments[Number(attachmentId.slice(messageId.length + 1))]
      if (attachment === undefined) throw new Error(`The fake mailbox holds no attachment ${attachmentId}.`)
      return seed.bytesOf(attachment.content)
    },
  }
}
