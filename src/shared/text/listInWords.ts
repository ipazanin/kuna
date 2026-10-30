import { intlLocale } from './language'

const LIST = new Intl.ListFormat(intlLocale, { type: 'conjunction' })

/** "a, b and c", or "a, b i c" in Croatian. */
export function listInWords(parts: readonly string[]): string {
  return LIST.format(parts)
}
