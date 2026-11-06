import { describe, expect, it } from 'vitest'

import { isValidOib, oibIn } from '../src/apps/spending/receipts/domain/oib'
import { MADE_UP_BUYER_OIB, MADE_UP_MERCHANT_OIB } from '../src/apps/spending/receipts/assist/infrastructure/fake/fakeReceiptRead'

describe('an OIB', () => {
  it('passes with the right check digit', () => {
    expect(isValidOib(MADE_UP_MERCHANT_OIB)).toBe(true)
    expect(isValidOib(MADE_UP_BUYER_OIB)).toBe(true)
  })

  it('fails with any other check digit', () => {
    const others = [...'0123456789'].filter((digit) => digit !== MADE_UP_MERCHANT_OIB[10])

    expect(others.map((digit) => isValidOib(`${MADE_UP_MERCHANT_OIB.slice(0, 10)}${digit}`))).toEqual(others.map(() => false))
  })

  it.each(['', '1234567890', '123456789012', '1234567890a'])('fails for %j, which is not eleven digits', (text) => {
    expect(isValidOib(text)).toBe(false)
  })

  it.each([
    [`HR${MADE_UP_MERCHANT_OIB}`, MADE_UP_MERCHANT_OIB],
    [`R1 ${MADE_UP_BUYER_OIB}`, MADE_UP_BUYER_OIB],
    ['123 456 789 03', MADE_UP_MERCHANT_OIB],
    [MADE_UP_MERCHANT_OIB, MADE_UP_MERCHANT_OIB],
    ['R1', ''],
    ['123', ''],
    ['123456789012', ''],
    ['', ''],
  ])('finds in %j the OIB %j', (text, oib) => {
    expect(oibIn(text)).toBe(oib)
  })
})
