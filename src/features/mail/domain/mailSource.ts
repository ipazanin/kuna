import { civilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { fold } from '../../../shared/text/fold'

/** One file attached to a mail, by Gmail's id and the name the sender gave it. */
export interface MailAttachment {
  readonly id: string
  readonly name: string
}

/** One mail a search found. `date` is when Gmail received it, in epoch milliseconds. */
export interface MailMessage {
  readonly id: string
  readonly subject: string
  readonly date: number
  readonly attachments: readonly MailAttachment[]
}

/** What the books say a source searches for and files into: the senders, the subject phrase and the folder as names from My Drive down, or from the folder of the books file after a first `.`. */
export interface MailTerms {
  readonly senders: readonly string[]
  readonly subject: string
  readonly folder: readonly string[]
}

/**
 * Where one attachment goes: the folders below the source's folder and the file's name. `redelivery`
 * is the end of a file name that marks the same file delivered again under another name, as a bank
 * statement redelivered a day later is, or null when only the same name counts.
 */
export type AttachmentNaming =
  | { readonly kind: 'named'; readonly attachment: MailAttachment; readonly folders: readonly string[]; readonly name: string; readonly redelivery: string | null }
  | { readonly kind: 'unmatched'; readonly attachment: MailAttachment; readonly reason: string }

/** The properties a file the app filed from mail carries: its source, the Gmail id of the mail, and the mail's date as an ISO time. */
export const MAIL_SOURCE_PROPERTY = 'ledgerboard-mail'
export const MAIL_ID_PROPERTY = 'ledgerboard-mail-id'
export const MAIL_DATE_PROPERTY = 'ledgerboard-mail-date'

/** Drive keeps a property only while its key and value together take at most 124 bytes of UTF-8. */
const PROPERTY_MAX_BYTES = 124

/** The properties of a file filed from this mail for this source. Throws for one Drive would refuse as too long. */
export function filedMailProperties(source: string, mail: Pick<MailMessage, 'id' | 'date'>): Readonly<Record<string, string>> {
  const properties: Readonly<Record<string, string>> = { [MAIL_SOURCE_PROPERTY]: source, [MAIL_ID_PROPERTY]: mail.id, [MAIL_DATE_PROPERTY]: new Date(mail.date).toISOString() }
  const tooLong = Object.entries(properties).find(([key, value]) => new TextEncoder().encode(`${key}${value}`).length > PROPERTY_MAX_BYTES)
  if (tooLong !== undefined) {
    throw new Error(`Its ${tooLong[0]} property would be longer than the ${PROPERTY_MAX_BYTES} bytes Drive keeps`)
  }
  return properties
}

const WINDOW_OVERLAP_MS = 7 * 86_400_000

/** Where a source's search starts, in epoch milliseconds, and why: 7 days before the newest file in its folder, or the start of the mail-since day when that is later. */
export interface MailWindow {
  readonly from: number
  readonly after: 'newest' | 'since'
}

/** `newest` is the newest file in the source's folder: the date of the mail the app filed it from, or when Drive made a file another app filed. */
export function mailWindow(newest: number | null, sinceStart: number): MailWindow {
  return newest === null || newest - WINDOW_OVERLAP_MS <= sinceStart ? { from: sinceStart, after: 'since' } : { from: newest - WINDOW_OVERLAP_MS, after: 'newest' }
}

/** Whether the next sync still searches back to a mail of the earlier date once mail of this date is filed. */
export function windowReaches(earlier: number, filed: number): boolean {
  return filed - WINDOW_OVERLAP_MS < earlier
}

/** The day the earliest mail starts at while `mail_since` is blank: the first day of last year, so a sync early in January still finds mail from December. */
export function mailSinceDefault(today: CivilDate): CivilDate {
  return civilDate(Number(today.slice(0, 4)) - 1, 1, 1)
}

/** The years from the mail-since day's to today's, both in, whose folders a source lists before it searches. */
export function yearsSince(since: CivilDate, today: CivilDate): number[] {
  const first = Number(since.slice(0, 4))
  return Array.from({ length: Math.max(1, Number(today.slice(0, 4)) - first + 1) }, (_, index) => first + index)
}

/**
 * The Gmail search of a source. The window is given in epoch seconds, since Gmail reads a date in
 * a search as midnight in California. A double quote would end the subject's phrase, so the
 * settings refuse one.
 */
export function mailQuery(terms: Pick<MailTerms, 'senders' | 'subject'>, window: MailWindow): string {
  return `from:(${terms.senders.join(' OR ')}) subject:"${terms.subject}" has:attachment after:${Math.floor(window.from / 1000)}`
}

/** What a source's search needs from the books. */
export type MailTermPiece = 'sender' | 'subject' | 'folder'

/** Whether the books turn a source off, turn it on without all it needs, or turn it on with its search and folder. */
export type SourceTerms =
  | { readonly kind: 'off' }
  | { readonly kind: 'incomplete'; readonly missing: readonly MailTermPiece[] }
  | { readonly kind: 'on'; readonly terms: MailTerms }

/** What a source the books turn on lacks, in the order the settings ask for it. */
export function missingTerms(terms: MailTerms): MailTermPiece[] {
  return [terms.senders.length === 0 ? 'sender' : null, terms.subject === '' ? 'subject' : null, terms.folder.length === 0 ? 'folder' : null].filter((piece): piece is MailTermPiece => piece !== null)
}

export function sourceTerms(on: boolean, terms: MailTerms): SourceTerms {
  if (!on) return { kind: 'off' }
  const missing = missingTerms(terms)
  return missing.length === 0 ? { kind: 'on', terms } : { kind: 'incomplete', missing }
}

/** "no sender", "no sender and no folder" or "no sender, no subject and no folder". */
export function missingWords(missing: readonly MailTermPiece[]): string {
  const words = missing.map((piece) => `no ${piece}`)
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/** The folder for one year inside a source's folder: the year and the folder's own name, such as 2026-statements inside statements. */
export function yearFolderName(year: string | number, folder: readonly string[]): string {
  return `${year}-${folder.at(-1) ?? ''}`
}

/** A subject without the RE:, FW: and FWD: a thread put in front of it. */
export function strippedSubject(subject: string): string {
  return subject.replace(/^(\s*(?:re|fw|fwd)\s*:\s*)+/i, '')
}

/**
 * What follows the phrase at the start of the subject, once the replies' prefixes are off, in the
 * folded form `fold` gives, so case and diacritics do not matter. Null for a subject that does not
 * start with the phrase.
 */
export function afterPhrase(subject: string, phrase: string): string | null {
  const folded = fold(strippedSubject(subject))
  const start = fold(phrase)
  return start !== '' && folded.startsWith(start) ? folded.slice(start.length) : null
}

/**
 * What a sync's mail step did for one source, counted the way its line says it: what it filed, what
 * it would file for a source that only lists, what it found already there, and what needs a look.
 * `notFiled` counts the uploads that failed, which the line names instead of counting.
 */
export interface MailCounts {
  readonly filed: number
  readonly file: number
  readonly notFiled: number
  readonly already: number
  readonly corrections: number
  readonly unchecked: number
  readonly unmatched: number
}

/** "Filed 2, would file 3, already there 50, 1 unmatched", "Nothing new, already there 50" when nothing was or would be filed, or "Nothing filed" when every upload failed. */
export function countsLine(counts: MailCounts): string {
  const parts = [
    counts.filed === 0 && counts.file === 0 ? (counts.notFiled === 0 ? 'nothing new' : 'nothing filed') : '',
    counts.filed === 0 ? '' : `filed ${counts.filed}`,
    counts.file === 0 ? '' : `would file ${counts.file}`,
    counts.already === 0 ? '' : `already there ${counts.already}`,
    counts.corrections === 0 ? '' : `${counts.corrections} ${counts.corrections === 1 ? 'correction' : 'corrections'}`,
    counts.unchecked === 0 ? '' : `${counts.unchecked} not compared`,
    counts.unmatched === 0 ? '' : `${counts.unmatched} unmatched`,
  ].filter((part) => part !== '')
  const line = parts.join(', ')
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}`
}

/** How many names a line spells out before it counts the rest. */
const NAMED_AT_MOST = 2

/** "a.pdf was not filed.", "a.pdf and b.xml were not filed." or "a.pdf, b.xml and 3 more were not filed." */
export function notFiledSentence(names: readonly string[]): string {
  const named = names.slice(0, NAMED_AT_MOST)
  const rest = names.length - named.length
  const list = rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(' and ')
  return `${list} ${names.length === 1 ? 'was' : 'were'} not filed.`
}

const MAIL_ADDRESS = /^[^\s@,()"]+@[^\s@,()"]+\.[^\s@,()".]+$/

/** The addresses of a comma-separated list, in lower case, each once. */
export function mailAddressesOf(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((address) => address.trim().toLowerCase())
        .filter((address) => address !== ''),
    ),
  ]
}

/** Why a list of sender addresses cannot be searched for, or null. */
export function mailAddressesProblem(addresses: readonly string[]): string | null {
  const malformed = addresses.filter((address) => !MAIL_ADDRESS.test(address))
  return malformed.length === 0 ? null : `${malformed.map((address) => `"${address}"`).join(', ')} ${malformed.length === 1 ? 'is not a mail address' : 'are not mail addresses'}`
}

const SUBJECT_MAX_LENGTH = 80

/** Why a subject phrase cannot be searched for, or null. */
export function mailSubjectProblem(subject: string): string | null {
  if (subject.includes('"')) return 'a subject cannot hold a double quote, which would end the phrase Gmail searches for'
  return subject.length > SUBJECT_MAX_LENGTH ? `a subject can be at most ${SUBJECT_MAX_LENGTH} characters` : null
}
