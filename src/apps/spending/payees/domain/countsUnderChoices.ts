import { holdsName } from './payeeDetails'
import type { PayeeDirectory } from './payeeDirectory'
import { payeeKey } from './payeeKey'
import { naturalOrder } from '../../../../shared/text/naturalOrder'

/**
 * The names a part's Counts under offers: the payees who are people first, then the other payees you keep details of, each by the
 * name it shows under and in name order for the language on screen, then the names entries carry in the order given, each payee once.
 */
export function countsUnderChoices(directory: PayeeDirectory, known: readonly string[]): readonly string[] {
  const people = [...directory.payees.filter((payee) => payee.party === 'person').flatMap((payee) => payee.names.slice(0, 1)), ...directory.markedPeople].sort(naturalOrder)
  const others = directory.payees
    .filter((payee) => payee.party !== 'person')
    .flatMap((payee) => payee.names.slice(0, 1))
    .sort(naturalOrder)
  const offered = new Set<string>()
  return [...people, ...others, ...known.filter((name) => !directory.payees.some((payee) => holdsName(payee, name)))].filter((name) => {
    const key = payeeKey(name)
    if (key === '' || offered.has(key)) return false
    offered.add(key)
    return true
  })
}
