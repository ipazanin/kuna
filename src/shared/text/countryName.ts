import { intlLocale } from './language'

const NAMES = new Intl.DisplayNames(intlLocale, { type: 'region', fallback: 'code' })

/** A country's name in the language on screen, from its two-letter ISO 3166 code such as `IE`. A code Intl does not know comes back as the code. */
export function countryName(code: string): string {
  const region = code.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(region) ? (NAMES.of(region) ?? region) : code
}
