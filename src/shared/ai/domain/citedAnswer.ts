import { CURRENCY_CODES } from '../../money/currencyCode'
import type { ToolLog } from './aiTask'
import type { StrictSchema } from './strictSchema'
import { moneyFromAmount } from '../../money/money'
import type { Money } from '../../money/money'
import { nearestBasisPoints } from '../../money/percent'

/** The one answer shape of every explanation and question: parts that cite their sources and figures, and what the model adds from its own knowledge. */
export const CITED_ANSWER_SCHEMA: StrictSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['parts', 'ownKnowledge'],
  properties: {
    parts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'sources', 'figures'],
        properties: {
          text: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' }, description: 'Ids of the rules or law sections this part rests on, as Kuna gave them.' },
          figures: { type: 'array', items: { type: 'string' }, description: 'Refs of the figures Kuna gave that this part quotes, such as f.0.2.' },
        },
      },
    },
    ownKnowledge: { type: ['string', 'null'], description: "What you add from your own knowledge, beyond Kuna's rules, or null." },
  },
}

/** What Kuna sent with a question, which an answer may cite and quote. */
export interface CitedInput {
  /** The source ids sent, such as rule ids. */
  readonly sources: ReadonlySet<string>
  /** Each figure's ref and its amount in cents. */
  readonly figures: ReadonlyMap<string, Money>
  /** Other amounts sent, such as a rule's money terms, in cents. */
  readonly amounts: ReadonlySet<number>
  /** The rates sent, in basis points. */
  readonly rates: ReadonlySet<number>
}

export interface CheckedPart {
  readonly text: string
  readonly sources: readonly string[]
  /** The figures the part quotes, with Kuna's own amounts. */
  readonly figures: readonly { readonly ref: string; readonly cents: Money }[]
  /** The text holds an amount or a rate Kuna did not send. */
  readonly strayFigure: boolean
}

export interface CitedAnswer {
  readonly parts: readonly CheckedPart[]
  readonly ownKnowledge: { readonly text: string; readonly strayFigure: boolean } | null
  /** A part was dropped for naming a source or a figure Kuna did not give, or kept with no source though Kuna gave some. */
  readonly partlyUnchecked: boolean
}

/**
 * Drops each part that names a source or a figure ref that was neither sent nor returned by a tool in this run, and
 * flags each part, and the model's own knowledge, whose text holds an amount or a rate equal to none Kuna sent. A flagged
 * figure is never corrected, only shown as flagged. A part that names no source while Kuna gave some is kept, and marks
 * the answer partly unchecked.
 */
export function checkCitedAnswer(output: unknown, sent: CitedInput, log: ToolLog): CitedAnswer {
  const answer = output as { parts: readonly { text: string; sources: readonly string[]; figures: readonly string[] }[]; ownKnowledge: string | null }
  const sources = new Set([...sent.sources, ...log.answers.flatMap((tool) => tool.sources)])
  const figures = new Map([...sent.figures, ...log.answers.flatMap((tool) => tool.figures.map((figure): [string, Money] => [figure.ref, figure.cents]))])
  const amounts = new Set([...sent.amounts, ...[...figures.values()].map(Math.abs)])
  const stray = (text: string) =>
    !figuresIn(text).every((figure) => (figure.kind === 'rate' ? figure.basisPoints.some((points) => sent.rates.has(points)) : figure.cents.some((cents) => amounts.has(cents))))
  const kept = answer.parts.filter((part) => part.sources.every((source) => sources.has(source)) && part.figures.every((ref) => figures.has(ref)))
  return {
    parts: kept.map((part) => ({ text: part.text, sources: part.sources, figures: part.figures.map((ref) => ({ ref, cents: figures.get(ref)! })), strayFigure: stray(part.text) })),
    ownKnowledge: answer.ownKnowledge === null || answer.ownKnowledge.trim() === '' ? null : { text: answer.ownKnowledge, strayFigure: stray(answer.ownKnowledge) },
    partlyUnchecked: kept.length < answer.parts.length || (sources.size > 0 && kept.some((part) => part.sources.length === 0)),
  }
}

/** Whether an answer holds a figure Kuna did not compute anywhere. */
export function hasStrayFigure(answer: CitedAnswer): boolean {
  return answer.parts.some((part) => part.strayFigure) || answer.ownKnowledge?.strayFigure === true
}

/** An amount or a rate written in a text, with every value it can be read as, since `1.234` is a thousand in Croatian and one in English. */
type WrittenFigure = { readonly kind: 'amount'; readonly cents: readonly number[] } | { readonly kind: 'rate'; readonly basisPoints: readonly number[] }

/** A number not inside a ref such as `f.0.12`, grouped by a dot, a comma or a kind of space. */
const NUMBER = /(?<![\w.,])(?:\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?(?!\d)|\d+(?:[.,]\d+)*)/g
const RATE_AFTER = /^\s?(?:%|(?:posto|percent|per cent)(?!\p{L}))/iu
const WORD_BEFORE = /([€$£]|\p{L}+)\s?$/u
const WORD_AFTER = /^\s?([€$£]|\p{L}+)/u
const EURO_OR_KUNA = /^(?:[€$£]|eur(?:o|a|e|i|u|os|ima)?|kn)$/i
/** Upper case only, since in lower case `all`, `top` and `try` are ordinary words. */
const CODES: ReadonlySet<string> = new Set(CURRENCY_CODES)
const DAY_AND_MONTH = /^(\d{1,2})\.(\d{2})$/

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
 */
export function figuresIn(text: string): WrittenFigure[] {
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
