/** An ISO 4217 code such as `USD` that Intl formats as money. */
export type CurrencyCode = string & { readonly __unit: 'currency' }

/** The euro, the only base currency. */
export const EURO = 'EUR' as CurrencyCode

const SUPPORTED = new Set(Intl.supportedValuesOf('currency'))

/** Gold, silver, platinum and palladium have ISO codes, but they are holdings priced per ounce, never an account's cash. */
const METALS = new Set(['XAU', 'XAG', 'XPT', 'XPD'])

/** The code in capitals, such as `USD` for `usd`. Null for anything Intl does not know as a currency, and for a metal. */
export function currencyCodeOf(text: string): CurrencyCode | null {
  const code = text.trim().toUpperCase()
  return SUPPORTED.has(code) && !METALS.has(code) ? (code as CurrencyCode) : null
}
