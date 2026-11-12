import { describe, expect, it } from 'vitest'

import { isName, nameIn, nameReplaced, sameName } from '../src/shared/privacy/domain/names'

describe('finding a known person in a Croatian bank text', () => {
  it.each([
    ['Plaća Ivanu Horvatu', 'Ivan Horvat'],
    ['HORVAT ANA', 'Ana Horvat'],
    ['za Anu Horvat', 'Ana Horvat'],
    ['Posudba od Petra Babića', 'Petar Babić'],
    ['DJURDJEVIC MARKO', 'Marko Đurđević'],
    ['Ana Horvat s.p.', 'Ana Horvat'],
    ['ANA HORVAT, ZAGREB', 'Ana Horvat'],
    ['HORVAT IVAN 10000 ZAGREB', 'Ivan Horvat'],
    ['uplata ivan horvat stanarina', 'Ivan Horvat'],
    ['Povrat Pavlu Kovaču', 'Pavao Kovač'],
    ['Aninom računu, Horvat', 'Ana Horvat'],
    ['Posudba Stjepanu Bedencu', 'Stjepan Bedenec'],
  ])('%s names %s', (text, name) => {
    expect(nameIn(text, name)).toBe(true)
  })

  it('names Ivan Horvat in "Ivana Horvat" too, a known false positive, as Ivana is also his genitive', () => {
    expect(nameIn('Ivana Horvat', 'Ivan Horvat')).toBe(true)
  })

  it('needs every word of the name, so a first name alone names no one', () => {
    expect(nameIn('Povrat Ani', 'Ana Horvat')).toBe(false)
    expect(nameIn('Horvat d.o.o.', 'Ana Horvat')).toBe(false)
  })

  it('matches no common Croatian shop to a person flagged by first name alone or by full name', () => {
    const shops = ['PETROL', 'KONZUM MARKET', 'LUKOIL', 'TISAK', 'INA', 'MARKETING STUDIO', 'VUKOVAR', 'PETROL ZAGREB 10000']
    const names = ['Petar', 'Marko', 'Luka', 'Ivan', 'Vuk', 'Ana', 'Ina', 'Tisa', 'Petar Babić', 'Marko Đurđević', 'Luka Kovač', 'Ana Horvat']
    expect(shops.flatMap((shop) => names.filter((name) => nameIn(shop, name)).map((name) => `${shop} names ${name}`))).toEqual([])
  })

  it('never matches a one-word name shorter than four letters, which would catch too much prose', () => {
    expect(isName('Ana')).toBe(false)
    expect(nameIn('Ana', 'Ana')).toBe(false)
    expect(isName('Ivek')).toBe(true)
    expect(nameIn('Povrat Iveku', 'Ivek')).toBe(true)
  })

  it('treats the same words in any order and case as one name, and a declined form as another', () => {
    expect(sameName('HORVAT ANA', 'Ana Horvat')).toBe(true)
    expect(sameName('Anu Horvat', 'Ana Horvat')).toBe(false)
    expect(sameName('', '')).toBe(false)
  })

  it('swaps each run that names the person for the alias, with the commas between its words', () => {
    expect(nameReplaced('Plaća HORVAT, ANA za listopad', 'Ana Horvat', 'Person 1')).toBe('Plaća Person 1 za listopad')
    expect(nameReplaced('Ana Horvat s.p., Zagreb', 'Ana Horvat', 'Person 1')).toBe('Person 1 s.p., Zagreb')
    expect(nameReplaced('Konzum Market', 'Ana Horvat', 'Person 1')).toBe('Konzum Market')
  })
})
