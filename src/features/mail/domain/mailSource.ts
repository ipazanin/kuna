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

/** What the books say a source searches for and files into: the senders, the subject phrase and the folder as names from My Drive down. */
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

/** The property a file the app filed from mail carries, naming its source, and the one with the mail's date as an ISO time. */
export const MAIL_SOURCE_PROPERTY = 'ledgerboard-mail'
export const MAIL_DATE_PROPERTY = 'ledgerboard-mail-date'

const WINDOW_OVERLAP_MS = 7 * 86_400_000

/** Where a source's search starts, in epoch milliseconds, and why: 7 days before the newest mail the app filed for it, or the start of the mail-since day. */
export interface MailWindow {
  readonly from: number
  readonly after: 'filed' | 'since'
}

export function mailWindow(newestFiled: number | null, sinceStart: number): MailWindow {
  return newestFiled === null ? { from: sinceStart, after: 'since' } : { from: newestFiled - WINDOW_OVERLAP_MS, after: 'filed' }
}

/**
 * The Gmail search of a source. The window is given in epoch seconds, since Gmail reads a date in
 * a search as midnight in California. A double quote would end the subject's phrase, so the
 * settings refuse one.
 */
export function mailQuery(terms: Pick<MailTerms, 'senders' | 'subject'>, window: MailWindow): string {
  return `from:(${terms.senders.join(' OR ')}) subject:"${terms.subject}" has:attachment after:${Math.floor(window.from / 1000)}`
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

/** What a sync's mail step found for one source, counted the way its line says it. */
export interface MailCounts {
  readonly file: number
  readonly already: number
  readonly corrections: number
  readonly unchecked: number
  readonly unmatched: number
}

/** "Would file 3, already there 50, 1 unmatched", or "Nothing new, already there 50" when nothing would be filed. */
export function countsLine(counts: MailCounts): string {
  const parts = [
    counts.file === 0 ? 'nothing new' : `would file ${counts.file}`,
    counts.already === 0 ? '' : `already there ${counts.already}`,
    counts.corrections === 0 ? '' : `${counts.corrections} ${counts.corrections === 1 ? 'correction' : 'corrections'}`,
    counts.unchecked === 0 ? '' : `${counts.unchecked} not compared`,
    counts.unmatched === 0 ? '' : `${counts.unmatched} unmatched`,
  ].filter((part) => part !== '')
  const line = parts.join(', ')
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}`
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
