import { stripAccents } from '../../text/fold'

/** How a rule compares a row's folded text, such as its payee or description, with one value the rule states. */
export type TextTest = 'is' | 'contains' | 'starts_with' | 'matches'

/**
 * Whether folded text holds a value folded the same way. Blank text holds no value, so a row without a payee never equals a
 * blank cell.
 */
export function foldedTextHolds(test: Exclude<TextTest, 'matches'>, folded: string, foldedValue: string): boolean {
  if (folded === '') return false
  switch (test) {
    case 'is':
      return folded === foldedValue
    case 'contains':
      return folded.includes(foldedValue)
    case 'starts_with':
      return folded.startsWith(foldedValue)
  }
}

/**
 * A rule's regular expression as it tests folded text: its accents stripped and any case matching, since folded text has no
 * accents and is in capitals. Null when the text is not a regular expression.
 */
export function rulePattern(pattern: string): RegExp | null {
  try {
    return new RegExp(stripAccents(pattern), 'i')
  } catch {
    return null
  }
}

/** Whether folded text matches a pattern `rulePattern` made. Blank text matches none. */
export function foldedTextMatches(folded: string, pattern: RegExp): boolean {
  return folded !== '' && pattern.test(folded)
}
