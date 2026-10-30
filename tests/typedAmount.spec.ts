import { describe, expect, it, vi } from 'vitest'

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

  it('refuses dots that group thousands, which Croatian reads', () => {
    expect(typedAmount('1.500')).toBeNull()
    expect(typedAmount('1.500,00')).toBeNull()
  })

  it('refuses half-written and non-decimal numbers', () => {
    expect(typedAmount('12.')).toBeNull()
    expect(typedAmount('.5')).toBeNull()
    expect(typedAmount('1e3')).toBeNull()
    expect(typedAmount('0x10')).toBeNull()
    expect(typedAmount('€12')).toBeNull()
  })
})

describe('typedAmount in Croatian', () => {
  async function croatian(): Promise<typeof typedAmount> {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const { typedAmount: croatianAmount } = await import('../src/shared/money/typedAmount')
    vi.doUnmock('../src/shared/text/language')
    return croatianAmount
  }

  it('reads dots between groups of three as thousands', async () => {
    const amount = await croatian()
    expect(amount('1.500')).toBe(150000)
    expect(amount('1.500,00')).toBe(150000)
    expect(amount('10.000,50')).toBe(1000050)
  })

  it('reads one or two decimals after a comma or a point', async () => {
    const amount = await croatian()
    expect(amount('12,5')).toBe(1250)
    expect(amount('12.50')).toBe(1250)
    expect(amount('1.5')).toBe(150)
  })

  it('refuses dots that do not group thousands', async () => {
    const amount = await croatian()
    expect(amount('1.50.000')).toBeNull()
    expect(amount('1.5000')).toBeNull()
    expect(amount('1.500.00')).toBeNull()
  })
})
