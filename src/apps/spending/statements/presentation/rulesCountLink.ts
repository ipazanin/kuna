import { words } from './words'
import { plural } from '../../../../shared/text/translation'

/** The props of the `CountLink` that counts the rules filing under a category or putting a label on, named for a screen reader. */
export function rulesCountLink(count: number, name: string): { readonly count: number; readonly label: string; readonly linkLabel: string; readonly testId: string } {
  const label = plural(words.rules.count(count), count)
  return { count, label, linkLabel: words.rules.countOf(label, name), testId: 'spending-rules-link' }
}
