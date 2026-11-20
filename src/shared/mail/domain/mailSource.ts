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

/** What a search looks for: the senders, and a subject and contents phrase, each blank for none. */
export interface MailSearch {
  readonly senders: readonly string[]
  readonly subject: string
  readonly contents?: string
}

const WINDOW_OVERLAP_MS = 7 * 86_400_000

/** Where a search starts, in epoch milliseconds, and why: 7 days before the newest day the books hold of its mail, or the start of the start day when that is later. */
export interface MailWindow {
  readonly from: number
  readonly after: 'newest' | 'since'
}

/** `newest` is the start of the newest day the books hold of what the mail brings, or null while they hold none. */
export function mailWindow(newest: number | null, sinceStart: number): MailWindow {
  return newest === null || newest - WINDOW_OVERLAP_MS <= sinceStart ? { from: sinceStart, after: 'since' } : { from: newest - WINDOW_OVERLAP_MS, after: 'newest' }
}

/**
 * The Gmail search. The window is given in epoch seconds, since Gmail reads a date in a search as midnight in California.
 * A double quote would end a phrase, so the settings refuse one. A blank subject or contents phrase searches for no such phrase.
 */
export function mailQuery(search: MailSearch, window: MailWindow): string {
  const phrases = [search.subject === '' ? '' : `subject:"${search.subject}"`, (search.contents ?? '') === '' ? '' : `"${search.contents}"`]
  return [`from:(${search.senders.join(' OR ')})`, ...phrases.filter((phrase) => phrase !== ''), 'has:attachment', `after:${Math.floor(window.from / 1000)}`].join(' ')
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

/** A phrase a search looks for in a mail. */
export type MailPhrase = 'subject' | 'contents'

/** Why Gmail cannot search for a list of senders or a phrase: addresses that are not mail addresses, a double quote that would end the phrase, or a phrase longer than `most` characters. */
export type MailSearchFault =
  | { readonly kind: 'not-addresses'; readonly addresses: readonly string[] }
  | { readonly kind: 'quote'; readonly phrase: MailPhrase }
  | { readonly kind: 'too-long'; readonly phrase: MailPhrase; readonly most: number }

/** Why a list of sender addresses cannot be searched for, or null. */
export function mailAddressesFault(addresses: readonly string[]): MailSearchFault | null {
  const malformed = addresses.filter((address) => !MAIL_ADDRESS.test(address))
  return malformed.length === 0 ? null : { kind: 'not-addresses', addresses: malformed }
}

const PHRASE_MAX_LENGTH = 80

/** Why a subject or contents phrase cannot be searched for, or null. */
export function mailPhraseFault(phrase: MailPhrase, text: string): MailSearchFault | null {
  if (text.includes('"')) return { kind: 'quote', phrase }
  return text.length > PHRASE_MAX_LENGTH ? { kind: 'too-long', phrase, most: PHRASE_MAX_LENGTH } : null
}
