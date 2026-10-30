import { shallowRef } from 'vue'

import { intlLocale } from '../text/language'
import type { CurrencyCode } from './currencyCode'
import { decimalText, roundedDecimal } from './decimal'
import type { Decimal } from './decimal'

/**
 * Money and share formatting in the workbook's currency and number locale, with the sign in front.
 * Inputs are integer cents. Negative amounts use a true minus sign so columns of figures stay the
 * same width. The page's format is that of the app on screen, and is reactive, so a chart computed
 * from it redraws when the settings change. A figure shown outside its app, as on the home, passes
 * its app's format instead.
 */

export type SignDisplay = 'negative' | 'always' | 'magnitude'

export type MoneyTone = 'flow' | 'outcome'

export interface MoneyFormat {
  /** An ISO 4217 code such as `EUR`. */
  readonly currency: string
  /** A BCP 47 tag such as `en-GB`, which decides grouping and the decimal mark. */
  readonly locale: string
}

/** Euros in the language's own format, until a file says otherwise. */
export const DEFAULT_MONEY_FORMAT: MoneyFormat = { currency: 'EUR', locale: intlLocale }

const MINUS = '−'

/** The most places a unit price shows, enough for a fractional share's price as a broker books it. */
const UNIT_PRICE_DECIMALS = 6

/** Intl.NumberFormat formats decimal text exactly since ES2023, which the ES2022 lib this code is typed against does not declare. */
interface ExactNumberFormat {
  format(decimalText: string): string
}

interface Formatters {
  readonly full: Intl.NumberFormat
  readonly compactSmall: Intl.NumberFormat
  readonly compact: Intl.NumberFormat
  readonly percent: Intl.NumberFormat
  readonly rate: Intl.NumberFormat
  readonly decimal: Intl.NumberFormat
  readonly days: Intl.NumberFormat
  readonly unitPrice: ExactNumberFormat
  readonly unitName: string
}

const active = shallowRef<MoneyFormat>(DEFAULT_MONEY_FORMAT)
const formattersByKey = new Map<string, Formatters>()
const quantityFormattersByKey = new Map<string, ExactNumberFormat>()

export function setMoneyFormat(format: MoneyFormat): void {
  if (format.currency !== active.value.currency || format.locale !== active.value.locale) {
    active.value = format
  }
}

function formatters(format: MoneyFormat = active.value): Formatters {
  const { currency, locale } = format
  const key = `${locale}|${currency}`
  let found = formattersByKey.get(key)
  if (found === undefined) {
    found = {
      full: new Intl.NumberFormat(locale, { style: 'currency', currency }),
      compactSmall: new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }),
      compact: new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }),
      percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
      rate: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 }),
      decimal: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      days: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
      unitPrice: exact(new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: UNIT_PRICE_DECIMALS })),
      unitName: unitNameOf(currency),
    }
    formattersByKey.set(key, found)
  }
  return found
}

/**
 * The currency's name in the language on screen, for running text such as "every euro earned".
 * English keeps the adjective capitalised and the unit in lower case, as in "US dollar" or "Swiss franc".
 */
function unitNameOf(currency: string): string {
  let name = currency
  try {
    name = new Intl.DisplayNames(intlLocale, { type: 'currency' }).of(currency) ?? currency
  } catch {
    return currency
  }
  const words = name.split(' ')
  const unit = words.pop() ?? name
  return [...words, unit.toLowerCase()].join(' ')
}

function exact(formatter: Intl.NumberFormat): ExactNumberFormat {
  return formatter as unknown as ExactNumberFormat
}

function withSign(signed: number, magnitudeText: string, sign: SignDisplay): string {
  if (sign === 'magnitude' || signed === 0) return magnitudeText
  if (signed < 0) return `${MINUS}${magnitudeText}`
  return sign === 'always' ? `+${magnitudeText}` : magnitudeText
}

export function formatMoney(cents: number, sign: SignDisplay = 'negative', format?: MoneyFormat): string {
  return withSign(cents, formatters(format).full.format(Math.abs(cents) / 100), sign)
}

/** €12.4K style, for axis ticks and tight labels. Under a thousand it drops the cents, so €907 sits beside €5.6K. */
export function formatCompactMoney(cents: number, sign: SignDisplay = 'negative', format?: MoneyFormat): string {
  const units = Math.abs(cents) / 100
  const { compactSmall, compact } = formatters(format)
  return withSign(cents, units < 1000 ? compactSmall.format(Math.round(units)) : compact.format(units), sign)
}

export function formatPercent(fraction: number, sign: SignDisplay = 'negative'): string {
  return withSign(fraction, formatters().percent.format(Math.abs(fraction)), sign)
}

/** An interest rate as a bank writes it, with up to four decimals of a percent, such as 2.99% or 3.1825%. */
export function formatRate(fraction: number): string {
  return formatters().rate.format(fraction)
}

/** A plain number with one decimal, such as a runway of 7.4 months. */
export function formatDecimal(value: number): string {
  return withSign(value, formatters().decimal.format(Math.abs(value)), 'negative')
}

/** A number of days with at most one decimal, such as 12 or 7.5. */
export function formatDays(days: number): string {
  return formatters().days.format(days)
}

/** "euro", "US dollar": what one unit of the currency is called in running text. */
export function currencyUnitName(): string {
  return formatters().unitName
}

/** Rounded before it is written, so a value that rounds to zero carries no sign. */
function withDecimalSign(value: Decimal, places: number, formatter: ExactNumberFormat): string {
  const rounded = roundedDecimal(value, places)
  const magnitude = (rounded < 0n ? -rounded : rounded) as Decimal
  return withSign(Number(rounded), formatter.format(decimalText(magnitude)), 'negative')
}

/** A number of units such as 15 or 0.123456, rounded half away from zero past `maximumDecimals` places, at most twelve. */
export function formatQuantity(value: Decimal, maximumDecimals: number): string {
  const { locale } = active.value
  const key = `${locale}|${maximumDecimals}`
  let formatter = quantityFormattersByKey.get(key)
  if (formatter === undefined) {
    formatter = exact(new Intl.NumberFormat(locale, { maximumFractionDigits: maximumDecimals }))
    quantityFormattersByKey.set(key, formatter)
  }
  return withDecimalSign(value, maximumDecimals, formatter)
}

/** The price of one unit in its own currency, such as $190.50, with the currency's cents and up to six places. */
export function formatUnitPrice(value: Decimal, currency: CurrencyCode): string {
  const { unitPrice } = formatters({ currency, locale: active.value.locale })
  return withDecimalSign(value, UNIT_PRICE_DECIMALS, unitPrice)
}
