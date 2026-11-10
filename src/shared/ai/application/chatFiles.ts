import { bytesOfBase64 } from '../../text/base64'
import type { AiImagePart } from '../domain/aiPart'
import { attachRefusal, attachmentKindOf, cellReadsOf, pagesRefusal } from '../domain/chatAttachments'
import type { AttachmentKind, AttachmentReading, AttachmentRefusal, ChatAttachment } from '../domain/chatAttachments'

/** A file of cells read into its sheets, or why it is refused. It is checked before it is parsed. */
async function cellsOf(kind: AttachmentKind, bytes: Uint8Array): Promise<AttachmentReading | AttachmentRefusal> {
  const grids = await import('../infrastructure/fileGrids')
  if (grids.unsafeToRead(kind, bytes)) return { reason: 'unsafe' }
  try {
    const sheets = await grids.cellSheetsOf(kind, bytes)
    return { kind: 'cells', sheets, characters: JSON.stringify(sheets).length, reads: cellReadsOf(sheets) }
  } catch {
    return { reason: 'unreadable' }
  }
}

/**
 * A file a person attached to the chat, read on this device into what may wait on the prompt, or why it may not. A photo
 * is downscaled by `downscaled`, which needs a page to draw on, and a PDF's pages are counted here. Any other file is read
 * as cells. Nothing leaves.
 */
export async function attachedFile(file: File, id: string, waiting: number, downscaled: (photo: Blob) => Promise<AiImagePart>): Promise<ChatAttachment | AttachmentRefusal> {
  const kind = attachmentKindOf(file.name, file.type)
  const refusal = attachRefusal(kind, file.size, waiting)
  if (refusal !== null || kind === null) return refusal ?? { reason: 'unknown-kind' }
  const read = { id, kind, name: file.name, original: file }
  if (kind === 'photo') {
    try {
      const photo = await downscaled(file)
      return { ...read, bytes: bytesOfBase64(photo.base64), pages: 1, sent: { width: photo.width, height: photo.height }, reading: { kind: 'whole' } }
    } catch {
      return { reason: 'unreadable' }
    }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (kind === 'pdf') {
    const reading = await (await import('../infrastructure/pdfPages')).pdfPages(bytes)
    if ('refused' in reading) return { reason: reading.refused }
    return pagesRefusal(reading.pages) ?? { ...read, bytes, pages: reading.pages, sent: null, reading: { kind: 'whole' } }
  }
  const reading = await cellsOf(kind, bytes)
  return 'reason' in reading ? reading : { ...read, bytes, pages: 1, sent: null, reading }
}
