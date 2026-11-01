import { afterEach, describe, expect, it } from 'vitest'

import type { CurrencyCode } from '../src/shared/money/currencyCode'
import { decimalOfText } from '../src/shared/money/decimal'
import type { Decimal } from '../src/shared/money/decimal'
import {
  DEFAULT_MONEY_FORMAT,
  currencyUnitName,
  formatCompactMoney,
  formatCurrencyAmount,
  formatDecimal,
  formatMoney,
  formatPercent,
  formatPercentChange,
  formatQuantity,
  formatShare,
  formatUnitPrice,
  setMoneyFormat,
} from '../src/shared/money/moneyFormat'

function decimal(text: string): Decimal {
  return decimalOfText(text)!
}

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

  it('compacts for axis ticks', () => {
    expect(formatCompactMoney(4821049)).toBe('€48.2k')
    expect(formatCompactMoney(-120000)).toBe('−€1.2k')
  })

  it('drops the cents under a thousand in compact form, so no decimal stands beside a k', () => {
    expect(formatCompactMoney(90750)).toBe('€908')
    expect(formatCompactMoney(-4510)).toBe('−€45')
  })

  it('formats shares as percentages with the same sign rules', () => {
    expect(formatPercent(0.124, 'always')).toBe('+12.4%')
    expect(formatPercent(-0.05)).toBe('−5%')
  })

  it("writes a day's change with two decimals, signed unless it rounds to zero", () => {
    expect(formatPercentChange(0.0029)).toBe('+0.29%')
    expect(formatPercentChange(-0.00017)).toBe('−0.02%')
    expect(formatPercentChange(0.012)).toBe('+1.20%')
    expect(formatPercentChange(-0.00004)).toBe('0.00%')
    expect(formatPercentChange(0)).toBe('0.00%')
  })

  it('writes a share of a whole with one decimal on every row, unsigned when it rounds to zero', () => {
    expect(formatShare(0.01)).toBe('1.0%')
    expect(formatShare(0.394)).toBe('39.4%')
    expect(formatShare(1)).toBe('100.0%')
    expect(formatShare(-0.0213)).toBe('−2.1%')
    expect(formatShare(-0.0004)).toBe('0.0%')
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

    expect(formatMoney(4821049)).toBe('$48,210.49')
    expect(currencyUnitName()).toBe('US dollar')
  })

  it("formats a figure in the format it is given, whatever the page's", () => {
    setMoneyFormat({ currency: 'USD', locale: 'en-US' })

    expect(formatMoney(4821049, 'negative', { currency: 'EUR', locale: 'de-DE' })).toBe('48.210,49\u00a0€')
    expect(formatMoney(-98765, 'negative', { currency: 'EUR', locale: 'de-DE' })).toBe('−987,65\u00a0€')
    expect(formatCompactMoney(1240000, 'negative', { currency: 'EUR', locale: 'en-GB' })).toBe('€12.4k')
    expect(formatMoney(4821049)).toBe('$48,210.49')
  })
})

describe('quantity and unit price formatting', () => {
  it('writes a quantity with grouping and only the places it has, up to the most asked for', () => {
    expect(formatQuantity(decimal('15'), 6)).toBe('15')
    expect(formatQuantity(decimal('1234.5'), 6)).toBe('1,234.5')
    expect(formatQuantity(decimal('-5'), 6)).toBe('−5')
  })

  it('rounds a quantity half away from zero past the places asked for, from its exact digits', () => {
    expect(formatQuantity(decimal('0.1234565'), 6)).toBe('0.123457')
    expect(formatQuantity(decimal('-0.1234565'), 6)).toBe('−0.123457')
    expect(formatQuantity(decimal('123456789.123456789012'), 12)).toBe('123,456,789.123456789012')
  })

  it('drops the sign of a value that rounds to zero', () => {
    expect(formatQuantity(decimal('-0.0000001'), 6)).toBe('0')
    expect(formatQuantity(decimal('-0.0000005'), 6)).toBe('−0.000001')
    expect(formatUnitPrice(decimal('-0.0000001'), 'USD' as CurrencyCode)).toBe('$0.00')
    expect(formatUnitPrice(decimal('-0.0000005'), 'USD' as CurrencyCode)).toBe('−$0.000001')
  })

  it("writes a unit price in its own currency with the currency's cents and up to six places", () => {
    expect(formatUnitPrice(decimal('190.5'), 'USD' as CurrencyCode)).toBe('$190.50')
    expect(formatUnitPrice(decimal('33.3367'), 'USD' as CurrencyCode)).toBe('$33.3367')
    expect(formatUnitPrice(decimal('0.12345678'), 'USD' as CurrencyCode)).toBe('$0.123457')
    expect(formatUnitPrice(decimal('512.3'), 'EUR' as CurrencyCode)).toBe('€512.30')
    expect(formatUnitPrice(decimal('1500'), 'JPY' as CurrencyCode)).toBe('¥1,500')
  })

  it('writes a unit price worked out by dividing with the places asked for, still with the cents', () => {
    expect(formatUnitPrice(decimal('147.966666666667'), 'USD' as CurrencyCode, 4)).toBe('$147.9667')
    expect(formatUnitPrice(decimal('9.645'), 'USD' as CurrencyCode, 4)).toBe('$9.645')
    expect(formatUnitPrice(decimal('100'), 'EUR' as CurrencyCode, 4)).toBe('€100.00')
  })

  it('writes an amount in its own currency rounded to its cents', () => {
    expect(formatCurrencyAmount(decimal('-12.345678'), 'USD' as CurrencyCode)).toBe('−$12.35')
    expect(formatCurrencyAmount(decimal('2337'), 'EUR' as CurrencyCode)).toBe('€2,337.00')
    expect(formatCurrencyAmount(decimal('-0.004'), 'USD' as CurrencyCode)).toBe('$0.00')
    expect(formatCurrencyAmount(decimal('1500.4'), 'JPY' as CurrencyCode)).toBe('¥1,500')
  })

  it("follows the page's locale whatever the price's currency", () => {
    setMoneyFormat({ currency: 'EUR', locale: 'hr-HR' })

    expect(formatQuantity(decimal('1234.5'), 6)).toBe('1.234,5')
    expect(formatUnitPrice(decimal('190.5'), 'USD' as CurrencyCode)).toBe('190,50\u00a0$')
  })
})
