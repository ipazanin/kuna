import { describe, expect, it } from 'vitest'

import { accountMoneyFromCents } from '../src/shared/money/accountMoney'
import { moneyFromCents } from '../src/shared/money/money'
import { partsOfWhole, restOfWhole } from '../src/shared/money/partsOfWhole'

const cents = moneyFromCents

describe('the parts of a whole', () => {
  it('gives the rest what the amounts leave, to the cent, in the place it was given', () => {
    expect(partsOfWhole(cents(10_001), [cents(3_333), 'rest', cents(3_333)])).toEqual({ parts: [3_333, 3_335, 3_333] })
  })

  it('keeps the sign of money out, so the parts of a debit are each below zero', () => {
    expect(partsOfWhole(accountMoneyFromCents(-6_000), ['rest', accountMoneyFromCents(-1_999)])).toEqual({ parts: [-4_001, -1_999] })
  })

  it('takes a lone rest as the whole', () => {
    expect(partsOfWhole(cents(500), ['rest'])).toEqual({ parts: [500] })
  })

  it('refuses no rest and two rests alike, since exactly one part takes it', () => {
    expect(partsOfWhole(cents(500), [cents(200), cents(300)])).toEqual({ refused: 'one-rest' })
    expect(partsOfWhole(cents(500), ['rest', cents(200), 'rest'])).toEqual({ refused: 'one-rest' })
  })

  it('refuses a part of zero, and a whole of zero', () => {
    expect(partsOfWhole(cents(500), [cents(0), 'rest'])).toEqual({ refused: 'zero-part' })
    expect(partsOfWhole(cents(0), ['rest'])).toEqual({ refused: 'zero-part' })
  })

  it('refuses an amount signed against the whole', () => {
    expect(partsOfWhole(accountMoneyFromCents(-6_000), [accountMoneyFromCents(1_000), 'rest'])).toEqual({ refused: 'wrong-sign' })
    expect(partsOfWhole(cents(6_000), [cents(-1_000), 'rest'])).toEqual({ refused: 'wrong-sign' })
  })

  it('refuses amounts that reach the whole or pass it, which leave the rest nothing or less', () => {
    expect(partsOfWhole(cents(6_000), [cents(6_000), 'rest'])).toEqual({ refused: 'over' })
    expect(partsOfWhole(accountMoneyFromCents(-6_000), [accountMoneyFromCents(-4_000), accountMoneyFromCents(-2_001), 'rest'])).toEqual({ refused: 'over' })
  })
})

describe('the rest of a whole', () => {
  it('is what the amounts leave, of either sign', () => {
    expect(restOfWhole(accountMoneyFromCents(-2_500), [accountMoneyFromCents(-2_349)])).toBe(-151)
    expect(restOfWhole(accountMoneyFromCents(-2_000), [accountMoneyFromCents(-2_349)])).toBe(349)
    expect(Object.is(restOfWhole(cents(100), [cents(100)]), 0)).toBe(true)
  })

  it('leaves one cent when the amounts fall one cent short, and none once they add up', () => {
    expect(restOfWhole(cents(6_000), [cents(4_000), cents(1_999)])).toBe(1)
    expect(restOfWhole(cents(-6_000), [cents(-4_000), cents(-1_999)])).toBe(-1)
    expect(partsOfWhole(cents(6_000), [cents(4_000), cents(1_999), 'rest'])).toEqual({ parts: [4_000, 1_999, 1] })
    expect(Object.is(restOfWhole(cents(6_000), [cents(4_000), cents(2_000)]), 0)).toBe(true)
  })
})
