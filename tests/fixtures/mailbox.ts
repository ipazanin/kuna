import { MailRateLimited } from '../../src/shared/mail/application/mailReading'
import type { Mailbox } from '../../src/shared/mail/application/mailReading'
import { fold } from '../../src/shared/text/fold'

/** A mail as a test writes it: an ISO time, and each attachment's name with the text its bytes are. */
export interface TestMail {
  readonly id: string
  readonly subject: string
  readonly at: string
  readonly attachments: readonly (readonly [name: string, content: string])[]
}

/**
 * A mailbox that answers a search with the mails whose subject holds its phrase and that came after
 * its window, `pageSize` ids a page, in the order Gmail gives them, newest first. It records the
 * queries, the mails read and which attachments were downloaded. With `rateLimited` every search
 * throws as Gmail still asking to slow down.
 */
export function testMailbox(mails: readonly TestMail[], pageSize = 500, rateLimited = false): Mailbox & { readonly queries: string[]; readonly reads: string[]; readonly downloads: string[] } {
  const queries: string[] = []
  const reads: string[] = []
  const downloads: string[] = []
  const newestFirst = [...mails].sort((first, second) => Date.parse(second.at) - Date.parse(first.at))
  return {
    queries,
    reads,
    downloads,
    async search(query, pageToken) {
      queries.push(query)
      if (rateLimited) throw new MailRateLimited()
      const start = pageToken === null ? 0 : Number(pageToken)
      const phrase = fold(/subject:"([^"]*)"/.exec(query)?.[1] ?? '')
      const after = Number(/after:(\d+)/.exec(query)?.[1] ?? 0) * 1000
      const ids = newestFirst.filter((mail) => fold(mail.subject).includes(phrase) && Date.parse(mail.at) > after).map((mail) => mail.id)
      return { ids: ids.slice(start, start + pageSize), next: start + pageSize < ids.length ? String(start + pageSize) : null }
    },
    async message(id) {
      reads.push(id)
      const mail = mails.find((candidate) => candidate.id === id)!
      return { id, subject: mail.subject, date: Date.parse(mail.at), attachments: mail.attachments.map(([name], index) => ({ id: `${id}/${index}`, name })) }
    },
    async attachment(messageId, attachmentId) {
      downloads.push(attachmentId)
      const mail = mails.find((candidate) => candidate.id === messageId)!
      const content = mail.attachments[Number(attachmentId.split('/')[1])]![1]
      return new TextEncoder().encode(content).buffer as ArrayBuffer
    },
  }
}
