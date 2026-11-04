import { intlLocale } from './language'

const LISTS = {
  and: new Intl.ListFormat(intlLocale, { type: 'conjunction' }),
  or: new Intl.ListFormat(intlLocale, { type: 'disjunction' }),
}

/** "a, b and c", or "a, b i c" in Croatian, and with `or` "a, b or c", or "a, b ili c". */
export function listInWords(parts: readonly string[], joined: 'and' | 'or' = 'and'): string {
  return LISTS[joined].format(parts)
}
