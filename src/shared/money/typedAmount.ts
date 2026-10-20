import { moneyFromAmount } from './money'
import type { Money } from './money'

/**
 * An amount typed into a field, with a decimal point or a decimal comma, so 12,50 is twelve fifty.
 * Null for anything that is not zero or more with at most two decimals, blank included.
 */
export function typedAmount(text: string): Money | null {
  const plain = text.trim().replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(plain) ? moneyFromAmount(Number(plain)) : null
}
