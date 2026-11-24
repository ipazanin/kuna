import { UNREADABLE_AMOUNT, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { amountText } from '../../../../shared/storage/domain/recordFields'
import { storedFieldOfValue } from '../../../../shared/storage/domain/storedFields'

/** One line of an invoice: a service at quantity one, priced without VAT, and the plan items it sums, none for a line typed by hand. */
export interface InvoiceLine {
  readonly description: string
  readonly amount: Money
  readonly items: readonly string[]
}

/** What is wrong with the lines of an invoice: none at all, or one line by its place from 0. */
export type LineProblem =
  | { readonly kind: 'no-lines' }
  | { readonly kind: 'blank-text'; readonly line: number }
  | { readonly kind: 'not-above-zero'; readonly line: number }
  | { readonly kind: 'separator'; readonly line: number }

/** What is wrong with the `lines` cell of a register row: a line that breaks the line rule, or lines that do not add up to the row's amount. */
export type RegisterLinesProblem = LineProblem | { readonly kind: 'total'; readonly total: Money; readonly amount: Money }

const SEPARATOR = '|'

export function linesTotal(lines: readonly InvoiceLine[]): Money {
  return sumMoney(lines.map((line) => line.amount))
}

/**
 * An invoice has at least one line, and every line has a text and an amount above zero. Neither its text nor a plan item holds a `|`
 * or a line break, which store the lines on the register.
 */
export function lineProblems(lines: readonly InvoiceLine[]): LineProblem[] {
  if (lines.length === 0) return [{ kind: 'no-lines' }]
  return lines.flatMap((line, index): LineProblem[] => [
    ...(line.description.trim() === '' ? [{ kind: 'blank-text', line: index } as const] : []),
    ...(line.amount > 0 ? [] : [{ kind: 'not-above-zero', line: index } as const]),
    ...([line.description, ...line.items].some((part) => part.includes(SEPARATOR) || /[\r\n]/.test(part)) ? [{ kind: 'separator', line: index } as const] : []),
  ])
}

/**
 * Lines as the register's `lines` cell stores them: one invoice line per line of text, its text, its amount in euros with a dot for
 * the decimals, then each plan item it sums, all separated by `|`. An amount that does not read is not above zero.
 */
export function linesOfText(stored: string): InvoiceLine[] {
  return stored
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [description = '', amount = '', ...items] = line.split(SEPARATOR).map((part) => part.trim())
      return { description, amount: storedFieldOfValue(amount).money ?? UNREADABLE_AMOUNT, items: items.filter((item) => item !== '') }
    })
}

export function textOfLines(lines: readonly InvoiceLine[]): string {
  return lines.map((line) => [line.description, amountText(line.amount), ...line.items].map((part) => part.trim()).join(` ${SEPARATOR} `)).join('\n')
}

/** A register row's `lines` cell reads, keeps the line rule and adds up to the row's amount. A blank cell is a row without lines. */
export function registerLinesProblems(stored: string, amount: Money): RegisterLinesProblem[] {
  if (stored.trim() === '') return []
  const lines = linesOfText(stored)
  const problems = lineProblems(lines)
  if (problems.length > 0) return problems
  const total = linesTotal(lines)
  return total === amount ? [] : [{ kind: 'total', total, amount }]
}
