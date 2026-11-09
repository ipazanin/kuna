import { CURRENCY_CODES } from '../../money/currencyCode'
import { moneyFromAmount } from '../../money/money'
import { nearestBasisPoints } from '../../money/percent'
import { eachIdentifier } from '../../privacy/domain/maskIdentifiers'

/** Whether the text writes an amount or a rate equal to none of those, in cents and basis points. */
export function holdsStrayFigure(text: string, amounts: ReadonlySet<number>, rates: ReadonlySet<number>): boolean {
  return !figuresIn(text).every((figure) => (figure.kind === 'rate' ? figure.basisPoints.some((points) => rates.has(points)) : figure.cents.some((cents) => amounts.has(cents))))
}

/** An amount or a rate written in a text, with every value it can be read as, since `1.234` is a thousand in Croatian and one in English. */
type WrittenFigure = { readonly kind: 'amount'; readonly cents: readonly number[] } | { readonly kind: 'rate'; readonly basisPoints: readonly number[] }

/** A number that does not go on from a word or a figure ref such as `f12`, grouped by a dot, a comma or a kind of space. */
const NUMBER = /(?<![\w.,])(?:\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?(?!\d)|\d+(?:[.,]\d+)*)/g
const RATE_AFTER = /^\s?(?:%|(?:posto|percent|per cent)(?!\p{L}))/iu
const WORD_BEFORE = /([€$£]|\p{L}+)\s?$/u
const WORD_AFTER = /^\s?([€$£]|\p{L}+)/u
const EURO_OR_KUNA = /^(?:[€$£]|eur(?:o|a|e|i|u|os|ima)?|kn)$/i
/** Upper case only, since in lower case `all`, `top` and `try` are ordinary words. */
const CODES: ReadonlySet<string> = new Set(CURRENCY_CODES)
const DAY_AND_MONTH = /^(\d{1,2})\.(\d{2})$/
/** A day as `2026-11-07` or `7.11.2026.`, with or without spaces after the dots. */
const DATE = /(?<!\d)(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\.?)(?!\d)/g
/** A payment reference with its model, such as `HR00 2026-0142` or `HR01 123-456`, its parts digits and hyphens. */
const REFERENCE = /(?<![\p{L}\p{N}])(?:HR|SI)\d{2}\s?\d+(?:-\d+)*(?![\p{L}\p{N}])/gu

/** The text with its IBANs, OIBs, payment references and dates blanked out, as their digits are no figures. */
function withoutIdentifiers(text: string): string {
  return eachIdentifier(text, () => ' ', 'written')
    .replace(REFERENCE, ' ')
    .replace(DATE, ' ')
}

function isCurrency(word: string | undefined): boolean {
  return word !== undefined && (EURO_OR_KUNA.test(word) || CODES.has(word))
}

/** Whether the number reads as a day and a month, such as the 31.12. of a deadline. */
function isDayAndMonth(written: string): boolean {
  const [, day, month] = DAY_AND_MONTH.exec(written) ?? []
  return day !== undefined && Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12
}

/**
 * The amounts and rates in a text. A number counts as an amount when a currency stands on either side of it, or when it
 * has a thousands separator or two decimals and does not read as a day and a month. It counts as a rate before a percent
 * sign, `posto` or `percent`. Years, days and counts are left alone, and so is an amount written with none of these marks.
 * The digits of an IBAN, an OIB, a payment reference or a date are never read.
 */
export function figuresIn(written: string): WrittenFigure[] {
  const text = withoutIdentifiers(written)
  return [...text.matchAll(NUMBER)].flatMap((match): WrittenFigure[] => {
    const written = match[0].replace(/\s/g, '')
    const after = text.slice(match.index + match[0].length)
    const readings = [readNumber(written, ',', '.'), readNumber(written, '.', ',')].filter((value) => value !== null)
    if (RATE_AFTER.test(after)) {
      return [{ kind: 'rate', basisPoints: [...new Set(readings.map(nearestBasisPoints))] }]
    }
    const carriesCurrency = isCurrency(WORD_BEFORE.exec(text.slice(0, match.index))?.[1]) || isCurrency(WORD_AFTER.exec(after)?.[1])
    const looksLikeMoney = /[.,]\d{3}(?:\D|$)|[.,]\d{2}$/.test(written) && !isDayAndMonth(written)
    return (carriesCurrency || looksLikeMoney) && readings.length > 0 ? [{ kind: 'amount', cents: [...new Set(readings.map(moneyFromAmount))] }] : []
  })
}

/** The number as written with this grouping and decimal mark, or null when it is not written that way. */
function readNumber(written: string, group: string, decimal: string): number | null {
  const g = `\\${group}`
  const d = `\\${decimal}`
  if (!new RegExp(`^(?:\\d{1,3}(?:${g}\\d{3})+|\\d+)(?:${d}\\d{1,2})?$`).test(written)) {
    return null
  }
  return Number(written.replaceAll(group, '').replace(decimal, '.'))
}
