import { describe, expect, it } from 'vitest'

import {
  decimalOfMoney,
  decimalOfNumber,
  decimalOfText,
  decimalParts,
  decimalText,
  dividedDecimal,
  inEuros,
  moneyParts,
  roundedDecimal,
  scaledDecimal,
  timesDecimal,
  typedDecimal,
} from '../src/shared/money/decimal'
import type { Decimal } from '../src/shared/money/decimal'
import { moneyFromCents } from '../src/shared/money/money'

function decimal(text: string): Decimal {
  const read = decimalOfText(text)
  if (read === null) {
    throw new Error(`${text} is not decimal text.`)
  }
  return read
}

describe('decimal text', () => {
  it('reads stored text and writes it back in its shortest form', () => {
    for (const text of ['0', '100', '0.00841', '-3.5', '190.5', '1234567.123456789012', '-0.000000000001']) {
      expect(decimalText(decimal(text))).toBe(text)
    }
  })

  it('drops trailing zeros on the way out, so equal decimals read the same', () => {
    expect(decimalText(decimal('58.00'))).toBe('58')
    expect(decimalText(decimal('1.10'))).toBe('1.1')
    expect(decimal('1.10')).toBe(decimal('1.1'))
  })

  it('keeps twelve places and refuses a thirteenth', () => {
    expect(decimal('0.123456789012')).toBe(123_456_789_012n)
    expect(decimalOfText('0.1234567890123')).toBeNull()
  })

  it('refuses anything a record does not store as a decimal', () => {
    for (const text of ['', ' 1', '1,5', '+1', '.5', '5.', '1e3', '1 000', 'NaN', '--1']) {
      expect(decimalOfText(text)).toBeNull()
    }
  })

  it('reads a typed decimal with a point or a comma, around spaces', () => {
    expect(typedDecimal('0,5')).toBe(decimal('0.5'))
    expect(typedDecimal(' 12.25 ')).toBe(decimal('12.25'))
    expect(typedDecimal('1,123456789012')).toBe(decimal('1.123456789012'))
  })

  it('refuses a typed decimal below zero, past twelve places or with grouping', () => {
    for (const text of ['', '-1', '1,0000000000001', '1.234,5', '1,234.5', 'abc']) {
      expect(typedDecimal(text)).toBeNull()
    }
  })
})

describe('a spreadsheet number cell', () => {
  it('reads the shortest text of the number, so binary noise rounds away', () => {
    const read = (value: number, places: number): string => decimalText(decimalOfNumber(value, places)!)
    expect([read(0.1 + 0.2, 12), read(12.300000000000002, 2), read(1e-7, 12), read(1.5e21, 2), read(1234, 0)]).toEqual(['0.3', '12.3', '0.0000001', '1500000000000000000000', '1234'])
  })

  it('rounds half away from zero on both signs, from the digits the cell shows', () => {
    const read = (value: number): string => decimalText(decimalOfNumber(value, 2)!)
    expect([read(0.005), read(-0.005), read(-2.675), read(5e-13)]).toEqual(['0.01', '-0.01', '-2.68', '0'])
  })

  it('reads no number that is not finite, and refuses to round to fewer than none or more than twelve places', () => {
    expect(decimalOfNumber(Number.NaN, 2)).toBeNull()
    expect(decimalOfNumber(Number.POSITIVE_INFINITY, 2)).toBeNull()
    expect(() => decimalOfNumber(1, 13)).toThrow(RangeError)
  })
})

describe('decimal arithmetic', () => {
  it('multiplies exactly where floating point drifts', () => {
    expect(decimalText(timesDecimal(decimal('0.1'), decimal('0.2')))).toBe('0.02')
    expect(decimalText(timesDecimal(decimal('15'), decimal('58.00')))).toBe('870')
    expect(decimalText(timesDecimal(decimal('0.123456'), decimal('190.5')))).toBe('23.518368')
  })

  it('rounds a product half away from zero to twelve places', () => {
    expect(timesDecimal(decimal('0.000000000001'), decimal('0.5'))).toBe(1n)
    expect(timesDecimal(decimal('-0.000000000001'), decimal('0.5'))).toBe(-1n)
    expect(timesDecimal(decimal('0.000000000001'), decimal('0.4'))).toBe(0n)
  })

  it('scales a 1-for-3 split of 300 units to exactly 100, and a 10-for-1 the other way', () => {
    expect(scaledDecimal(decimal('300'), 1n, 3n)).toBe(decimal('100'))
    expect(scaledDecimal(decimal('2.5'), 10n, 1n)).toBe(decimal('25'))
  })

  it('rounds a scaled decimal half away from zero to twelve places', () => {
    expect(decimalText(scaledDecimal(decimal('1'), 1n, 3n))).toBe('0.333333333333')
    expect(decimalText(scaledDecimal(decimal('2'), 1n, 3n))).toBe('0.666666666667')
    expect(decimalText(scaledDecimal(decimal('-2'), 1n, 3n))).toBe('-0.666666666667')
  })

  it('refuses to scale by a denominator of zero or less', () => {
    expect(() => scaledDecimal(decimal('1'), 1n, 0n)).toThrow(RangeError)
    expect(() => scaledDecimal(decimal('1'), 1n, -2n)).toThrow(RangeError)
  })

  it('rounds to fewer places half away from zero on both signs', () => {
    expect(decimalText(roundedDecimal(decimal('0.1234565'), 6))).toBe('0.123457')
    expect(decimalText(roundedDecimal(decimal('-0.1234565'), 6))).toBe('-0.123457')
    expect(decimalText(roundedDecimal(decimal('-0.0000001'), 6))).toBe('0')
    expect(decimalText(roundedDecimal(decimal('2.5'), 0))).toBe('3')
    expect(roundedDecimal(decimal('0.123456789012'), 12)).toBe(decimal('0.123456789012'))
  })

  it('refuses to round to fewer than none or more than twelve places', () => {
    expect(() => roundedDecimal(decimal('1'), -1)).toThrow(RangeError)
    expect(() => roundedDecimal(decimal('1'), 13)).toThrow(RangeError)
    expect(() => roundedDecimal(decimal('1'), 1.5)).toThrow(RangeError)
  })
})

describe('inEuros', () => {
  it('converts 500.00 USD at 1.10 USD per EUR to €454.55', () => {
    // 500 ÷ 1.1 = 454.5454…
    expect(inEuros(decimal('500.00'), decimal('1.10'))).toBe(45455)
  })

  it("converts the worked portfolio's dollar figures at their own rates", () => {
    // 870 ÷ 1.12 = 776.7857…, 355 ÷ 1.12 = 316.9642…, 1,001 ÷ 1.05 = 953.3333…
    expect(inEuros(decimal('870'), decimal('1.12'))).toBe(77679)
    expect(inEuros(decimal('355'), decimal('1.12'))).toBe(31696)
    expect(inEuros(decimal('1001'), decimal('1.05'))).toBe(95333)
  })

  it('rounds to the cent half away from zero on both signs', () => {
    expect(inEuros(decimal('0.005'), null)).toBe(1)
    expect(inEuros(decimal('-0.005'), null)).toBe(-1)
    expect(inEuros(decimal('0.004999999999'), null)).toBe(0)
    // 1.15 ÷ 2 = 0.575
    expect(inEuros(decimal('1.15'), decimal('2'))).toBe(58)
    expect(inEuros(decimal('-1.15'), decimal('2'))).toBe(-58)
  })

  it('takes an amount with no rate as euros already', () => {
    expect(inEuros(decimal('1002.00'), null)).toBe(100200)
  })

  it('refuses a rate of zero or less', () => {
    expect(() => inEuros(decimal('1'), decimal('0'))).toThrow(RangeError)
    expect(() => inEuros(decimal('1'), decimal('-1.1'))).toThrow(RangeError)
  })
})

describe('decimal division', () => {
  it('divides to twelve places, rounding half away from zero', () => {
    // 750.75 ÷ 15 = 50.05, and 2 ÷ 3 = 0.666666666666|6…
    expect(decimalText(dividedDecimal(decimal('750.75'), decimal('15')))).toBe('50.05')
    expect(decimalText(dividedDecimal(decimal('2'), decimal('3')))).toBe('0.666666666667')
    expect(decimalText(dividedDecimal(decimal('-2'), decimal('3')))).toBe('-0.666666666667')
  })

  it('reads euro cents exactly', () => {
    expect(decimalText(decimalOfMoney(moneyFromCents(-95333)))).toBe('-953.33')
  })
})

describe('parts of a total', () => {
  it('rounds every part but the last, which takes the rest, so the parts add up', () => {
    expect(moneyParts(moneyFromCents(100), [1n, 1n, 1n])).toEqual([33, 33, 34])
    // 1,949.00 over 10 and 5 units: 1,299.333… rounds to 1,299.33, and 649.67 is the rest.
    expect(moneyParts(moneyFromCents(194_900), [decimal('10'), decimal('5')])).toEqual([129_933, 64_967])
    expect(decimalParts(decimal('1001'), [decimal('5'), decimal('15')]).map(decimalText)).toEqual(['250.25', '750.75'])
  })

  it('gives the whole total to the last part when the weights are all zero, and nothing to split for no weights', () => {
    expect(moneyParts(moneyFromCents(500), [0n, 0n])).toEqual([0, 500])
    expect(moneyParts(moneyFromCents(500), [])).toEqual([])
  })
})
