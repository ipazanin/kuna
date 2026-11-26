import { flaggedAsPerson } from '../../../../shared/privacy/domain/personPayees'
import { sameName } from '../../../../shared/privacy/domain/names'

/** The payees as a setting's value holds them, one per line. */
export function personPayeesText(personPayees: readonly string[]): string {
  return personPayees.join('\n')
}

/** The list with the payee flagged as a person, or with every spelling of it taken off. A blank payee leaves the list as it is. */
export function withPayeeAsPerson(personPayees: readonly string[], payee: string, asPerson: boolean): readonly string[] {
  if (asPerson) {
    return payee.trim() === '' || flaggedAsPerson(personPayees, payee) ? personPayees : [...personPayees, payee.trim()]
  }
  return personPayees.filter((flagged) => !sameName(flagged, payee))
}
