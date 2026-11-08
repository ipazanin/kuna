import type { AiPdfPart } from './aiTask'

/** What a file attached to the chat is. Only a photo or a PDF reaches the model. A sheet, XML or CSV reaches only an operation that names it. */
export type AttachmentKind = 'photo' | 'pdf' | 'sheet' | 'xml' | 'csv'

/**
 * A file attached to a chat, held in memory with the chat and gone with it. Its id is the only name the model gets. Saved
 * history keeps only `name`.
 */
export interface ChatAttachment {
  /** Handed out per chat, `a1`, `a2` and on, never reused. */
  readonly id: string
  readonly kind: AttachmentKind
  /** The file's name, shown on its chip and never sent. */
  readonly name: string
  /** What leaves: a photo's downscaled JPEG, or the file's own bytes for any other kind. */
  readonly bytes: Uint8Array
  /** The file as attached, which a Drive keep uploads. */
  readonly original: Blob
  /** A PDF's page count. Every other kind has one page. */
  readonly pages: number
}

const MEGABYTE = 1024 * 1024

/** The most attachments that wait on the prompt at once. */
export const MOST_WAITING = 4

/** The most pages a PDF may have. */
export const MOST_PDF_PAGES = 100

/** The most pages one read hands the model. */
export const MOST_PAGES_A_READ = 20

/** The largest file of each kind, before a photo is downscaled. Each stays under every provider's request limit with base64's third added. */
export const MOST_BYTES: Readonly<Record<AttachmentKind, number>> = {
  photo: 20 * MEGABYTE,
  pdf: 10 * MEGABYTE,
  sheet: 10 * MEGABYTE,
  xml: 10 * MEGABYTE,
  csv: 10 * MEGABYTE,
}

const KIND_OF_MEDIA_TYPE: Readonly<Record<string, AttachmentKind>> = {
  'image/jpeg': 'photo',
  'image/png': 'photo',
  'image/webp': 'photo',
  'image/heic': 'photo',
  'image/heif': 'photo',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
  'application/vnd.ms-excel': 'sheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'sheet',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/csv': 'csv',
}

const KIND_OF_EXTENSION: Readonly<Record<string, AttachmentKind>> = {
  jpg: 'photo',
  jpeg: 'photo',
  png: 'photo',
  webp: 'photo',
  heic: 'photo',
  heif: 'photo',
  pdf: 'pdf',
  xlsx: 'sheet',
  xls: 'sheet',
  ods: 'sheet',
  xml: 'xml',
  csv: 'csv',
}

/**
 * The kind of a file by its name's extension, or by its media type when the extension is not one Kuna knows, or null for a
 * file the chat takes no kind of. The extension comes first, as a browser on Windows calls a CSV an Excel file.
 */
export function attachmentKindOf(name: string, mediaType: string): AttachmentKind | null {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ''
  return KIND_OF_EXTENSION[extension] ?? KIND_OF_MEDIA_TYPE[mediaType.toLowerCase()] ?? null
}

/** Whether a file of this kind may be sent to the model. */
export function sendsToModel(kind: AttachmentKind): boolean {
  return kind === 'photo' || kind === 'pdf'
}

/** Why a file is refused on its chip. A PDF's `encrypted` and `unreadable` come from reading it. */
export type AttachmentRefusal =
  | { readonly reason: 'unknown-kind' }
  | { readonly reason: 'too-many'; readonly most: number }
  | { readonly reason: 'too-large'; readonly most: number }
  | { readonly reason: 'too-many-pages'; readonly most: number }
  | { readonly reason: 'encrypted' }
  | { readonly reason: 'unreadable' }

/** Why a file of this kind and size cannot wait beside the ones already waiting, or null when it can. */
export function attachRefusal(kind: AttachmentKind | null, size: number, waiting: number): AttachmentRefusal | null {
  if (kind === null) return { reason: 'unknown-kind' }
  if (waiting >= MOST_WAITING) return { reason: 'too-many', most: MOST_WAITING }
  if (size > MOST_BYTES[kind]) return { reason: 'too-large', most: MOST_BYTES[kind] }
  return null
}

/** Why a PDF of this many pages is refused, or null when Kuna takes it. */
export function pagesRefusal(pages: number): AttachmentRefusal | null {
  return pages > MOST_PDF_PAGES ? { reason: 'too-many-pages', most: MOST_PDF_PAGES } : null
}

/** The id the next attachment of a chat gets, one past the highest handed out, so a removed one's id is never reused. */
export function nextAttachmentId(handedOut: number): string {
  return `a${handedOut + 1}`
}

/** A PDF attachment's pages as the model gets them, named by the attachment's id, so the file's own name never leaves. */
export function pdfPartOf(attachment: ChatAttachment, base64: string): AiPdfPart {
  return { kind: 'pdf', base64, name: attachment.id }
}

/** Pages of a document, from `first` to `last`, both counted from 1. */
export interface PageRange {
  readonly first: number
  readonly last: number
}

/** Why a read's pages were refused. */
export type PageRangeRefusal = { readonly reason: 'not-a-range' } | { readonly reason: 'outside'; readonly pages: number } | { readonly reason: 'too-many-a-read'; readonly most: number }

/**
 * The pages a read asks for, as `"2"`, `"1-3"` or null for all of them, in a document of this many pages. A range past the
 * last page or longer than one read takes is refused, never cut to fit.
 */
export function pageRangeOf(asked: string | null, pages: number): PageRange | PageRangeRefusal {
  const range = asked === null ? { first: 1, last: pages } : rangeOfText(asked)
  if (range === null) return { reason: 'not-a-range' }
  if (range.first < 1 || range.last > pages) return { reason: 'outside', pages }
  if (range.last - range.first + 1 > MOST_PAGES_A_READ) return { reason: 'too-many-a-read', most: MOST_PAGES_A_READ }
  return range
}

function rangeOfText(text: string): PageRange | null {
  const match = /^\s*(\d{1,4})\s*(?:-\s*(\d{1,4})\s*)?$/.exec(text)
  if (match === null) return null
  const first = Number(match[1])
  const last = match[2] === undefined ? first : Number(match[2])
  return first <= last ? { first, last } : null
}

/** A range as a read names it back, `"2"` or `"1-3"`. */
export function pageRangeText(range: PageRange): string {
  return range.first === range.last ? String(range.first) : `${range.first}-${range.last}`
}
