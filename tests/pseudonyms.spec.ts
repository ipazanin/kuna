import { describe, expect, it } from 'vitest'

import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'

const FIRST_IBAN = 'HR1210010051863000160'
const SECOND_IBAN = 'HR0423400091110000160'

function knowing(...names: string[]) {
  const pseudonyms = newPseudonyms()
  pseudonyms.know(names)
  return pseudonyms
}

describe('the pseudonyms of one chat', () => {
  it('gives two IBANs ending in the same four characters tokens of their own, shaped like the mask', () => {
    expect(knowing().pseudonymised(`From ${FIRST_IBAN} to ${SECOND_IBAN}, back to ${FIRST_IBAN}`, 'books')).toBe('From HR•• ••••0160 to HR•• ••••0160 #2, back to HR•• ••••0160')
  })

  it('keeps a token across texts, and gives an identifier field the token its text would get', () => {
    const pseudonyms = knowing()
    expect(pseudonyms.identifierToken(SECOND_IBAN)).toBe('HR•• ••••0160')
    expect(pseudonyms.pseudonymised(`Paid from ${FIRST_IBAN} and ${SECOND_IBAN}`, 'books')).toBe('Paid from HR•• ••••0160 #2 and HR•• ••••0160')
  })

  it('gives two OIBs tokens of their own', () => {
    expect(knowing().pseudonymised('OIB 12345678903 and 98765432106', 'books')).toBe('OIB [OIB] and [OIB] #2')
  })

  it('replaces only a known name, in any case, order or Croatian case, and leaves any other capitalised words as written', () => {
    const pseudonyms = knowing('Mia Primjer', 'Ivo Kovač')
    expect(pseudonyms.pseudonymised('Placa za PRIMJER MIA, listopad', 'books')).toBe('Placa za Person 1, listopad')
    expect(pseudonyms.pseudonymised('Povrat Ivi Kovaču', 'books')).toBe('Povrat Person 2')
    expect(pseudonyms.pseudonymised('Marko Babić, Konzum Market', 'books')).toBe('Marko Babić, Konzum Market')
  })

  it('gives a name written another way round the alias it already has, and none to a name it cannot match', () => {
    const pseudonyms = knowing('Mia Primjer', 'Primjer Mia', 'Ana Primjer', '-', 'Ana')
    expect(pseudonyms.valueOf('Person 1')).toBe('Mia Primjer')
    expect(pseudonyms.valueOf('Person 2')).toBe('Ana Primjer')
    expect(pseudonyms.valueOf('Person 3')).toBeNull()
  })

  it('restores the text exactly after a round trip', () => {
    const pseudonyms = knowing('Mia Primjer')
    const text = `Mia Primjer paid 120,00 EUR from HR12 1001 0051 8630 0016 0 to ${SECOND_IBAN}, OIB 123 456 789 01`
    const sent = pseudonyms.pseudonymised(text, 'books')
    expect(sent).toBe('Person 1 paid 120,00 EUR from HR•• ••••0160 to HR•• ••••0160 #2, OIB [OIB]')
    expect(pseudonyms.restored(sent)).toBe(text)
  })

  it('restores only the exact tokens Kuna handed out, in either language, never a declined word that looks like one', () => {
    const pseudonyms = knowing('Mia Primjer')
    pseudonyms.pseudonymised(`Mia Primjer from ${FIRST_IBAN}`, 'books')
    const answer = 'Person 1, Person 12, Osobnu 1, Adresama 1, Osoba 1 and HR•• ••••0160 #3, HR•• ••••9999, [OIB]'
    expect(pseudonyms.restored(answer)).toBe(`Mia Primjer, Person 12, Osobnu 1, Adresama 1, Mia Primjer and HR•• ••••0160 #3, HR•• ••••9999, [OIB]`)
  })

  it('restores the same text again with no change', () => {
    const pseudonyms = knowing('Mia Primjer')
    const once = pseudonyms.restored(pseudonyms.pseudonymised(`Mia Primjer, ${FIRST_IBAN}, ${SECOND_IBAN}`, 'books'))
    expect(pseudonyms.restored(once)).toBe(once)
  })

  it('lists every way the text Kuna sent wrote a person, the known name first', () => {
    const pseudonyms = knowing('Ana Horvat')
    pseudonyms.pseudonymised('HORVAT ANA', 'books')
    pseudonyms.pseudonymised('Stanarina Ani Horvat', 'books')
    pseudonyms.pseudonymised('ana horvat', 'books')
    expect(pseudonyms.spellingsOf('Person 1')).toEqual(['Ana Horvat', 'HORVAT ANA', 'Ani Horvat'])
    expect(pseudonyms.spellingsOf('Person 9')).toEqual([])
  })

  it("names people in the screen's language, and reads either word back, but never a declined one", () => {
    const pseudonyms = newPseudonyms('Osoba')
    pseudonyms.know(['Ana Horvat'])
    expect(pseudonyms.pseudonymised('Stanarina Ani Horvat', 'books')).toBe('Stanarina Osoba 1')
    expect(pseudonyms.restored('Osoba 1 i Person 1, ali ne Osobi 1')).toBe('Ana Horvat i Ana Horvat, ali ne Osobi 1')
    expect(pseudonyms.spellingsOf('Person 1')).toEqual(['Ana Horvat', 'Ani Horvat'])
    expect(pseudonyms.valueOf('Osoba 1')).toBe('Ana Horvat')
  })

  it('takes its alias map back after a reload, so each alias and token stands for the same person or identifier and the next one goes on counting', () => {
    const before = knowing('Mia Primjer', 'Ivo Kovač')
    expect(before.pseudonymised(`Ivo Kovaču paid from ${FIRST_IBAN}`, 'books')).toBe('Person 2 paid from HR•• ••••0160')
    const kept = JSON.parse(JSON.stringify(before.aliasMap()))

    const after = newPseudonyms('Person', kept)
    after.know(['Ivo Kovač', 'Mia Primjer', 'Eva Novak'])

    expect(after.restored('Person 2 and HR•• ••••0160')).toBe(`Ivo Kovač and ${FIRST_IBAN}`)
    expect(after.spellingsOf('Person 2')).toEqual(['Ivo Kovač', 'Ivo Kovaču'])
    expect(after.pseudonymised(`Eva Novak, Mia Primjer, ${SECOND_IBAN} and ${FIRST_IBAN}`, 'books')).toBe('Person 3, Person 1, HR•• ••••0160 #2 and HR•• ••••0160')
    expect(before.aliasMap().persons).toHaveLength(2)
  })
})
