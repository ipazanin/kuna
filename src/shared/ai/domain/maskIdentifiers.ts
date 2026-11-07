/** A country code and check digits, glued to the word IBAN or not, then every word up to the next punctuation, some of which may belong to the IBAN. */
const IBAN_RUN = /(?<![a-z0-9])(?:iban)?[a-z]{2}[\s-]*\d{2}(?:[\s-]*[a-z0-9]+)*/gi
/** Eleven digits that are not part of a longer number, in one run or grouped as `123 456 789 01`, as an OIB stands in a description or a reference. */
const OIB = /(?<!\d)\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}(?!\d)/g

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

/** Whether the text has an IBAN's shape and passes its mod-97 check, which leaves an invoice number readable. */
function isIban(compact: string): boolean {
  if (!IBAN_SHAPE.test(compact)) {
    return false
  }
  const digits = [...`${compact.slice(4)}${compact.slice(0, 4)}`].map((character) => parseInt(character, 36)).join('')
  return [...digits].reduce((rest, digit) => (rest * 10 + Number(digit)) % 97, 0) === 1
}

/** The run with the longest IBAN at its start replaced, and any later IBAN too. */
function replacedRun(run: string, replaceIban: (compact: string) => string): string {
  const later = (text: string): string => replacedIbans(text, replaceIban)
  const wordEnds = [...run.matchAll(/[a-z0-9]+/gi)].map((word) => word.index + word[0].length)
  for (const end of [...wordEnds].reverse()) {
    const compact = run.slice(0, end).replace(/[\s-]/g, '').toUpperCase().replace(/^IBAN/, '')
    if (isIban(compact)) {
      return `${replaceIban(compact)}${later(run.slice(end))}`
    }
  }
  const firstWord = run.slice(0, wordEnds[0]).toUpperCase().replace(/^IBAN/, '')
  // An unbroken run of an IBAN's shape is cut even with a wrong check digit, since it is likely a mistyped account.
  if (IBAN_SHAPE.test(firstWord)) {
    return `${replaceIban(firstWord)}${later(run.slice(wordEnds[0]))}`
  }
  return `${run.slice(0, wordEnds[0])}${later(run.slice(wordEnds[0]))}`
}

function replacedIbans(text: string, replaceIban: (compact: string) => string): string {
  return text.replace(IBAN_RUN, (run) => replacedRun(run, replaceIban))
}

/** The text with each IBAN and each OIB as the two functions say, so masking and aliases find the same things. */
export function replacedIdentifiers(text: string, replaceIban: (compact: string) => string, replaceOib: (oib: string) => string): string {
  return replacedIbans(text, replaceIban).replace(OIB, replaceOib)
}

/**
 * The text with each IBAN cut to its country code and last four characters, as `HR•• ••••1234`, and each OIB replaced
 * by `[OIB]`, so no identifier Kuna built a row from leaves the device.
 */
export function maskIdentifiers(text: string): string {
  return replacedIdentifiers(
    text,
    (compact) => `${compact.slice(0, 2)}•• ••••${compact.slice(-4)}`,
    () => '[OIB]',
  )
}
