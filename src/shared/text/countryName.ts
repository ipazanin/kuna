import { intlLocale } from './language'

const NAMES = new Intl.DisplayNames(intlLocale, { type: 'region', fallback: 'code' })

/** A country's name in the language on screen, from its two-letter ISO 3166 code such as `IE`. A code Intl does not know comes back as the code. */
export function countryName(code: string): string {
  const region = code.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(region) ? (NAMES.of(region) ?? region) : code
}

/** English and Croatian spellings that Intl does not give, by the code they stand for. */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  US: ['US', 'U.S.', 'USA', 'U.S.A.', 'United States of America', 'SAD', 'Amerika'],
  GB: ['UK', 'U.K.', 'Great Britain', 'Britain', 'Velika Britanija'],
  HK: ['Hong Kong'],
  MO: ['Macau', 'Macao', 'Makao'],
  KR: ['Korea', 'Republic of Korea', 'Koreja'],
  CZ: ['Czech Republic', 'Češka Republika'],
  RU: ['Russian Federation'],
  VN: ['Viet Nam'],
  TR: ['Turkey'],
  NL: ['Holland'],
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** A name in lower case without diacritics, with every run of other marks and spaces as one space, so `Côte d’Ivoire` and `cote d'ivoire` meet. */
export function foldedName(name: string): string {
  return name
    .replaceAll('&', ' and ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Every code's English and Croatian name, folded. A code Intl does not know, or knows only as an old code for another, is left out. */
function codesByName(): ReadonlyMap<string, string> {
  const codes = [...LETTERS].flatMap((first) => [...LETTERS].map((second) => `${first}${second}`))
  const known = codes.filter((code) => new Intl.Locale(`und-${code}`).region === code)
  const byName = new Map<string, string>()
  for (const locale of ['en', 'hr']) {
    const names = new Intl.DisplayNames(locale, { type: 'region', fallback: 'code' })
    for (const code of known) {
      const name = names.of(code)
      if (name !== undefined && name !== code) {
        byName.set(foldedName(name), code)
      }
    }
  }
  for (const [code, spellings] of Object.entries(ALIASES)) {
    for (const spelling of spellings) {
      byName.set(foldedName(spelling), code)
    }
  }
  return byName
}

/** Built on first use, so a screen that only names countries does not pay for it. */
let knownNames: ReadonlyMap<string, string> | null = null

/**
 * The two-letter ISO 3166 code of a country named in English or Croatian, whatever the language on screen, such as
 * `DE` for `Germany` or `Njemacka`. Case, diacritics, punctuation and spacing do not count. Null for a name it does not know.
 */
export function countryCodeOfName(name: string): string | null {
  knownNames ??= codesByName()
  return knownNames.get(foldedName(name)) ?? null
}
