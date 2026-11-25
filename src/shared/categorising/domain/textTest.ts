/** How a rule compares a row's folded text, such as its payee or description, with one value the rule states. */
type TextTest = 'is' | 'contains' | 'starts_with'

/**
 * Whether folded text holds a value folded the same way. Blank text holds no value, so a row without a payee never equals a
 * blank cell.
 */
export function foldedTextHolds(test: TextTest, folded: string, foldedValue: string): boolean {
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
