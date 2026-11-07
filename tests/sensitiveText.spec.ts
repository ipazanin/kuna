import { describe, expect, it } from 'vitest'

import { maskIdentifiers } from '../src/shared/ai/domain/maskIdentifiers'
import { anonymisedCounterparty, anonymisedText, chatAliases, namesAPerson } from '../src/shared/ai/domain/sensitiveText'

describe('whether a name reads as a person', () => {
  it.each(['Ana Horvat', 'HORVAT ANA', 'Ivan Pažanin', 'Marija Ana Novak', "O'Neil Sean", 'ANA HORVAT ZAGREB'])('takes %s for a person', (name) => {
    expect(namesAPerson(name)).toBe(true)
  })

  it.each([
    'Konzum',
    'Example Studio d.o.o.',
    'LIDL HRVATSKA',
    'PAYPAL *SPOTIFY',
    'BOLT.EU',
    'Corner market',
    'Example Bank',
    'KONZUM ZAGREB',
    'Café on the square',
    'Harbour bistro',
    'Top-up',
    'ULICA 22',
    '',
  ])('keeps %j, as it helps to sort a row', (name) => {
    expect(namesAPerson(name)).toBe(false)
  })
})

describe('the aliases of one chat', () => {
  it('gives one person one alias however a statement spells the name, and counts each kind apart', () => {
    const aliases = chatAliases()
    expect(aliases.aliasOf('Person', 'Ana Horvat')).toBe('Person 1')
    expect(aliases.aliasOf('Person', 'HORVAT  ANA')).toBe('Person 1')
    expect(aliases.aliasOf('Person', 'Marko Novak')).toBe('Person 2')
    expect(aliases.aliasOf('IBAN', 'HR12 1001 0051 8630 0016 0')).toBe('IBAN 1')
    expect(aliases.aliasOf('IBAN', 'HR1210010051863000160')).toBe('IBAN 1')
    expect(aliases.valueOf(' Person 2 ')).toBe('Marko Novak')
    expect(aliases.valueOf('Person 3')).toBeNull()
  })

  it('maps back on screen, also when a Croatian sentence translated and declined the word, and leaves a number no value holds', () => {
    const aliases = chatAliases()
    aliases.aliasOf('Person', 'Ana Horvat')
    aliases.aliasOf('Address', 'Ilica 15')
    expect(aliases.restored('Paid to Person 1 and Person 9, at Address 1.')).toBe('Paid to Ana Horvat and Person 9, at Ilica 15.')
    expect(aliases.restored('Uplata Osobi 1, adresa Adresa 1.')).toBe('Uplata Ana Horvat, adresa Ilica 15.')
    expect(aliases.restored('Person 12')).toBe('Person 12')
  })

  it('starts empty in a new chat', () => {
    chatAliases().aliasOf('Person', 'Ana Horvat')
    expect(chatAliases().valueOf('Person 1')).toBeNull()
  })

  it('survives the masking the model loop does on everything it sends', () => {
    for (const alias of ['Person 12', 'IBAN 12', 'OIB 12', 'Address 12', 'transaction-12']) expect(maskIdentifiers(alias)).toBe(alias)
  })
})

describe('text with its people taken out', () => {
  it('replaces a name, an address, an IBAN and an OIB, and leaves what names nobody', () => {
    const aliases = chatAliases()
    expect(anonymisedText('Stanarina za Ana Horvat, Ilica 15', aliases)).toBe('Stanarina za Person 1, Address 1')
    expect(anonymisedText('IBAN HR12 1001 0051 8630 0016 0, OIB 12345678903', aliases)).toBe('IBAN IBAN 1, OIB OIB 1')
    expect(anonymisedText('kava i kolač', aliases)).toBe('kava i kolač')
    expect(anonymisedText('Example Studio d.o.o. racun', aliases)).toBe('Example Studio d.o.o. racun')
    expect(anonymisedText('UPLATA HORVAT ANA STANARINA', aliases)).toBe('Person 2')
    expect(anonymisedText('Karta LIDL HRVATSKA, racun', aliases)).toBe('Person 3, racun')
    expect(anonymisedText('LIDL HRVATSKA racun', aliases)).toBe('LIDL HRVATSKA racun')
  })

  it('aliases a payee only when it names a person', () => {
    const aliases = chatAliases()
    expect(anonymisedCounterparty('Ana Horvat', aliases)).toBe('Person 1')
    expect(anonymisedCounterparty('KONZUM ZAGREB', aliases)).toBe('KONZUM ZAGREB')
    expect(anonymisedCounterparty('HR1210010051863000160', aliases)).toBe('IBAN 1')
  })
})
