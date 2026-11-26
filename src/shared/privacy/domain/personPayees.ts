import { sameName } from './names'

/** The payees a setting's value lists as people, one per line, with blank lines dropped. */
export function personPayeesOf(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** Whether the owner flagged the payee as a person, under any spelling with the same words, so `HORVAT ANA` and `Ana Horvat` are one flag. */
export function flaggedAsPerson(personPayees: readonly string[], payee: string): boolean {
  return personPayees.some((flagged) => sameName(flagged, payee))
}
