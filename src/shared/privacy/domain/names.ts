import { caseForms, foldedWord } from '../../text/wordForms'

interface Word {
  readonly start: number
  readonly end: number
  readonly folded: string
}

/** A run of the text that belongs to a name, such as `HORVAT, ANA`. */
export interface NameRun {
  readonly start: number
  readonly end: number
}

/** A one-word name shorter than this matches too much prose, as `Ana` would, so it never matches alone. */
const SHORTEST_ONE_WORD_NAME = 4

function wordsOf(text: string): readonly Word[] {
  return [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((match) => ({ start: match.index, end: match.index + match[0].length, folded: foldedWord(match[0]) })).filter((word) => word.folded !== '')
}

/** The form sets of each word of a name, or none for a name that cannot be matched safely. */
function formsOfName(name: string): readonly ReadonlySet<string>[] {
  const words = [...new Set(wordsOf(name).map((word) => word.folded))]
  if (words.length === 0 || (words.length === 1 && words[0]!.length < SHORTEST_ONE_WORD_NAME)) {
    return []
  }
  return words.map(caseForms)
}

/** The words of the text that belong to the name, or none unless every word of the name has a form in the text, in any order. */
function wordsOfName(text: string, name: string): readonly Word[] {
  const nameForms = formsOfName(name)
  if (nameForms.length === 0) {
    return []
  }
  const textWords = wordsOf(text)
  if (!nameForms.every((forms) => textWords.some((word) => forms.has(word.folded)))) {
    return []
  }
  return textWords.filter((word) => nameForms.some((forms) => forms.has(word.folded)))
}

/** Whether a name can be matched at all: it holds a word, and a name of one word has at least four letters. */
export function isName(text: string): boolean {
  return formsOfName(text).length > 0
}

/**
 * Whether the text names the person: every word of the name stands in it in some case, in any order and any case, as
 * `Plaća Ivanu Horvatu` names Ivan Horvat. `Ivana Horvat` names him too, as Ivana is also his genitive.
 */
export function nameIn(text: string, name: string): boolean {
  return wordsOfName(text, name).length > 0
}

/** Whether two names have the same words, such as a name written surname first. */
export function sameName(one: string, other: string): boolean {
  const ones = new Set(wordsOf(one).map((word) => word.folded))
  const others = new Set(wordsOf(other).map((word) => word.folded))
  return ones.size > 0 && ones.size === others.size && [...ones].every((word) => others.has(word))
}

/** The words of the text in some form of a word of the name, whether or not the rest of the name stands there too. */
function wordsOfNamePart(text: string, name: string): readonly Word[] {
  const nameForms = formsOfName(name)
  return wordsOf(text).filter((word) => nameForms.some((forms) => forms.has(word.folded)))
}

function joinedRuns(text: string, words: readonly Word[]): readonly NameRun[] {
  return words.reduce<NameRun[]>((joined, word) => {
    const last = joined.at(-1)
    if (last !== undefined && /^[\s,-]+$/.test(text.slice(last.end, word.start))) {
      return [...joined.slice(0, -1), { start: last.start, end: word.end }]
    }
    return [...joined, { start: word.start, end: word.end }]
  }, [])
}

/** The runs of the text that name the person, each word of the name with what stands between them, such as `HORVAT, ANA`. */
export function nameRuns(text: string, name: string): readonly NameRun[] {
  return joinedRuns(text, wordsOfName(text, name))
}

/** The runs of the text that hold words of the name, for a name split across cells such as `Ana` and `Horvat`, once the whole row is known to name the person. */
export function namePartRuns(text: string, name: string): readonly NameRun[] {
  return joinedRuns(text, wordsOfNamePart(text, name))
}

/** The text with each run that names the person swapped for the alias. */
export function nameReplaced(text: string, name: string, alias: string): string {
  return nameRuns(text, name).reduceRight((replaced, run) => `${replaced.slice(0, run.start)}${alias}${replaced.slice(run.end)}`, text)
}
