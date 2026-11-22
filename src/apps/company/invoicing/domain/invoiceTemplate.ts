import { unknownTokensIn } from './templateTokens'

/** One line of a client's invoice template: what it says, and the plan items whose open amounts it sums. */
export interface InvoiceTemplateLine {
  readonly text: string
  readonly items: readonly string[]
}

/** The words in braces a template line may name. `{month}` becomes the issue month in the client's mail language. */
export const TEMPLATE_TOKENS = ['{month}'] as const

/** What is wrong with one line of a template, by its place from 0. */
export type TemplateProblem =
  | { readonly kind: 'blank-text'; readonly line: number }
  | { readonly kind: 'unknown-tokens'; readonly line: number; readonly tokens: readonly string[] }
  | { readonly kind: 'separator'; readonly line: number }
  | { readonly kind: 'no-items'; readonly line: number }
  | { readonly kind: 'item-twice'; readonly line: number; readonly item: string }

const SEPARATOR = '|'

/** A template as the client's `invoice_lines` field stores it: one line per line of text, the text first and each plan item after a `|`. */
export function templateOfText(stored: string): InvoiceTemplateLine[] {
  return stored
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [text = '', ...items] = line.split(SEPARATOR).map((part) => part.trim())
      return { text, items: items.filter((item) => item !== '') }
    })
}

export function textOfTemplate(lines: readonly InvoiceTemplateLine[]): string {
  return lines.map((line) => [line.text, ...line.items].map((part) => part.trim()).join(` ${SEPARATOR} `)).join('\n')
}

/**
 * Every line has a text that names no word in braces but `{month}`, and holds no `|` or line break,
 * which store the template. No plan item is on two lines, and every line but the last names at
 * least one, since the last line takes every plan item no line names.
 */
export function templateProblems(lines: readonly InvoiceTemplateLine[]): TemplateProblem[] {
  const problems: TemplateProblem[] = []
  const named = new Set<string>()
  lines.forEach((line, index) => {
    if (line.text.trim() === '') problems.push({ kind: 'blank-text', line: index })
    const tokens = unknownTokensIn(line.text, TEMPLATE_TOKENS)
    if (tokens.length > 0) problems.push({ kind: 'unknown-tokens', line: index, tokens })
    if ([line.text, ...line.items].some((part) => part.includes(SEPARATOR) || /[\r\n]/.test(part))) problems.push({ kind: 'separator', line: index })
    if (index < lines.length - 1 && line.items.length === 0) problems.push({ kind: 'no-items', line: index })
    for (const item of new Set(line.items)) {
      if (named.has(item)) problems.push({ kind: 'item-twice', line: index, item })
      named.add(item)
    }
  })
  return problems
}
