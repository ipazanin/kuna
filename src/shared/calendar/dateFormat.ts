import { intlLocale } from '../text/language'

/** A date format in the app's language. English September reads "Sep" like the other short months, where Intl writes "Sept". */
export function dateFormat(options: Intl.DateTimeFormatOptions): (date: Date | number) => string {
  const format = new Intl.DateTimeFormat(intlLocale, options)
  return (date) =>
    format
      .formatToParts(date)
      .map((part) => (part.type === 'month' && part.value === 'Sept' ? 'Sep' : part.value))
      .join('')
}
