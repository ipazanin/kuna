import { IBAN_SHAPE, isIban } from '../../text/iban'

/** A country code and check digits, glued to the word IBAN or not, then every word up to the next punctuation, some of which may belong to the IBAN. */
const IBAN_RUN = /(?<![a-z0-9])(?:iban)?[a-z]{2}[\s-]*\d{2}(?:[\s-]*[a-z0-9]+)*/gi
/** Eleven digits that are not part of a longer number, in one run or grouped as `123 456 789 01`, as an OIB stands in a description or a reference. */
const OIB = /(?<!\d)\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}(?!\d)/g
/** A Croatian account number as written before IBANs, the bank's seven digits and the account's ten, as `2360000-1101234567`. */
const DOMESTIC_ACCOUNT = /(?<![\d-])\d{7}-\d{10}(?![\d-])/g
/** Thirteen to nineteen digits, in one run or in groups split by a space or a hyphen, as a card number stands in a description. */
const CARD_RUN = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g

/**
 * Which identifiers a text is searched for. The books hold IBANs and OIBs only, since a reference in the books can pass
 * the card check by chance. Typed text and file cells also hold card and old domestic account numbers.
 */
export type IdentifierReach = 'books' | 'written'

/** An IBAN, an OIB, a card or a domestic account number found in a text. */
export interface FoundIdentifier {
  readonly kind: 'iban' | 'oib' | 'account' | 'card'
  /** The identifier as the text writes it. */
  readonly written: string
  /** The identifier in upper case without spaces, hyphens or the word IBAN, so two ways of writing it compare equal. */
  readonly compact: string
}

function compactIban(written: string): string {
  return written.replace(/[\s-]/g, '').toUpperCase().replace(/^IBAN/, '')
}

/** The run with the longest IBAN at its start replaced, and any later IBAN too. */
function replacedRun(run: string, replace: (identifier: FoundIdentifier) => string): string {
  const wordEnds = [...run.matchAll(/[a-z0-9]+/gi)].map((word) => word.index + word[0].length)
  for (const end of [...wordEnds].reverse()) {
    const written = run.slice(0, end)
    const compact = compactIban(written)
    if (isIban(compact)) {
      return `${replace({ kind: 'iban', written, compact })}${replacedIbans(run.slice(end), replace)}`
    }
  }
  const firstWord = run.slice(0, wordEnds[0])
  const compact = compactIban(firstWord)
  // An unbroken run of an IBAN's shape is replaced even with a wrong check digit, since it is likely a mistyped account.
  if (IBAN_SHAPE.test(compact)) {
    return `${replace({ kind: 'iban', written: firstWord, compact })}${replacedIbans(run.slice(wordEnds[0]), replace)}`
  }
  return `${firstWord}${replacedIbans(run.slice(wordEnds[0]), replace)}`
}

function replacedIbans(text: string, replace: (identifier: FoundIdentifier) => string): string {
  return text.replace(IBAN_RUN, (run) => replacedRun(run, replace))
}

/** Whether the digits pass the Luhn check every card number passes, which leaves most other long numbers readable. */
function passesLuhn(digits: string): boolean {
  const sum = [...digits].reverse().reduce((total, digit, at) => {
    const value = Number(digit) * (at % 2 === 1 ? 2 : 1)
    return total + (value > 9 ? value - 9 : value)
  }, 0)
  return sum % 10 === 0
}

function replacedCards(text: string, replace: (identifier: FoundIdentifier) => string): string {
  return text.replace(CARD_RUN, (written) => {
    const compact = written.replace(/[\s-]/g, '')
    return passesLuhn(compact) ? replace({ kind: 'card', written, compact }) : written
  })
}

/** The text with each IBAN, then each domestic account number and card number the reach covers, then each OIB, swapped for what `replace` gives for it. */
export function eachIdentifier(text: string, replace: (identifier: FoundIdentifier) => string, reach: IdentifierReach): string {
  const ibansDone = replacedIbans(text, replace)
  const cardsDone =
    reach === 'books'
      ? ibansDone
      : replacedCards(
          ibansDone.replace(DOMESTIC_ACCOUNT, (written) => replace({ kind: 'account', written, compact: written.replace('-', '') })),
          replace,
        )
  return cardsDone.replace(OIB, (written) => replace({ kind: 'oib', written, compact: written.replace(/[\s-]/g, '') }))
}

/** An IBAN cut to its country code and last four characters, as `HR•• ••••1234`, an OIB as `[OIB]`, and a card or a domestic account number by its last four digits. */
export function maskedIdentifier(identifier: FoundIdentifier): string {
  switch (identifier.kind) {
    case 'oib':
      return '[OIB]'
    case 'card':
      return `[card ••••${identifier.compact.slice(-4)}]`
    case 'account':
      return `[account ••••${identifier.compact.slice(-4)}]`
    default:
      return `${identifier.compact.slice(0, 2)}•• ••••${identifier.compact.slice(-4)}`
  }
}

/**
 * The text with each IBAN cut to its country code and last four characters, as `HR•• ••••1234`, each OIB replaced by
 * `[OIB]`, and, in written text, each card and domestic account number cut to its last four digits.
 */
export function maskIdentifiers(text: string, reach: IdentifierReach): string {
  return eachIdentifier(text, maskedIdentifier, reach)
}
