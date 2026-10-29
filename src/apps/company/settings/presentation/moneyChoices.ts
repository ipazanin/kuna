import { intlLocale } from '../../../../shared/text/language'
import { currencyProblem } from '../domain/settings'

const currencyNames = new Intl.DisplayNames(intlLocale, { type: 'currency' })

/** Every currency the browser knows that counts in at most hundredths, by name, as a select lists them. */
export const CURRENCY_ITEMS: readonly { readonly value: string; readonly label: string }[] = Intl.supportedValuesOf('currency')
  .filter((code) => currencyProblem(code) === null)
  .map((code) => ({ value: code, label: `${currencyNames.of(code) ?? code} (${code})` }))

/** The number styles a new user picks from, by the locale that writes them. */
const NUMBER_LOCALES = ['en-GB', 'de-DE', 'fr-FR', 'de-CH']

/** The choice that leaves `number_locale` blank. A select item cannot hold an empty value, so it holds this instead. */
export const FOLLOW_LANGUAGE = 'follow-language'

/** Following the language, then each number style as an amount reads in it, such as 1.234,56 for de-DE, the locale in use among them. */
export function numberStyleItems(current: string): { readonly value: string; readonly label: string }[] {
  const locales = current === FOLLOW_LANGUAGE || NUMBER_LOCALES.includes(current) ? NUMBER_LOCALES : [...NUMBER_LOCALES, current]
  return [{ value: FOLLOW_LANGUAGE, label: 'Follow the language' }, ...locales.map((locale) => ({ value: locale, label: new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(1234.56) }))]
}
