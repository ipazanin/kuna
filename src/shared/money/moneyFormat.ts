import { shallowRef } from 'vue'

/**
 * Money and share formatting in the workbook's currency and number locale, with the sign in front.
 * Inputs are integer cents. Negative amounts use a true minus sign so columns of figures stay the
 * same width. The format is reactive, so a chart computed from it redraws when the settings change.
 */

export type SignDisplay = 'negative' | 'always' | 'magnitude'

export interface MoneyFormat {
  /** An ISO 4217 code such as `EUR`. */
  readonly currency: string
  /** A BCP 47 tag such as `en-GB`, which decides grouping and the decimal mark. */
  readonly locale: string
}

export const DEFAULT_MONEY_FORMAT: MoneyFormat = { currency: 'EUR', locale: 'en-GB' }

const MINUS = '−'

interface Formatters {
  readonly full: Intl.NumberFormat
  readonly whole: Intl.NumberFormat
  readonly compact: Intl.NumberFormat
  readonly percent: Intl.NumberFormat
  readonly decimal: Intl.NumberFormat
  readonly unitName: string
}

const active = shallowRef<MoneyFormat>(DEFAULT_MONEY_FORMAT)
const formattersByKey = new Map<string, Formatters>()

export function setMoneyFormat(format: MoneyFormat): void {
  if (format.currency !== active.value.currency || format.locale !== active.value.locale) {
    active.value = format
  }
}

function formatters(): Formatters {
  const { currency, locale } = active.value
  const key = `${locale}|${currency}`
  let found = formattersByKey.get(key)
  if (found === undefined) {
    found = {
      full: new Intl.NumberFormat(locale, { style: 'currency', currency }),
      whole: new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }),
      compact: new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }),
      percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
      decimal: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      unitName: unitNameOf(currency),
    }
    formattersByKey.set(key, found)
  }
  return found
}

/**
 * The currency's name for running text such as "every euro earned". English keeps the adjective
 * capitalised and the unit in lower case, as in "US dollar" or "Swiss franc".
 */
function unitNameOf(currency: string): string {
  let name = currency
  try {
    name = new Intl.DisplayNames('en', { type: 'currency' }).of(currency) ?? currency
  } catch {
    return currency
  }
  const words = name.split(' ')
  const unit = words.pop() ?? name
  return [...words, unit.toLowerCase()].join(' ')
}

function withSign(signed: number, magnitudeText: string, sign: SignDisplay): string {
  if (sign === 'magnitude' || signed === 0) return magnitudeText
  if (signed < 0) return `${MINUS}${magnitudeText}`
  return sign === 'always' ? `+${magnitudeText}` : magnitudeText
}

export function formatMoney(cents: number, sign: SignDisplay = 'negative'): string {
  return withSign(cents, formatters().full.format(Math.abs(cents) / 100), sign)
}

/** Whole units, for KPI values and labels where the cents are noise. */
export function formatWholeMoney(cents: number, sign: SignDisplay = 'negative'): string {
  return withSign(cents, formatters().whole.format(Math.round(Math.abs(cents) / 100)), sign)
}

/** €12.4K style, for axis ticks and tight labels. Under a thousand it is whole units, so €907 sits beside €5.6K. */
export function formatCompactMoney(cents: number, sign: SignDisplay = 'negative'): string {
  const units = Math.abs(cents) / 100
  return withSign(cents, units < 1000 ? formatters().whole.format(Math.round(units)) : formatters().compact.format(units), sign)
}

export function formatPercent(fraction: number, sign: SignDisplay = 'negative'): string {
  return withSign(fraction, formatters().percent.format(Math.abs(fraction)), sign)
}

/** A plain number with one decimal, such as a runway of 7.4 months. */
export function formatDecimal(value: number): string {
  return withSign(value, formatters().decimal.format(Math.abs(value)), 'negative')
}

/** "euro", "US dollar": what one unit of the currency is called in running text. */
export function currencyUnitName(): string {
  return formatters().unitName
}
