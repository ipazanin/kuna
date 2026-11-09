import { bytesOfBase64 } from '../../text/base64'
import type { AiImagePart } from '../domain/aiPart'
import { attachRefusal, attachmentKindOf, pagesRefusal } from '../domain/chatAttachments'
import type { AttachedFile, AttachmentReading, AttachmentRefusal, ChatAttachment, FormatFound } from '../domain/chatAttachments'

/**
 * How a file of cells is read once no app's reader takes it, or why it is refused. A reader that fails, such as one whose
 * code did not load, refuses the file, since a file in a format Kuna reads must never go as cells.
 */
async function readingOf(file: AttachedFile, formatOf: (file: AttachedFile) => Promise<FormatFound>): Promise<AttachmentReading | AttachmentRefusal> {
  const grids = await import('../infrastructure/fileGrids')
  if (grids.unsafeToRead(file.kind, file.bytes)) return { reason: 'unsafe' }
  let format: FormatFound
  try {
    format = await formatOf(file)
  } catch {
    return { reason: 'unreadable' }
  }
  if (format === 'books-opening') return { reason: 'books-opening' }
  if (format !== 'none') return { kind: 'kuna', format }
  try {
    const sheets = await grids.cellSheetsOf(file.kind, file.bytes)
    return { kind: 'cells', sheets, characters: JSON.stringify(sheets).length }
  } catch {
    return { reason: 'unreadable' }
  }
}

/**
 * A file a person attached to the chat, read on this device into what may wait on the prompt, or why it may not. A photo
 * is downscaled by `downscaled`, which needs a page to draw on, and a PDF's pages are counted here. Any other file is
 * checked before it is parsed, offered to each app's reader, and read as cells when none takes it. Nothing leaves.
 */
export async function attachedFile(
  file: File,
  id: string,
  waiting: number,
  downscaled: (photo: Blob) => Promise<AiImagePart>,
  formatOf: (file: AttachedFile) => Promise<FormatFound>,
): Promise<ChatAttachment | AttachmentRefusal> {
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
  const reading = await readingOf({ kind, name: file.name, bytes }, formatOf)
  return 'reason' in reading ? reading : { ...read, bytes, pages: 1, sent: null, reading }
}
