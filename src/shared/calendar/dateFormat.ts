import { intlLocale, language } from '../text/language'

/**
 * Croatian writes the month of a day as a number, since its short month names read as words:
 * 28. 10. 2026. rather than 28. lis 2026. A month without a day keeps its name.
 */
function inLanguage(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  if (language !== 'hr') return options
  if (options.dateStyle === 'medium' || options.dateStyle === 'short') {
    const { dateStyle: _dateStyle, timeStyle, ...rest } = options
    return { ...rest, day: 'numeric', month: 'numeric', year: 'numeric', ...(timeStyle === undefined ? {} : { hour: '2-digit', minute: '2-digit' }) }
  }
  return options.day !== undefined && options.month === 'short' ? { ...options, month: 'numeric' } : options
}

/**
 * A Croatian date keeps to one line, so 20. 3. 2048. never breaks after a dot. Its day and month
 * numbers go without a leading zero, as running text writes them, where Intl writes 01. 05. 2024.
 */
function partText(part: Intl.DateTimeFormatPart): string {
  if (part.type === 'month' && part.value === 'Sept') return 'Sep'
  if (language !== 'hr') return part.value
  if (part.type === 'literal') return part.value.replaceAll(' ', '\u00a0')
  return (part.type === 'day' || part.type === 'month') && /^\d+$/.test(part.value) ? String(Number(part.value)) : part.value
}

/** A date format in the app's language. English September reads "Sep" like the other short months, where Intl writes "Sept". */
export function dateFormat(options: Intl.DateTimeFormatOptions): (date: Date | number) => string {
  const format = new Intl.DateTimeFormat(intlLocale, inLanguage(options))
  return (date) => format.formatToParts(date).map(partText).join('')
}
