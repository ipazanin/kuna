import { googleFetch } from '../../../shared/google/googleApi'
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

/** Gmail v1 with a `gmail.readonly` token. It only reads: no label, mark or move is ever asked for. */
export function gmailMailbox(accessToken: string): Mailbox {
  return {
    async search(query, pageToken) {
      const parameters = new URLSearchParams({ q: query, maxResults: PAGE_SIZE })
      if (pageToken !== null) parameters.set('pageToken', pageToken)
      const page = (await (await googleFetch(`${GMAIL_MESSAGES_API}?${parameters}`, accessToken)).json()) as { messages?: { id: string }[]; nextPageToken?: string }
      return { ids: (page.messages ?? []).map((message) => message.id), next: page.nextPageToken ?? null }
    },

    async message(id) {
      const message = (await (await googleFetch(`${GMAIL_MESSAGES_API}/${encodeURIComponent(id)}?format=full`, accessToken)).json()) as { id: string; internalDate: string; payload: MessagePart }
      const subject = message.payload.headers?.find((header) => header.name.toLowerCase() === 'subject')?.value ?? ''
      return { id: message.id, subject, date: Number(message.internalDate), attachments: attachmentsOf(message.payload) }
    },

    async attachment(messageId, attachmentId) {
      const response = await googleFetch(`${GMAIL_MESSAGES_API}/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, accessToken)
      return bytesOfBase64Url(((await response.json()) as { data: string }).data)
    },
  }
}
