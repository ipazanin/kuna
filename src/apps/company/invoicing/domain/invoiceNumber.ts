import { NUMBER_TOKENS } from '../../documents/domain/yearlyNumber'
import { unknownTokensProblem } from './templateTokens'
import type { PatternProblem } from './templateTokens'

/** The number pattern the invoice generator has always used: the sequence, a fixed 1, and the year's last two digits. */
export const DEFAULT_NUMBER_PATTERN = '{n}-1-{yy}'

/** Null when the pattern holds the sequence once and no word in braces the app does not fill in. */
export function numberPatternProblem(pattern: string): PatternProblem | null {
  if (pattern.trim() === '') return { kind: 'blank-pattern' }
  const unknown = unknownTokensProblem(pattern, NUMBER_TOKENS)
  if (unknown !== null) return unknown
  if (pattern.split('{n}').length !== 2) return { kind: 'sequence-not-once' }
  return null
}
