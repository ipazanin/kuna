import { fold } from './fold'

const A_ENDINGS = ['A', 'E', 'I', 'U', 'O', 'OM']
const O_E_ENDINGS = ['O', 'E', 'A', 'I', 'U', 'OM', 'EM']
const CONSONANT_ENDINGS = ['', 'A', 'U', 'E', 'OM', 'EM']
const POSSESSIVE_ENDINGS = ['', 'A', 'E', 'I', 'O', 'U', 'OM', 'OJ']
const VOWEL = /[AEIOU]$/
/** The consonant k, g or h turns into before the i of a dative, as `Rijeka` goes to `Rijeci`. */
const SOFTENED: Readonly<Record<string, string>> = { K: 'C', G: 'Z', H: 'S' }

/** A word folded for matching: no accents, upper case, and `DJ` read as `Đ`, so `DJURDJEVIC` and `Đurđević` meet. */
export function foldedWord(word: string): string {
  return fold(word).replace(/DJ/g, 'D')
}

function endedWith(stem: string, endings: readonly string[]): readonly string[] {
  return endings.map((ending) => `${stem}${ending}`)
}

/**
 * The Croatian case forms of a folded word, from its nominative, and the possessive forms such as `Anin` or `Horvatov`.
 * A fleeting a or e drops before the ending, as in `Petra` and `Čakovcu`, and k, g and h soften before an i, as in
 * `Rijeci`. Vocative sound changes are left out.
 */
export function caseForms(word: string): ReadonlySet<string> {
  if (word.endsWith('A')) {
    const stem = word.slice(0, -1)
    const softened = SOFTENED[stem.slice(-1)]
    return new Set([...endedWith(stem, A_ENDINGS), ...endedWith(`${stem}IN`, POSSESSIVE_ENDINGS), ...(softened === undefined ? [] : [`${stem.slice(0, -1)}${softened}I`])])
  }
  if (word.endsWith('O') || word.endsWith('E')) {
    const forms = endedWith(word.slice(0, -1), O_E_ENDINGS)
    return new Set(word.endsWith('AO') ? [...forms, ...endedWith(`${word.slice(0, -2)}L`, CONSONANT_ENDINGS.slice(1))] : forms)
  }
  if (VOWEL.test(word)) {
    return new Set([word])
  }
  const fleeting = word.length >= 4 && /(?:A[^AEIOU]|EC)$/.test(word) ? endedWith(`${word.slice(0, -2)}${word.slice(-1)}`, CONSONANT_ENDINGS.slice(1)) : []
  return new Set([...endedWith(word, CONSONANT_ENDINGS), ...endedWith(`${word}OV`, POSSESSIVE_ENDINGS), ...endedWith(`${word}EV`, POSSESSIVE_ENDINGS), ...fleeting])
}
