import { NUMBER_TOKENS } from '../../documents/domain/yearlyNumber'
import { words } from './words'

/** The number pattern the invoice generator has always used: the sequence, a fixed 1, and the year's last two digits. */
export const DEFAULT_NUMBER_PATTERN = '{n}-1-{yy}'

const TOKEN = /\{[^}]*\}/g

/** Null when the pattern holds the sequence once and no word in braces the app does not fill in. */
export function numberPatternProblem(pattern: string): string | null {
  if (pattern.trim() === '') return words.patternExample
  const unknown = (pattern.match(TOKEN) ?? []).filter((token) => !(NUMBER_TOKENS as readonly string[]).includes(token))
  if (unknown.length > 0) return words.unknownTokens(unknown, NUMBER_TOKENS)
  if (pattern.split('{n}').length !== 2) return words.sequenceOnce
  return null
}
