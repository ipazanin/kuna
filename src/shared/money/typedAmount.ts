import { moneyFromAmount, plainAmount } from './money'
import type { Money } from './money'
import { language } from '../text/language'

/** Croatian groups thousands with a dot before an optional decimal comma, as in 1.500 or 10.000,00. */
const CROATIAN_GROUPED = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/

/**
 * An amount typed into a field, with a decimal point or a decimal comma, so 12,50 is twelve fifty.
 * Croatian may also group thousands with dots, so 1.500 is fifteen hundred. Null for anything that
 * is not zero or more with at most two decimals, blank included.
 */
export function typedAmount(text: string): Money | null {
  const trimmed = text.trim()
  const ungrouped = language === 'hr' && CROATIAN_GROUPED.test(trimmed) ? trimmed.replaceAll('.', '') : trimmed
  const plain = ungrouped.replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(plain) ? moneyFromAmount(Number(plain)) : null
}

/** An amount as a field holds it for typing over: no grouping, and the decimal comma in Croatian, as in 7200,00. */
export function amountForTyping(money: Money): string {
  const plain = plainAmount(money)
  return language === 'hr' ? plain.replace('.', ',') : plain
}
