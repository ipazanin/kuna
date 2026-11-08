import type { ModelReply, ModelRequest, ToolCall } from '../../application/modelPort'
import type { ModelTokens } from '../../domain/modelUsage'
import { language } from '../../../text/language'

const ANSWERS = {
  en: {
    cannot: "Kuna can't do that yet. You can write it down on its issues page.",
    other: 'Kuna keeps each app in a file of its own, and I can tell you how any of them works.',
  },
  hr: {
    cannot: 'Kuna to još ne može. Možete to zapisati na njezinoj stranici s prijavama.',
    other: 'Kuna svaku aplikaciju čuva u zasebnoj datoteci i mogu vam reći kako koja radi.',
  },
}

/** What the person typed last, and the turn so far, for one app's part of the fake chat. */
export interface FakeChatTurn {
  readonly request: ModelRequest
  readonly tokens: ModelTokens
  readonly typed: string
  /** How many lookups have been answered since the person's last message. */
  readonly lookups: number
  /** Whether the answer should hold an amount Kuna did not send. */
  readonly invents: boolean
}

/** One app's part of the fake chat: its reply to what the person typed, or null when that is not about the app. */
export type FakeAppChat = (turn: FakeChatTurn) => ModelReply | null

const appChats: FakeAppChat[] = []

/** Lets an app's fake seed answer the fake chat's questions about the app, ahead of the replies every build gives. */
export function registerFakeChat(chat: FakeAppChat): void {
  appChats.push(chat)
}

/** What the tools have answered since the person's last message. */
export function answersSince(request: ModelRequest): readonly { readonly text: string; readonly isError: boolean }[] {
  const lastPerson = request.turns.map((turn) => turn.role).lastIndexOf('user')
  return request.turns.slice(lastPerson).flatMap((turn) => (turn.role === 'tool-results' ? turn.results : []))
}

/** The last thing the person typed, and how many lookups have been answered since. */
function whereTheTurnIs(request: ModelRequest): { readonly typed: string; readonly lookups: number } {
  const lastPerson = request.turns.map((turn) => turn.role).lastIndexOf('user')
  const person = request.turns[lastPerson]
  const lastPart = person?.role === 'user' ? person.parts.at(-1) : undefined
  const typed = lastPart?.kind === 'text' ? lastPart.text : ''
  return { typed, lookups: request.turns.slice(lastPerson).filter((turn) => turn.role === 'tool-results').length }
}

export function lookup(lookups: number, name: string, args: unknown, tokens: ModelTokens): ModelReply {
  const call: ToolCall = { id: `fake-call-${lookups}`, name, args }
  return { kind: 'tool-calls', calls: [call], raw: [call], tokens }
}

export function answered(request: ModelRequest, text: string, tokens: ModelTokens): ModelReply {
  for (const piece of text.match(/\S+\s*/g) ?? []) request.onDelta?.(piece)
  return { kind: 'answer', text, raw: [{ text }], tokens }
}

/**
 * The fake build's chat, which walks the tools as a real model would. Each app's fake seed answers what is about the app,
 * one about something Kuna lacks links the issues page, and anything else gets a line.
 */
export function fakeChatReply(request: ModelRequest, tokens: ModelTokens, invents: boolean): ModelReply {
  const { typed, lookups } = whereTheTurnIs(request)
  for (const chat of appChats) {
    const reply = chat({ request, tokens, typed, lookups, invents })
    if (reply !== null) return reply
  }
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/crypto|kripto/i.test(typed)) {
    if (lookups === 0) return lookup(lookups, 'show_screen', { route: 'issues', params: [] }, tokens)
    return answered(request, says.cannot, tokens)
  }
  return answered(request, says.other, tokens)
}
