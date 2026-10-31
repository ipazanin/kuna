import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'
import type { MailCounts, MailTermPiece } from './mailSource'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka. Filing an attachment saves it into its Drive folder, so it is spremiti.

const CROATIAN_PIECES: Readonly<Record<MailTermPiece, string>> = { sender: 'pošiljatelja', subject: 'predmeta', folder: 'mape' }

/** How many names a line spells out before it counts the rest. */
const NAMED_AT_MOST = 2

/** "no sender", "no sender and no folder" or "no sender, no subject and no folder". */
function englishMissing(missing: readonly MailTermPiece[]): string {
  const pieces = missing.map((piece) => `no ${piece}`)
  return pieces.length < 2 ? (pieces[0] ?? '') : `${pieces.slice(0, -1).join(', ')} and ${pieces.at(-1)}`
}

/** "pošiljatelja", "pošiljatelja ni mape" or "pošiljatelja, predmeta ni mape", as they read after nema. */
function croatianMissing(missing: readonly MailTermPiece[]): string {
  const pieces = missing.map((piece) => CROATIAN_PIECES[piece])
  return pieces.length < 2 ? (pieces[0] ?? '') : `${pieces.slice(0, -1).join(', ')} ni ${pieces.at(-1)}`
}

export const en = {
  propertyTooLong: (key: string, most: number) => `Its ${key} property would be longer than the ${most} bytes Drive keeps`,
  /** A source switched on without all it needs, on the mail card or under the switch. */
  incomplete: (missing: readonly MailTermPiece[]) => `It is on, but has ${englishMissing(missing)}`,
  incompleteOnSettings: (missing: readonly MailTermPiece[]) => `It is on, but has ${englishMissing(missing)} on Settings, General`,
  /** "Filed 2, already there 50, 1 unmatched", "Nothing new, already there 50" when nothing was filed, or "Nothing filed" when every upload failed. */
  counts: (counts: MailCounts) =>
    capitalised(
      [
        counts.filed === 0 ? (counts.notFiled === 0 ? 'nothing new' : 'nothing filed') : `filed ${counts.filed}`,
        counts.already === 0 ? '' : `already there ${counts.already}`,
        counts.corrections === 0 ? '' : `${counts.corrections} ${counts.corrections === 1 ? 'correction' : 'corrections'}`,
        counts.unchecked === 0 ? '' : `${counts.unchecked} not compared`,
        counts.unmatched === 0 ? '' : `${counts.unmatched} unmatched`,
      ]
        .filter((part) => part !== '')
        .join(', '),
    ),
  /** "a.pdf was not filed.", "a.pdf and b.xml were not filed." or "a.pdf, b.xml and 3 more were not filed." */
  notFiled: (names: readonly string[]) => {
    const named = names.slice(0, NAMED_AT_MOST)
    const rest = names.length - named.length
    const list = rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(' and ')
    return `${list} ${names.length === 1 ? 'was' : 'were'} not filed.`
  },
  notAddresses: (addresses: readonly string[]) => `${addresses.map((address) => `"${address}"`).join(', ')} ${addresses.length === 1 ? 'is not a mail address' : 'are not mail addresses'}`,
  subjectQuote: 'a subject cannot hold a double quote, which would end the phrase Gmail searches for',
  subjectTooLong: (most: number) => `a subject can be at most ${most} characters`,
}

export const hr: Translation<typeof en> = {
  propertyTooLong: (key, most) => `Njezino svojstvo ${key} bilo bi dulje od ${most} bajtova koliko Drive čuva`,
  incomplete: (missing) => `Uključeno je, ali nema ${croatianMissing(missing)}`,
  incompleteOnSettings: (missing) => `Uključeno je, ali u postavkama, Općenito nema ${croatianMissing(missing)}`,
  counts: (counts) =>
    capitalised(
      [
        counts.filed === 0 ? (counts.notFiled === 0 ? 'ništa novo' : 'ništa nije spremljeno') : `spremljeno ${counts.filed}`,
        counts.already === 0 ? '' : `već postoji ${counts.already}`,
        counts.corrections === 0 ? '' : `ispravci ${counts.corrections}`,
        counts.unchecked === 0 ? '' : `nije uspoređeno ${counts.unchecked}`,
        counts.unmatched === 0 ? '' : `bez pravila ${counts.unmatched}`,
      ]
        .filter((part) => part !== '')
        .join(', '),
    ),
  notFiled: (names) => {
    const named = names.slice(0, NAMED_AT_MOST)
    const rest = names.length - named.length
    return `Nije spremljeno: ${rest > 0 ? `${named.join(', ')} i još ${rest}` : named.join(' i ')}.`
  },
  notAddresses: (addresses) => `${addresses.map((address) => `„${address}”`).join(', ')} ${addresses.length === 1 ? 'nije adresa e-pošte' : 'nisu adrese e-pošte'}`,
  subjectQuote: 'predmet ne smije sadržavati dvostruke navodnike jer bi završili izraz koji Gmail traži',
  subjectTooLong: (most) => `predmet može imati najviše ${most} znakova`,
}

export const words = language === 'hr' ? hr : en
