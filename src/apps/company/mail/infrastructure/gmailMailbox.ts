import { backoff, googleFetch, isRateLimited } from '../../../../shared/google/googleApi'
import { MailRateLimited } from '../application/mailFiling'
import type { Mailbox } from '../application/mailFiling'
import type { MailAttachment } from '../domain/mailSource'

const GMAIL_MESSAGES_API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages'

/** The most ids `messages.list` gives in one page. */
const PAGE_SIZE = '500'

/** A part of a message as `messages.get` gives it in its full format: a file has a name and an attachment id, and a multipart part holds more parts. */
interface MessagePart {
  readonly filename?: string
  readonly headers?: readonly { readonly name: string; readonly value: string }[]
  readonly body?: { readonly attachmentId?: string }
  readonly parts?: readonly MessagePart[]
}

function attachmentsOf(part: MessagePart): MailAttachment[] {
  const own = part.filename !== undefined && part.filename !== '' && part.body?.attachmentId !== undefined ? [{ id: part.body.attachmentId, name: part.filename }] : []
  return [...own, ...(part.parts ?? []).flatMap(attachmentsOf)]
}

/** Gmail's base64url, without padding, as bytes. */
function bytesOfBase64Url(data: string): ArrayBuffer {
  const binary = atob(data.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

/** How many times a call Gmail asked to slow down is sent again before the step gives up. */
const RETRIES = 5

function pauseFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * Gmail v1 with a `gmail.readonly` token. It only reads: no label, mark or move is ever asked for.
 * A call Gmail answers with a rate limit waits by Google's backoff and is sent again, up to five
 * times, then throws `MailRateLimited`.
 */
export function gmailMailbox(accessToken: string, pause: (milliseconds: number) => Promise<void> = pauseFor): Mailbox {
  async function patiently(url: string): Promise<Response> {
    for (let retry = 0; ; retry += 1) {
      try {
        return await googleFetch(url, accessToken)
      } catch (failure) {
        if (!isRateLimited(failure)) throw failure
        if (retry === RETRIES) throw new MailRateLimited()
        await pause(backoff(retry))
      }
    }
  }

  return {
    async search(query, pageToken) {
      const parameters = new URLSearchParams({ q: query, maxResults: PAGE_SIZE })
      if (pageToken !== null) parameters.set('pageToken', pageToken)
      const page = (await (await patiently(`${GMAIL_MESSAGES_API}?${parameters}`)).json()) as { messages?: { id: string }[]; nextPageToken?: string }
      return { ids: (page.messages ?? []).map((message) => message.id), next: page.nextPageToken ?? null }
    },

    async message(id) {
      const message = (await (await patiently(`${GMAIL_MESSAGES_API}/${encodeURIComponent(id)}?format=full`)).json()) as { id: string; internalDate: string; payload: MessagePart }
      const subject = message.payload.headers?.find((header) => header.name.toLowerCase() === 'subject')?.value ?? ''
      return { id: message.id, subject, date: Number(message.internalDate), attachments: attachmentsOf(message.payload) }
    },

    async attachment(messageId, attachmentId) {
      const response = await patiently(`${GMAIL_MESSAGES_API}/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`)
      return bytesOfBase64Url(((await response.json()) as { data: string }).data)
    },
  }
}
