import { base64OfBytes } from '../../text/base64'
import { MOST_CHARACTERS_A_READ, MOST_PAGES_A_READ, MOST_ROWS_A_READ, pdfPartOf, readRangeOf, readRangeText } from '../domain/chatAttachments'
import type { CellSheet, ChatAttachment, ReadRangeRefusal } from '../domain/chatAttachments'
import { refusal } from './chatReads'
import type { ChatReads, ChatToolAnswer } from './chatReads'
import { cellsLeaving, fileTextLeaving } from './fileCells'

/** What `read_attachment` asks for: a file attached to this chat by its id, the pages of a PDF, and the sheet and rows of a file read as cells, each null for all or the first. */
export interface AttachmentRead {
  readonly attachment: string
  readonly pages: string | null
  readonly sheet: number | null
  readonly rows: string | null
}

function rangeRefusal(refused: ReadRangeRefusal, noun: 'pages' | 'rows'): string {
  switch (refused.reason) {
    case 'not-a-range':
      return `${noun === 'pages' ? 'Pages' : 'Rows'} read as "2" or "1-3", or null for all of them.`
    case 'outside':
      return `That ${noun === 'pages' ? 'file' : 'sheet'} has ${refused.count} ${noun}.`
    default:
      return `One read takes at most ${refused.most} ${noun}. Ask for them by range, such as "1-${refused.most}".`
  }
}

/** The rows of one sheet, each cell through Anonymise, refused past the rows or the characters one read takes, never cut to fit. The file's sheets are listed only on a read that names no rows. */
function cellsRead(attachment: ChatAttachment, sheets: readonly CellSheet[], input: AttachmentRead, reads: ChatReads): ChatToolAnswer {
  if (input.pages !== null) return refusal('A file read as cells has no pages, so pages is null. Ask for rows.')
  const number = input.sheet ?? 1
  const sheet = Number.isInteger(number) ? sheets[number - 1] : undefined
  if (sheet === undefined) return refusal(`That file has ${sheets.length} sheets, counted from 1.`)
  if (sheet.rows.length === 0) return refusal('That sheet is empty.')
  const range = readRangeOf(input.rows, sheet.rows.length, MOST_ROWS_A_READ)
  if ('reason' in range) return refusal(rangeRefusal(range, 'rows'))
  const leaving = cellsLeaving(sheet, range, reads)
  const index = input.rows === null ? { sheets: sheets.map((each, at) => ({ sheet: at + 1, name: each.name === null ? null : fileTextLeaving(each.name, reads), rows: each.rows.length })) } : {}
  const text = JSON.stringify({
    attachment: attachment.id,
    kind: attachment.kind,
    untrusted: true,
    sheet: number,
    ...index,
    rows: leaving.rows,
    range: readRangeText(range),
    of: sheet.rows.length,
    keysRemoved: leaving.keysRemoved,
  })
  if (text.length > MOST_CHARACTERS_A_READ) {
    if (range.first === range.last)
      return refusal(
        `Row ${range.first} alone comes to more than ${MOST_CHARACTERS_A_READ} characters, which one read takes at most, so Kuna cannot send it. Read the rows around it, and tell the person which row you could not read.`,
      )
    const fewer = Math.max(1, Math.floor(((range.last - range.first + 1) * MOST_CHARACTERS_A_READ) / text.length))
    return refusal(`Those rows come to more than ${MOST_CHARACTERS_A_READ} characters, which one read takes at most. Ask for fewer, such as "${range.first}-${range.first + fewer - 1}".`)
  }
  return { text, isError: false, read: { kind: 'cells', name: attachment.name, rows: range } }
}

/**
 * Hands the model a file attached to this chat, named only by its id. A photo or the pages of a PDF go whole, the pages
 * always as a copy so the file's metadata and open action stay behind. Any other file goes as rows of cells, each through
 * Anonymise, which waits while any app's books are opening, as the books name the people it aliases.
 */
export async function readAttachment(input: AttachmentRead, held: readonly ChatAttachment[], readsPdf: boolean, reads: ChatReads): Promise<ChatToolAnswer> {
  const attachment = held.find((candidate) => candidate.id === input.attachment)
  if (attachment === undefined) return refusal('That is not the id of a file attached to this chat. Take it from the context line.')
  const { reading } = attachment
  if (reading.kind === 'cells') {
    if ([...reads.readers.values()].some(({ reader }) => reader.status() === 'opening')) {
      return refusal("Kuna is still opening an app's books, which name the people Anonymise hides, so it cannot send the file's cells yet. Ask the person to try again in a moment.")
    }
    return cellsRead(attachment, reading.sheets, input, reads)
  }
  if (input.sheet !== null || input.rows !== null) return refusal('A photo or a PDF has no sheets or rows, so sheet and rows are null.')
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
  const range = readRangeOf(input.pages, attachment.pages, MOST_PAGES_A_READ)
  if ('reason' in range) return refusal(rangeRefusal(range, 'pages'))
  let bytes: Uint8Array
  try {
    bytes = await (await import('../infrastructure/pdfPages')).pdfPagesCut(attachment.bytes, range)
  } catch {
    return refusal('Kuna could not read those pages of the file. Say so.')
  }
  return {
    text: JSON.stringify({ ...about, pages: readRangeText(range), of: attachment.pages }),
    isError: false,
    read: { kind: 'document', name: attachment.name, pages: range },
    parts: [pdfPartOf(attachment, base64OfBytes(bytes))],
  }
}
