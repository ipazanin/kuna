import { base64OfBytes } from '../../text/base64'
import { pageRangeOf, pageRangeText, pdfPartOf, sendsToModel } from '../domain/chatAttachments'
import type { ChatAttachment, PageRangeRefusal } from '../domain/chatAttachments'
import { refusal } from './chatReads'
import type { ChatToolAnswer } from './chatReads'

/** What `read_attachment` asks for: a file attached to this chat by its id, and the pages of a PDF, or null for all of them. */
export interface AttachmentRead {
  readonly attachment: string
  readonly pages: string | null
}

function rangeRefusal(refused: PageRangeRefusal): string {
  switch (refused.reason) {
    case 'not-a-range':
      return 'Pages read as "2" or "1-3", or null for all of them.'
    case 'outside':
      return `That file has ${refused.pages} pages.`
    default:
      return `One read takes at most ${refused.most} pages. Ask for them by range, such as "1-${refused.most}".`
  }
}

/**
 * Hands the model a photo or the pages of a PDF attached to this chat, whole, named only by its id. The pages always go as
 * a copy, so the file's metadata and open action stay behind. A sheet, XML or CSV never goes: Kuna reads it with the app's
 * own reader, through an operation that names it.
 */
export async function readAttachment(input: AttachmentRead, held: readonly ChatAttachment[], readsPdf: boolean): Promise<ChatToolAnswer> {
  const attachment = held.find((candidate) => candidate.id === input.attachment)
  if (attachment === undefined) return refusal('That is not the id of a file attached to this chat. Take it from the context line.')
  if (!sendsToModel(attachment.kind)) return refusal('Kuna reads a file of this kind itself and never sends it. Propose the operation that takes it, with its id.')
  const about = { attachment: attachment.id, kind: attachment.kind, untrusted: true }
  if (attachment.kind === 'photo') {
    if (input.pages !== null) return refusal('A photo has no pages, so pages is null.')
    if (attachment.sent === null) return refusal('Kuna could not read that photo. Ask the person to attach it again.')
    return {
      text: JSON.stringify(about),
      isError: false,
      read: { kind: 'document', name: attachment.name, pages: null },
      parts: [{ kind: 'image', mediaType: 'image/jpeg', base64: base64OfBytes(attachment.bytes), width: attachment.sent.width, height: attachment.sent.height }],
    }
  }
  if (!readsPdf) return refusal('This AI company does not read PDFs. Say so, and ask the person to attach a photo of each page or paste the text.')
  const range = pageRangeOf(input.pages, attachment.pages)
  if ('reason' in range) return refusal(rangeRefusal(range))
  let bytes: Uint8Array
  try {
    bytes = await (await import('../infrastructure/pdfPages')).pdfPagesCut(attachment.bytes, range)
  } catch {
    return refusal('Kuna could not read those pages of the file. Say so.')
  }
  return {
    text: JSON.stringify({ ...about, pages: pageRangeText(range), of: attachment.pages }),
    isError: false,
    read: { kind: 'document', name: attachment.name, pages: range },
    parts: [pdfPartOf(attachment, base64OfBytes(bytes))],
  }
}
