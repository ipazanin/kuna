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

  it('reads commas between groups of three as thousands, as English writes them', () => {
    expect(typedAmount('1,500')).toBe(150000)
    expect(typedAmount('1,234.50')).toBe(123450)
    expect(typedAmount('1,234,567.8')).toBe(123456780)
  })

  it('refuses grouping English does not write, so 1.234,50 is never read as a smaller amount', () => {
    expect(typedAmount('1.234,50')).toBeNull()
    expect(typedAmount('1 234')).toBeNull()
    expect(typedAmount('1,50,000')).toBeNull()
    expect(typedAmount('1,500.000')).toBeNull()
  })

  it('refuses dots that group thousands, which Croatian reads', () => {
    expect(typedAmount('1.500')).toBeNull()
    expect(typedAmount('1.500,00')).toBeNull()
  })

  it('multiplies by a thousand for a k and by a million for an m at the end', () => {
    expect(typedAmount('3k')).toBe(300000)
    expect(typedAmount('3m')).toBe(300000000)
    expect(typedAmount('0.2k')).toBe(20000)
    expect(typedAmount('1.5k')).toBe(150000)
    expect(typedAmount('1,5k')).toBe(150000)
    expect(typedAmount('0.05k')).toBe(5000)
    expect(typedAmount('1,500k')).toBe(150000000)
    expect(typedAmount('1,234,567k')).toBe(123456700000)
    expect(typedAmount('1,250.5k')).toBe(125050000)
    expect(typedAmount('3K')).toBe(300000)
    expect(typedAmount('2M')).toBe(200000000)
  })

  it('reads the decimals before a k or an m as far as whole cents after it', () => {
    expect(typedAmount('1.255m')).toBe(125500000)
    expect(typedAmount('0.0125k')).toBe(1250)
    expect(typedAmount('0.12345678m')).toBe(12345678)
    expect(typedAmount('0.12345k')).toBe(12345)
  })

  it('reads the marks before a k or an m as English writes them, a point for decimals and a comma for thousands', () => {
    expect(typedAmount('1.255m')).toBe(125500000)
    expect(typedAmount('1,255m')).toBe(125500000000)
  })

  it('refuses decimals that leave a fraction of a cent after a k or an m', () => {
    expect(typedAmount('0.123456k')).toBeNull()
    expect(typedAmount('0.123456789m')).toBeNull()
  })

  it('refuses a k or an m with no number before it, more than one, or one in the middle', () => {
    expect(typedAmount('k')).toBeNull()
    expect(typedAmount('3kk')).toBeNull()
    expect(typedAmount('3km')).toBeNull()
    expect(typedAmount('3k5')).toBeNull()
    expect(typedAmount('3 k')).toBeNull()
  })

  it('refuses an amount whose cents are past the largest safe integer', () => {
    expect(typedAmount('90071992547409.92')).toBeNull()
    expect(typedAmount('90071992547m')).toBeNull()
    expect(typedAmount('90071992547409.91')).toBe(9007199254740991)
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

  it('multiplies after Croatian grouping and a decimal comma', async () => {
    const amount = await croatian()
    expect(amount('1.500k')).toBe(150000000)
    expect(amount('1.234.567k')).toBe(123456700000)
    expect(amount('1.250,5k')).toBe(125050000)
    expect(amount('1,5k')).toBe(150000)
    expect(amount('0,2m')).toBe(20000000)
    expect(amount('1,255m')).toBe(125500000)
    expect(amount('0,0125k')).toBe(1250)
  })

  it('reads the marks before a k or an m as Croatian writes them, a comma for decimals and a dot for thousands', async () => {
    const amount = await croatian()
    expect(amount('1,255m')).toBe(125500000)
    expect(amount('1.255m')).toBe(125500000000)
  })

  it('refuses commas that group thousands, which English reads', async () => {
    const amount = await croatian()
    expect(amount('1,500')).toBeNull()
    expect(amount('1,234.50')).toBeNull()
  })

  it('refuses dots that do not group thousands', async () => {
    const amount = await croatian()
    expect(amount('1.50.000')).toBeNull()
    expect(amount('1.5000')).toBeNull()
    expect(amount('1.500.00')).toBeNull()
  })
})
