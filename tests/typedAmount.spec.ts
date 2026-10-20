import { describe, expect, it } from 'vitest'

import { typedAmount } from '../src/shared/money/typedAmount'

describe('typedAmount', () => {
  it('reads whole amounts and amounts with one or two decimals', () => {
    expect(typedAmount('1250')).toBe(125000)
    expect(typedAmount('12.5')).toBe(1250)
    expect(typedAmount('0.29')).toBe(29)
  })

  it('reads a decimal comma as a point', () => {
    expect(typedAmount('12,50')).toBe(1250)
  })

  it('ignores spaces around the amount', () => {
    expect(typedAmount('  300 ')).toBe(30000)
  })

  it('reads zero, so a caller that needs more than zero says so itself', () => {
    expect(typedAmount('0')).toBe(0)
    expect(typedAmount('0,00')).toBe(0)
  })

  it('refuses blank text', () => {
    expect(typedAmount('')).toBeNull()
    expect(typedAmount('   ')).toBeNull()
  })

  it('refuses a sign', () => {
    expect(typedAmount('-12')).toBeNull()
    expect(typedAmount('+12')).toBeNull()
  })

  it('refuses more than two decimals rather than rounding them away', () => {
    expect(typedAmount('12.345')).toBeNull()
  })

  it('refuses thousands separators, so 1.234,50 is never read as a smaller amount', () => {
    expect(typedAmount('1.234,50')).toBeNull()
    expect(typedAmount('1,234.50')).toBeNull()
    expect(typedAmount('1 234')).toBeNull()
  })

  it('refuses half-written and non-decimal numbers', () => {
    expect(typedAmount('12.')).toBeNull()
    expect(typedAmount('.5')).toBeNull()
    expect(typedAmount('1e3')).toBeNull()
    expect(typedAmount('0x10')).toBeNull()
    expect(typedAmount('€12')).toBeNull()
  })
})
