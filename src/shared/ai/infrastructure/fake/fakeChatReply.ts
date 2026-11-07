import type { ModelReply, ModelRequest, ToolCall } from '../../application/modelPort'
import type { ModelTokens } from '../../domain/modelUsage'
import { language } from '../../../text/language'

const ANSWERS = {
  en: {
    rules: 'Pick a category on **To review** and choose **Always for this payee**.\n- Each rule then files new rows\n- A row you filed yourself stays as it is',
    cannot: "Kuna can't do that yet. You can write it down on its issues page.",
    other: 'Kuna keeps each app in a file of its own, and I can tell you how any of them works.',
    spent: (figure: string) => `You spent ${figure} this month.`,
    paid: (who: string, amount: string) => `The latest payment to a person went to ${who}: ${amount}.`,
    notRead: "You didn't allow reading Spending, so I can only tell you how it works.",
    invented: 'Last year it was €4,300.00.',
  },
  hr: {
    rules: 'Odaberite kategoriju na **Za pregled** i zatim **Uvijek za ovog primatelja**.\n- Svako pravilo zatim razvrstava nove retke\n- Redak koji ste sami razvrstali ostaje kakav jest',
    cannot: 'Kuna to još ne može. Možete to zapisati na njezinoj stranici s prijavama.',
    other: 'Kuna svaku aplikaciju čuva u zasebnoj datoteci i mogu vam reći kako koja radi.',
    spent: (figure: string) => `Ovaj mjesec potrošili ste ${figure}.`,
    paid: (who: string, amount: string) => `Zadnja uplata osobi otišla je na ${who}: ${amount}.`,
    notRead: 'Niste dopustili čitanje Potrošnje, pa vam mogu reći samo kako radi.',
    invented: 'Prošle godine bilo je 4.300,00 €.',
  },
}

/** What the tools have answered since the person's last message. */
function answersSince(request: ModelRequest): readonly { readonly text: string; readonly isError: boolean }[] {
  const lastPerson = request.turns.map((turn) => turn.role).lastIndexOf('user')
  return request.turns.slice(lastPerson).flatMap((turn) => (turn.role === 'tool-results' ? turn.results : []))
}

/** A person's name came as an alias, or as it is with aliases off: the first payee of the rows that reads as a name. */
function latestPersonPaid(found: string): { readonly payee: string; readonly amount: string } | null {
  const { records } = JSON.parse(found) as { readonly records: readonly { readonly payee?: string; readonly amount: string }[] }
  const row = records.find((record) => /^(?:Person \d+|\p{Lu}\p{L}+ \p{Lu}\p{L}+)$/u.test(record.payee ?? ''))
  return row === undefined ? null : { payee: row.payee ?? '', amount: row.amount }
}

/** Reads the month's figures and the latest rows as a real model would, and answers from what the tools gave, with an amount of its own if told to invent one. */
function spendingReply(request: ModelRequest, tokens: ModelTokens, invents: boolean, says: (typeof ANSWERS)['en']): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_figures', { app: 'spending', report: 'month', period: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, limit: 5, cursor: null }, tokens)
  const { figures } = JSON.parse(answers[0]!.text) as { readonly figures: readonly { readonly ref: string }[] }
  const paid = latestPersonPaid(answers[1]!.text)
  const parts = [says.spent(`[${figures[0]!.ref}]`), ...(paid === null ? [] : [says.paid(paid.payee, paid.amount)]), ...(invents ? [says.invented] : [])]
  return answered(request, parts.join(' '), tokens)
}

/** The last thing the person typed, and how many lookups have been answered since. */
function whereTheTurnIs(request: ModelRequest): { readonly typed: string; readonly lookups: number } {
  const lastPerson = request.turns.map((turn) => turn.role).lastIndexOf('user')
  const person = request.turns[lastPerson]
  const lastPart = person?.role === 'user' ? person.parts.at(-1) : undefined
  const typed = lastPart?.kind === 'text' ? lastPart.text : ''
  return { typed, lookups: request.turns.slice(lastPerson).filter((turn) => turn.role === 'tool-results').length }
}

function lookup(lookups: number, name: string, args: unknown, tokens: ModelTokens): ModelReply {
  const call: ToolCall = { id: `fake-call-${lookups}`, name, args }
  return { kind: 'tool-calls', calls: [call], raw: [call], tokens }
}

function answered(request: ModelRequest, text: string, tokens: ModelTokens): ModelReply {
  for (const piece of text.match(/\S+\s*/g) ?? []) request.onDelta?.(piece)
  return { kind: 'answer', text, raw: [{ text }], tokens }
}

/**
 * The fake build's chat, which walks the tools as a real model would: a question about spending reads figures and rows,
 * one about rules reads the guide and links its tab, one about something Kuna lacks links the issues page, and anything else gets a line.
 */
export function fakeChatReply(request: ModelRequest, tokens: ModelTokens, invents: boolean): ModelReply {
  const { typed, lookups } = whereTheTurnIs(request)
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/spent|spend|potroš/i.test(typed)) return spendingReply(request, tokens, invents, says)
  if (/rule|pravil/i.test(typed)) {
    if (lookups === 0) return lookup(lookups, 'kuna_docs', { path: 'spending/guide/first-rules' }, tokens)
    if (lookups === 1) return lookup(lookups, 'show_screen', { route: '/spending/settings?tab=rules' }, tokens)
    return answered(request, says.rules, tokens)
  }
  if (/crypto|kripto/i.test(typed)) {
    if (lookups === 0) return lookup(lookups, 'show_screen', { route: 'issues' }, tokens)
    return answered(request, says.cannot, tokens)
  }
  return answered(request, says.other, tokens)
}
