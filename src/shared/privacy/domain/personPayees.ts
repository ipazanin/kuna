import { sameName } from './names'

/** The payees a setting's value lists as people, one per line, with blank lines dropped. */
export function personPayeesOf(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** The payees as a setting's value holds them, one per line. */
export function personPayeesText(personPayees: readonly string[]): string {
  return personPayees.join('\n')
}

/** Whether the owner flagged the payee as a person, under any spelling with the same words, so `HORVAT ANA` and `Ana Horvat` are one flag. */
export function flaggedAsPerson(personPayees: readonly string[], payee: string): boolean {
  return personPayees.some((flagged) => sameName(flagged, payee))
}

/** The list with the payee flagged as a person, or with every spelling of it taken off. A blank payee leaves the list as it is. */
export function withPayeeAsPerson(personPayees: readonly string[], payee: string, asPerson: boolean): readonly string[] {
  if (asPerson) {
    return payee.trim() === '' || flaggedAsPerson(personPayees, payee) ? personPayees : [...personPayees, payee.trim()]
  }
  return personPayees.filter((flagged) => !sameName(flagged, payee))
}
