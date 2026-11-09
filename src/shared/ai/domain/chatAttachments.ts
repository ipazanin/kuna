import type { AiPdfPart } from './aiPart'
import type { DocumentSize } from './modelUsage'

/** What a file attached to the chat is. `text` is any other file that decodes as text, such as OFX, QIF, MT940 or TXT, read as lines. */
export type AttachmentKind = 'photo' | 'pdf' | 'sheet' | 'xml' | 'csv' | 'json' | 'text'

/** A format an app's own reader takes, found on this device when the file is attached, with the operation that imports it. */
export interface KnownFormat {
  readonly app: string
  /** What the format is called, such as `IBKR Activity Flex report`. */
  readonly name: string
  readonly operation: string
}

/** What the apps' readers make of a file: a format one of them takes, none, or no answer yet as some app's books are still opening. */
export type FormatFound = KnownFormat | 'none' | 'books-opening'

/** A sheet of a file read on this device as cells, each cell as text, cleaned and cut but not yet aliased. */
export interface CellSheet {
  /** The sheet's name, a path of XML elements or JSON keys, or null for a file of one sheet. File text, so it leaves only inside a read. */
  readonly name: string | null
  /**
   * How its rows read: a table under a header row, `path, value` rows of the XML or JSON values that do not repeat, or
   * one line of text a row.
   */
  readonly layout: 'table' | 'paths' | 'lines'
  readonly rows: readonly (readonly string[])[]
}

/**
 * How a file reaches the model: never, as Kuna reads its format itself; as cells, each through Anonymise, with the
 * characters the whole file weighs; or whole, a photo or a PDF.
 */
export type AttachmentReading =
  { readonly kind: 'kuna'; readonly format: KnownFormat } | { readonly kind: 'cells'; readonly sheets: readonly CellSheet[]; readonly characters: number } | { readonly kind: 'whole' }

/**
 * A file attached to a chat, held in memory with the chat and gone with it. Its id is the only name the model gets. Saved
 * history keeps only `name`.
 */
export interface ChatAttachment {
  /** Handed out in order, `a1`, `a2` and on, never reused while the page lives. */
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
  /** A photo's size as sent, after downscaling, which its image part and its cost read. Null for every other kind. */
  readonly sent: { readonly width: number; readonly height: number } | null
  readonly reading: AttachmentReading
}

/** What an app's recogniser reads of a file before it is attached. */
export type AttachedFile = Pick<ChatAttachment, 'kind' | 'name' | 'bytes'>

const MEGABYTE = 1024 * 1024

/** The most attachments that wait on the prompt at once. */
export const MOST_WAITING = 4

/** The most pages a PDF may have. */
export const MOST_PDF_PAGES = 100

/** The most pages one read hands the model. */
export const MOST_PAGES_A_READ = 20

/** The most rows one read of a file's cells hands the model. */
export const MOST_ROWS_A_READ = 200

/** The most characters one read of a file's cells hands the model, so one read stays a few cents. */
export const MOST_CHARACTERS_A_READ = 40_000

const MOST_INFLATED_MEGABYTES = 100

/** The most a sheet may inflate to, as its zip says, so a small file cannot fill the memory before Kuna reads a cell. */
export const MOST_INFLATED_BYTES = MOST_INFLATED_MEGABYTES * MEGABYTE

/** The largest file of each kind, before a photo is downscaled. Each stays under every provider's request limit with base64's third added. */
export const MOST_BYTES: Readonly<Record<AttachmentKind, number>> = {
  photo: 20 * MEGABYTE,
  pdf: 10 * MEGABYTE,
  sheet: 10 * MEGABYTE,
  xml: 10 * MEGABYTE,
  csv: 10 * MEGABYTE,
  json: 10 * MEGABYTE,
  text: 10 * MEGABYTE,
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
  'text/tab-separated-values': 'csv',
  'application/json': 'json',
  'text/plain': 'text',
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
  tsv: 'csv',
  json: 'json',
  txt: 'text',
  ofx: 'text',
  qif: 'text',
  mt940: 'text',
  sta: 'text',
}

/** What a file picker offers, as its `accept` takes it: every extension Kuna knows a kind of. */
export const ATTACHABLE = Object.keys(KIND_OF_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(',')

/**
 * The kind of a file by its name's extension, or by its media type when the extension is not one Kuna knows, or null for a
 * file the chat takes no kind of. The extension comes first, as a browser on Windows calls a CSV an Excel file.
 */
export function attachmentKindOf(name: string, mediaType: string): AttachmentKind | null {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ''
  return KIND_OF_EXTENSION[extension] ?? KIND_OF_MEDIA_TYPE[mediaType.toLowerCase()] ?? null
}

/** What an attachment weighs once sent, for its cost, or null for a file Kuna reads itself. A file's cells are weighed before aliasing, which changes a few characters. */
export function documentSizeOf(attachment: ChatAttachment): DocumentSize | null {
  if (attachment.reading.kind === 'kuna') return null
  if (attachment.reading.kind === 'cells') return { kind: 'text', characters: attachment.reading.characters }
  if (attachment.kind === 'pdf') return { kind: 'pdf', pages: attachment.pages }
  return attachment.sent === null ? null : { kind: 'photo', ...attachment.sent }
}

/** Why a file is refused on its chip. A PDF's `encrypted` and `unreadable` come from reading it. */
export type AttachmentRefusal =
  | { readonly reason: 'unknown-kind' }
  | { readonly reason: 'too-many'; readonly most: number }
  | { readonly reason: 'too-large'; readonly most: number }
  | { readonly reason: 'too-many-pages'; readonly most: number }
  | { readonly reason: 'encrypted' }
  | { readonly reason: 'unreadable' }
  /** A sheet that inflates past what Kuna reads, or XML that declares its own entities, refused before it is parsed. */
  | { readonly reason: 'unsafe' }
  /** An app's books are still opening, so Kuna cannot yet tell whether its reader takes the file or whose names to alias. */
  | { readonly reason: 'books-opening' }

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

/** Pages of a document or rows of a sheet, from `first` to `last`, both counted from 1. */
export interface ReadRange {
  readonly first: number
  readonly last: number
}

/** Why a read's pages or rows were refused. */
export type ReadRangeRefusal = { readonly reason: 'not-a-range' } | { readonly reason: 'outside'; readonly count: number } | { readonly reason: 'too-many-a-read'; readonly most: number }

/**
 * The pages or rows a read asks for, as `"2"`, `"1-3"` or null for all of them, of `count` in all, at most `most` a read.
 * A range past the last one or longer than one read takes is refused, never cut to fit.
 */
export function readRangeOf(asked: string | null, count: number, most: number): ReadRange | ReadRangeRefusal {
  const range = asked === null ? { first: 1, last: count } : rangeOfText(asked)
  if (range === null) return { reason: 'not-a-range' }
  if (range.first < 1 || range.last > count) return { reason: 'outside', count }
  if (range.last - range.first + 1 > most) return { reason: 'too-many-a-read', most }
  return range
}

function rangeOfText(text: string): ReadRange | null {
  const match = /^\s*(\d{1,6})\s*(?:-\s*(\d{1,6})\s*)?$/.exec(text)
  if (match === null) return null
  const first = Number(match[1])
  const last = match[2] === undefined ? first : Number(match[2])
  return first <= last ? { first, last } : null
}

/** A range as a read names it back, `"2"` or `"1-3"`. */
export function readRangeText(range: ReadRange): string {
  return range.first === range.last ? String(range.first) : `${range.first}-${range.last}`
}
