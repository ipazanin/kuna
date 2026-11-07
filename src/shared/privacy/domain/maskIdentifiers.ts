/** A country code and check digits, glued to the word IBAN or not, then every word up to the next punctuation, some of which may belong to the IBAN. */
const IBAN_RUN = /(?<![a-z0-9])(?:iban)?[a-z]{2}[\s-]*\d{2}(?:[\s-]*[a-z0-9]+)*/gi
/** Eleven digits that are not part of a longer number, in one run or grouped as `123 456 789 01`, as an OIB stands in a description or a reference. */
const OIB = /(?<!\d)\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}(?!\d)/g

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

/** An IBAN or an OIB found in a text. */
export interface FoundIdentifier {
  readonly kind: 'iban' | 'oib'
  /** The identifier as the text writes it. */
  readonly written: string
  /** The identifier in upper case without spaces, hyphens or the word IBAN, so two ways of writing it compare equal. */
  readonly compact: string
}

/** Whether the text has an IBAN's shape and passes its mod-97 check, which leaves an invoice number readable. */
function isIban(compact: string): boolean {
  if (!IBAN_SHAPE.test(compact)) {
    return false
  }
  const digits = [...`${compact.slice(4)}${compact.slice(0, 4)}`].map((character) => parseInt(character, 36)).join('')
  return [...digits].reduce((rest, digit) => (rest * 10 + Number(digit)) % 97, 0) === 1
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

/** The text with each IBAN, then each OIB, swapped for what `replace` gives for it. */
export function eachIdentifier(text: string, replace: (identifier: FoundIdentifier) => string): string {
  return replacedIbans(text, replace).replace(OIB, (written) => replace({ kind: 'oib', written, compact: written.replace(/[\s-]/g, '') }))
}

/** An IBAN cut to its country code and last four characters, as `HR•• ••••1234`, or an OIB as `[OIB]`. */
export function maskedIdentifier(identifier: FoundIdentifier): string {
  if (identifier.kind === 'oib') {
    return '[OIB]'
  }
  return `${identifier.compact.slice(0, 2)}•• ••••${identifier.compact.slice(-4)}`
}

/**
 * The text with each IBAN cut to its country code and last four characters, as `HR•• ••••1234`, and each OIB replaced
 * by `[OIB]`, so no identifier Kuna built a row from leaves the device.
 */
export function maskIdentifiers(text: string): string {
  return eachIdentifier(text, maskedIdentifier)
}
