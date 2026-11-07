import type { ModelReply, ModelRequest, ToolCall } from '../../application/modelPort'
import type { ModelTokens } from '../../domain/modelUsage'
import { language } from '../../../text/language'

const ANSWERS = {
  en: {
    rules: 'Pick a category on **To review** and choose **Always for this payee**.\n- Each rule then files new rows\n- A row you filed yourself stays as it is',
    cannot: "Kuna can't do that yet. You can write it down on its issues page.",
    other: 'Kuna keeps each app in a file of its own, and I can tell you how any of them works.',
  },
  hr: {
    rules: 'Odaberite kategoriju na **Za pregled** i zatim **Uvijek za ovog primatelja**.\n- Svako pravilo zatim razvrstava nove retke\n- Redak koji ste sami razvrstali ostaje kakav jest',
    cannot: 'Kuna to još ne može. Možete to zapisati na njezinoj stranici s prijavama.',
    other: 'Kuna svaku aplikaciju čuva u zasebnoj datoteci i mogu vam reći kako koja radi.',
  },
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
 * The fake build's chat, which walks the tools as a real model would: a question about rules reads the guide and links its
 * tab, one about something Kuna lacks links the issues page, and anything else gets a line.
 */
export function fakeChatReply(request: ModelRequest, tokens: ModelTokens): ModelReply {
  const { typed, lookups } = whereTheTurnIs(request)
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
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
