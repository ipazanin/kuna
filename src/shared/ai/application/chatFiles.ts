import { bytesOfBase64 } from '../../text/base64'
import type { AiImagePart } from '../domain/aiPart'
import { attachRefusal, attachmentKindOf, pagesRefusal } from '../domain/chatAttachments'
import type { AttachmentRefusal, ChatAttachment } from '../domain/chatAttachments'

/**
 * A file a person attached to the chat, read on this device into what may wait on the prompt, or why it may not. A photo
 * is downscaled by `downscaled`, which needs a page to draw on, and a PDF's pages are counted here. Nothing leaves.
 */
export async function attachedFile(file: File, id: string, waiting: number, downscaled: (photo: Blob) => Promise<AiImagePart>): Promise<ChatAttachment | AttachmentRefusal> {
  const kind = attachmentKindOf(file.name, file.type)
  const refusal = attachRefusal(kind, file.size, waiting)
  if (refusal !== null || kind === null) return refusal ?? { reason: 'unknown-kind' }
  const read = { id, kind, name: file.name, original: file }
  if (kind === 'photo') {
    try {
      const photo = await downscaled(file)
      return { ...read, bytes: bytesOfBase64(photo.base64), pages: 1, sent: { width: photo.width, height: photo.height } }
    } catch {
      return { reason: 'unreadable' }
    }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (kind !== 'pdf') return { ...read, bytes, pages: 1, sent: null }
  const reading = await (await import('../infrastructure/pdfPages')).pdfPages(bytes)
  if ('refused' in reading) return { reason: reading.refused }
  return pagesRefusal(reading.pages) ?? { ...read, bytes, pages: reading.pages, sent: null }
}
