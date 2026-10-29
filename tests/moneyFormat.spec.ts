import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_MONEY_FORMAT, currencyUnitName, formatCompactMoney, formatDecimal, formatMoney, formatPercent, formatWholeMoney, setMoneyFormat } from '../src/shared/money/moneyFormat'

afterEach(() => {
  setMoneyFormat(DEFAULT_MONEY_FORMAT)
})

describe('money formatting with the default settings', () => {
  it('groups like the Sheet, with the euro sign in front and cents kept', () => {
    expect(formatMoney(123456789)).toBe('€1,234,567.89')
    expect(formatMoney(5)).toBe('€0.05')
  })

  it('writes a negative amount with a true minus sign before the euro sign', () => {
    expect(formatMoney(-98765)).toBe('−€987.65')
  })

  it('drops the sign for magnitudes and adds a plus when asked', () => {
    expect(formatMoney(-412050, 'magnitude')).toBe('€4,120.50')
    expect(formatMoney(31000, 'always')).toBe('+€310.00')
    expect(formatMoney(0, 'always')).toBe('€0.00')
  })

  it('rounds to whole euros and compacts for axis ticks', () => {
    expect(formatWholeMoney(4821049)).toBe('€48,210')
    expect(formatCompactMoney(4821049)).toBe('€48.2k')
    expect(formatCompactMoney(-120000)).toBe('−€1.2k')
  })

  it('keeps whole units under a thousand in compact form, so no decimal stands beside a k', () => {
    expect(formatCompactMoney(90750)).toBe('€908')
    expect(formatCompactMoney(-4510)).toBe('−€45')
  })

  it('formats shares as percentages with the same sign rules', () => {
    expect(formatPercent(0.124, 'always')).toBe('+12.4%')
    expect(formatPercent(-0.05)).toBe('−5%')
  })

  it('names the unit for running text', () => {
    expect(currencyUnitName()).toBe('euro')
    expect(formatDecimal(7.44)).toBe('7.4')
  })
})

describe('money formatting with another currency and locale', () => {
  it('follows the configured locale for grouping and the decimal mark', () => {
    setMoneyFormat({ currency: 'EUR', locale: 'de-DE' })

    // German puts a no-break space between the amount and the sign.
    expect(formatMoney(123456789)).toBe('1.234.567,89\u00a0€')
    expect(formatMoney(-98765)).toBe('−987,65\u00a0€')
    expect(formatDecimal(7.44)).toBe('7,4')
  })

  it('uses the configured currency and its name', () => {
    setMoneyFormat({ currency: 'USD', locale: 'en-US' })

    expect(formatWholeMoney(4821049)).toBe('$48,210')
    expect(currencyUnitName()).toBe('US dollar')
  })

  it("formats a figure in the format it is given, whatever the page's", () => {
    setMoneyFormat({ currency: 'USD', locale: 'en-US' })

    expect(formatWholeMoney(4821049, 'negative', { currency: 'EUR', locale: 'de-DE' })).toBe('48.210\u00a0€')
    expect(formatMoney(-98765, 'negative', { currency: 'EUR', locale: 'de-DE' })).toBe('−987,65\u00a0€')
    expect(formatCompactMoney(1240000, 'negative', { currency: 'EUR', locale: 'en-GB' })).toBe('€12.4k')
    expect(formatWholeMoney(4821049)).toBe('$48,210')
  })
})
