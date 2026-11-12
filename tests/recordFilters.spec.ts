import { describe, expect, it } from 'vitest'

import { OPS_OF, fieldClassOf, fieldTest, inOrder, sortKeyOf, sorts, wordsSearch } from '../src/shared/ai/domain/recordFilters'
import type { ComparedField, FieldClass, FilterOp, FieldTest, SortDirection, SortKey } from '../src/shared/ai/domain/recordFilters'
import { decimalOfText } from '../src/shared/money/decimal'

const noAlias = () => false

function testOf(fieldClass: FieldClass, op: FilterOp, values: readonly string[], isAlias: (words: string) => boolean = noAlias): FieldTest {
  const test = fieldTest('field', fieldClass, op, values, isAlias)
  if (typeof test === 'string') throw new Error(test)
  return test
}

function amount(text: string | null): ComparedField {
  return { class: 'amount', amount: text === null ? null : decimalOfText(text) }
}

function plain(value: string | number | boolean | null | readonly string[]): ComparedField {
  return { class: 'plain', value }
}

function words(value: string | null): ComparedField {
  return { class: 'words', value }
}

describe('what a field of each exposure is compared as', () => {
  it.each([
    ['plain', true, 'amount'],
    ['plain', false, 'plain'],
    ['party', false, 'words'],
    ['free-text', false, 'words'],
    ['identifier', false, 'identifier'],
    ['ref', false, 'ref'],
    ['never', false, null],
  ] as const)('classes %s, an amount %s, as %s', (exposure, isAmount, fieldClass) => {
    expect(fieldClassOf(exposure, isAmount)).toBe(fieldClass)
  })

  it('lets an identifier take only is and one-of, and sorts neither an identifier nor a ref', () => {
    expect(OPS_OF.identifier).toEqual(['is', 'one-of'])
    expect(sorts('identifier')).toBe(false)
    expect(sorts('ref')).toBe(false)
    expect(sorts('words')).toBe(true)
  })
})

describe('a filter as it is parsed', () => {
  it('refuses an op the class does not take, naming the ops it takes', () => {
    expect(fieldTest('payee', 'words', 'at-least', ['A'], noAlias)).toBe('payee takes is, one-of, not, contains, empty, not-empty.')
    expect(fieldTest('iban', 'identifier', 'contains', ['HR12'], noAlias)).toContain('with a token a read gave you')
  })

  it.each([
    ['empty', ['x'], 'empty and not-empty take no values.'],
    ['one-of', [], 'one-of and not take one value or more.'],
    ['is', ['a', 'b'], 'is, contains, at-least and at-most take one value.'],
    ['at-least', [], 'is, contains, at-least and at-most take one value.'],
  ] as const)('refuses %s with %j values', (op, values, problem) => {
    expect(fieldTest('note', 'plain', op, values, noAlias)).toBe(problem)
  })

  it('refuses an amount that does not read as decimal text with a point, and repeats nothing of it', () => {
    for (const written of ['12,50', '€12', 'lots']) {
      const refused = fieldTest('amount', 'amount', 'is', [written], noAlias)
      expect(refused).toBe("An amount reads as decimal text in the record's own currency, such as -12.50.")
    }
  })

  it('refuses a range on text that is neither a number nor a day or a month', () => {
    expect(fieldTest('name', 'plain', 'at-least', ['B'], noAlias)).toContain('at-least and at-most take a number')
    expect(fieldTest('amount', 'amount', 'at-most', ['2026-10'], noAlias)).toContain('An amount reads as decimal text')
  })
})

describe('each op on a field', () => {
  it('is: an amount whatever its trailing zeros, text folded, and a number as written', () => {
    expect(testOf('amount', 'is', ['-12.5'])(amount('-12.50'))).toBe(true)
    expect(testOf('amount', 'is', ['-12.5'])(amount('12.50'))).toBe(false)
    expect(testOf('plain', 'is', ['groceries'])(plain('Grocéries'))).toBe(true)
    expect(testOf('plain', 'is', ['3'])(plain(3))).toBe(true)
    expect(testOf('plain', 'is', ['true'])(plain(true))).toBe(true)
    expect(testOf('plain', 'is', ['b'])(plain(['a', 'b']))).toBe(true)
  })

  it('one-of and not: any of the values, and none of them, an empty field counting as none', () => {
    expect(testOf('words', 'one-of', ['Person 1', 'Person 2'])(words('Person 2'))).toBe(true)
    expect(testOf('words', 'not', ['Person 1', 'Person 2'])(words('Person 2'))).toBe(false)
    expect(testOf('words', 'not', ['Person 1'])(words(null))).toBe(true)
  })

  it('contains: words folded, and an alias only whole', () => {
    expect(testOf('words', 'contains', ['ilica'])(words('Stanarina, Ilica 15'))).toBe(true)
    const isAlias = (written: string) => written === 'Person 1'
    expect(testOf('words', 'contains', ['Person 1'], isAlias)(words('Paid Person 10'))).toBe(false)
    expect(testOf('words', 'contains', ['Person 1'], isAlias)(words('Paid Person 1 rent'))).toBe(true)
  })

  it('at-least and at-most: an amount in its own currency, each bound kept', () => {
    expect(testOf('amount', 'at-least', ['-100'])(amount('-45.30'))).toBe(true)
    expect(testOf('amount', 'at-least', ['-100'])(amount('-100.00'))).toBe(true)
    expect(testOf('amount', 'at-most', ['-100'])(amount('-45.30'))).toBe(false)
    expect(testOf('amount', 'at-most', ['-100'])(amount(null))).toBe(false)
  })

  it('at-least and at-most: a number written as text or stored as a number', () => {
    expect(testOf('plain', 'at-least', ['12.5'])(plain('20'))).toBe(true)
    expect(testOf('plain', 'at-most', ['12.5'])(plain(13))).toBe(false)
    expect(testOf('plain', 'at-most', ['12.5'])(plain('Corner market'))).toBe(false)
  })

  it('at-least and at-most: a day or a month by its prefix, as from and to read', () => {
    expect(testOf('plain', 'at-least', ['2026-10'])(plain('2026-10-01'))).toBe(true)
    expect(testOf('plain', 'at-least', ['2026-10'])(plain('2026-09-30'))).toBe(false)
    expect(testOf('plain', 'at-most', ['2026-10'])(plain('2026-10-31'))).toBe(true)
    expect(testOf('plain', 'at-most', ['2026-10-15'])(plain('2026-10-16'))).toBe(false)
  })

  it('empty and not-empty: null, blank and an empty list are empty, false and zero are not', () => {
    const empty = testOf('plain', 'empty', [])
    expect([plain(null), plain(''), plain([])].map(empty)).toEqual([true, true, true])
    expect([plain(false), plain(0)].map(empty)).toEqual([false, false])
    expect(testOf('ref', 'not-empty', [])({ class: 'ref', id: null })).toBe(false)
    expect(testOf('amount', 'empty', [])(amount(null))).toBe(true)
  })

  it('is on a ref or an identifier: the resolved values Kuna handed out, whole', () => {
    expect(testOf('ref', 'is', ['category/c1'])({ class: 'ref', id: 'category/c1' })).toBe(true)
    expect(testOf('identifier', 'one-of', ['HR1210010051863000160'])({ class: 'identifier', identifiers: ['HR1210010051863000160'] })).toBe(true)
    expect(testOf('identifier', 'is', ['HR12'])({ class: 'identifier', identifiers: ['HR1210010051863000160'] })).toBe(false)
  })
})

describe('words in a text', () => {
  const finds = (text: string, words: string, alias = false) => wordsSearch(words, alias)(text)

  it('finds folded words anywhere, and an alias only where it stands alone', () => {
    expect(finds('Đakovo market', 'dakovo')).toBe(true)
    expect(finds('Stanarina, Ivanić', 'vani')).toBe(true)
    expect(finds('Person 12', 'Person 1', true)).toBe(false)
    expect(finds('HR•• ••••0160 #2', 'HR•• ••••0160', true)).toBe(false)
  })

  it('finds a place written with or without its full stop, short or whole', () => {
    expect(finds('Pekara Sv. Ivan Zelina', 'Sv Ivan')).toBe(true)
    expect(finds('Pekara Sv. Ivan Zelina', 'Sveti Ivan')).toBe(true)
    expect(finds('Pekara Sveti Ivan Zelina', 'Sv Ivan')).toBe(true)
    expect(finds('Pekara Sveti Ivan Zelina', 'Sv. Ivan')).toBe(true)
    expect(finds('Pekara Sv. Ivan Zelina', 'Sveti Petar')).toBe(false)
  })

  it('finds a word with or without its č, ć, š, ž and đ, and dj for đ', () => {
    expect(finds('Benzinska Čakovec', 'Cakovec')).toBe(true)
    expect(finds('Benzinska Cakovec', 'Čakovec')).toBe(true)
    expect(finds('Ljekarna Šibenik', 'sibenik')).toBe(true)
    expect(finds('Pošta Žminj', 'ZMINJ')).toBe(true)
    expect(finds('Ćevabdžinica Đuro', 'cevabdzinica djuro')).toBe(true)
  })

  it('finds a word in another case, either way round', () => {
    expect(finds('Plaćeno u Čakovcu', 'Čakovec')).toBe(true)
    expect(finds('Plaćeno u Čakovcu', 'Cakovec')).toBe(true)
    expect(finds('Najam, Rijeka', 'Rijeci')).toBe(true)
    expect(finds('Najam u Rijeci', 'Rijeka')).toBe(true)
    expect(finds('Ručak u Zagrebu', 'Zagreb')).toBe(true)
    expect(finds('Za Petra Horvata', 'Petar Horvat')).toBe(true)
  })

  it('keeps the words in their order and leaves short words to their own spelling', () => {
    expect(finds('Ivan Sveti', 'Sveti Ivan')).toBe(false)
    expect(finds('Ivo Horvat', 'Iva')).toBe(false)
    expect(finds('Nakit na rate', 'ne rate')).toBe(false)
    expect(finds('Ilica 15', 'Ilica 15a')).toBe(false)
    expect(finds('Kraj rečenice. Ivan', 'Krajnji')).toBe(false)
    expect(finds('Pekara', '.')).toBe(false)
  })
})

describe('the order of records', () => {
  interface Row {
    readonly id: string
    readonly amount: string | null
    readonly payee: string
  }
  const rows: readonly Row[] = [
    { id: 'b', amount: '-5', payee: 'Zagreb' },
    { id: 'a', amount: '-5', payee: 'apoteka' },
    { id: 'c', amount: null, payee: 'Corner' },
    { id: 'd', amount: '10', payee: 'Corner' },
  ]
  const keyOf = (row: Row, field: 'amount' | 'payee'): SortKey => sortKeyOf(field === 'amount' ? amount(row.amount) : words(row.payee))
  const ordered = (fields: readonly ('amount' | 'payee')[], directions: readonly SortDirection[]) =>
    inOrder(
      rows,
      directions,
      (row) => fields.map((field) => keyOf(row, field)),
      (row) => row.id,
    ).map((row) => row.id)

  it('sorts an amount as a number either way, with an empty one last either way', () => {
    expect(ordered(['amount'], ['ascending'])).toEqual(['a', 'b', 'd', 'c'])
    expect(ordered(['amount'], ['descending'])).toEqual(['d', 'a', 'b', 'c'])
  })

  it('breaks a tie by the record id, whatever the direction', () => {
    expect(ordered(['payee'], ['ascending'])).toEqual(['a', 'c', 'd', 'b'])
    expect(ordered(['payee'], ['descending'])).toEqual(['b', 'c', 'd', 'a'])
  })

  it('sorts by one field and then the next', () => {
    expect(ordered(['payee', 'amount'], ['ascending', 'descending'])).toEqual(['a', 'd', 'c', 'b'])
  })

  it('sorts a number written as text by its value, and a day as text', () => {
    expect(sortKeyOf(plain('12.5'))).toEqual({ number: decimalOfText('12.5') })
    expect(sortKeyOf(plain('2026-10-05'))).toEqual({ text: '2026-10-05' })
    expect(sortKeyOf({ class: 'identifier', identifiers: ['HR12'] })).toBeNull()
  })
})
