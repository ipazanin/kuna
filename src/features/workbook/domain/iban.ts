import { normaliseIban } from '../../../shared/text/fold'

/** Two letters, two check digits and up to thirty letters or digits, after the grouping spaces go. */
const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

/**
 * Whether the text is an IBAN: the shape, and check digits that hold under ISO 13616, which turns
 * the four leading characters to the end, each letter to its number from A = 10, and needs the
 * whole to leave 1 after division by 97.
 */
export function isIban(text: string): boolean {
  const iban = normaliseIban(text)
  if (!IBAN_SHAPE.test(iban)) {
    return false
  }
  const digits = [...`${iban.slice(4)}${iban.slice(0, 4)}`].map((character) => String(Number.parseInt(character, 36))).join('')
  let remainder = 0
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}
