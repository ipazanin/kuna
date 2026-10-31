import { moneyFromCents, plainAmount } from './money'
import type { Money } from './money'
import { language } from '../text/language'
import type { Language } from '../text/language'

/** How each language writes 1,500.00: the mark between groups of three and the decimal mark. */
export const AMOUNT_SEPARATORS: Readonly<Record<Language, { readonly group: string; readonly decimal: string }>> = {
  en: { group: ',', decimal: '.' },
  hr: { group: '.', decimal: ',' },
}

/** The zeros a k or an m after a number adds, so 3k is 3,000 and 1.5m is 1,500,000. */
export const AMOUNT_MULTIPLIER_ZEROS: Readonly<Record<string, number>> = { k: 3, m: 6 }

/** Thousands grouped as the language writes them, before an optional decimal mark, as in 1,500 or 10.000,00. The decimals are counted after. */
const GROUPED: Readonly<Record<Language, RegExp>> = {
  en: /^\d{1,3}(,\d{3})+(\.\d+)?$/,
  hr: /^\d{1,3}(\.\d{3})+(,\d+)?$/,
}

/**
 * An amount typed into a field, with a decimal point or a decimal comma, so 12,50 is twelve fifty.
 * Thousands may be grouped as the language on screen writes them, so 1,500 in English and 1.500 in
 * Croatian are fifteen hundred. A k or an m at the end multiplies the amount, and the decimals before it
 * may go as far as whole cents after it, so in English 1.255m is 1,255,000.00, 1,255m is
 * 1,255,000,000.00 and 0.0125k is 12.50. Null for anything that is not zero or more in whole cents,
 * blank included.
 */
export function typedAmount(text: string): Money | null {
  const trimmed = text.trim()
  const zeros = AMOUNT_MULTIPLIER_ZEROS[trimmed.slice(-1).toLowerCase()]
  const number = zeros === undefined ? trimmed : trimmed.slice(0, -1)
  const ungrouped = GROUPED[language].test(number) ? number.replaceAll(AMOUNT_SEPARATORS[language].group, '') : number
  const places = 2 + (zeros ?? 0)
  const match = new RegExp(`^(\\d+)(?:[.,](\\d{1,${places}}))?$`).exec(ungrouped)
  if (match === null) return null
  const cents = Number(`${match[1]}${(match[2] ?? '').padEnd(places, '0')}`)
  return Number.isSafeInteger(cents) ? moneyFromCents(cents) : null
}

/** An amount as a field holds it for typing over: no grouping, and the decimal comma in Croatian, as in 7200,00. */
export function amountForTyping(money: Money): string {
  const plain = plainAmount(money)
  return language === 'hr' ? plain.replace('.', ',') : plain
}
