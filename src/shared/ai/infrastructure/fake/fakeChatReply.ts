import type { FindRecordsInput } from '../../application/chatReads'
import type { ModelReply, ModelRequest, ToolCall } from '../../application/modelPort'
import type { ModelTokens } from '../../domain/modelUsage'
import { language } from '../../../text/language'
import { en as chatEnglish, hr as chatCroatian } from '../../presentation/words'

const ANSWERS = {
  en: {
    cannot: "Kuna doesn't track crypto.",
    feature: 'You can ask for it on the issues page linked below.',
    other: 'Kuna keeps each app in a file of its own, and I can tell you how any of them works.',
    readFile: 'I read the first rows of the file.',
    noFile: 'Attach a file with the paperclip first.',
  },
  hr: {
    cannot: 'Kuna ne prati kriptovalute.',
    feature: 'Možete to zatražiti na stranici s prijavama, poveznica je ispod.',
    other: 'Kuna svaku aplikaciju čuva u zasebnoj datoteci i mogu vam reći kako koja radi.',
    readFile: 'Pročitao sam prve retke datoteke.',
    noFile: 'Najprije priložite datoteku spajalicom.',
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

/** What each person's message said, oldest first, without the context lines Kuna put before it. */
function personMessages(request: ModelRequest): readonly string[] {
  return request.turns.flatMap((turn) => {
    if (turn.role !== 'user') return []
    const last = turn.parts.at(-1)
    return last?.kind === 'text' && !last.text.startsWith('<context>') ? [last.text] : []
  })
}

/**
 * How many times Kuna sent Go on for the job the person last asked for, counting the message now, when that is Go on and the job
 * fits `task`. Null otherwise, as a model lays out a job in its first answer and proposes the next card at each Go on.
 */
export function goOnsInto(request: ModelRequest, task: RegExp): number | null {
  const goOns = new Set([chatEnglish.chat.goOn, chatCroatian.chat.goOn])
  const said = personMessages(request)
  const asked = said.map((text) => !goOns.has(text)).lastIndexOf(true)
  if (asked === -1 || asked === said.length - 1 || !task.test(said[asked]!)) return null
  return said.length - 1 - asked
}

/** Whether the last line Kuna sent about where the person is names an app that is new, which a model sets up as a job of several cards. */
export function settingUp(request: ModelRequest): boolean {
  const places = JSON.stringify(request.turns).match(/<context>The person is in[^<]*<\/context>/g) ?? []
  return /is new\. |has no file on this device yet\./.test(places.at(-1) ?? '')
}

/** A find_records call's arguments, each at the tool's default unless `changes` sets it, as the tool's schema wants every key. */
export function findRecordsArgs(app: string, kind: string, changes: Partial<Omit<FindRecordsInput, 'app' | 'kind'>> = {}): FindRecordsInput {
  return { app, kind, query: null, from: null, to: null, refs: [], filters: [], sort: [], fields: [], only: null, limit: null, cursor: null, ...changes }
}

export function lookup(lookups: number, name: string, args: unknown, tokens: ModelTokens): ModelReply {
  const call: ToolCall = { id: `fake-call-${lookups}`, name, args }
  return { kind: 'tool-calls', calls: [call], raw: [call], tokens }
}

export function answered(request: ModelRequest, text: string, tokens: ModelTokens): ModelReply {
  for (const piece of text.match(/\S+\s*/g) ?? []) request.onDelta?.(piece)
  return { kind: 'answer', text, raw: [{ text }], tokens }
}

/** Reads the first rows of the sheet attached last, by the id its context line gives, and says so. */
function readFileReply(request: ModelRequest, tokens: ModelTokens, lookups: number, says: (typeof ANSWERS)['en']): ModelReply {
  const said = request.turns.flatMap((turn) => (turn.role === 'user' ? turn.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])) : []))
  const attachment = said.flatMap((text) => [...text.matchAll(/\b(a\d+) \(sheet\b/g)].map((match) => match[1]!)).at(-1)
  if (attachment === undefined) return answered(request, says.noFile, tokens)
  if (lookups === 0) return lookup(lookups, 'read_attachment', { attachment, pages: null, sheet: null, rows: '1-3' }, tokens)
  return answered(request, says.readFile, tokens)
}

/**
 * The fake build's chat, which walks the tools as a real model would. Each app's fake seed answers what is about the app,
 * one about something Kuna lacks says so and stops, one asking how to request a feature links the issues page, and anything
 * else gets a line.
 */
export function fakeChatReply(request: ModelRequest, tokens: ModelTokens, invents: boolean): ModelReply {
  const { typed, lookups } = whereTheTurnIs(request)
  for (const chat of appChats) {
    const reply = chat({ request, tokens, typed, lookups, invents })
    if (reply !== null) return reply
  }
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/^read the file|^pročitaj datoteku/i.test(typed)) return readFileReply(request, tokens, lookups, says)
  if (/crypto|kripto/i.test(typed)) return answered(request, says.cannot, tokens)
  if (/feature|značajk/i.test(typed)) {
    if (lookups === 0) return lookup(lookups, 'show_screen', { route: 'issues', params: [] }, tokens)
    return answered(request, says.feature, tokens)
  }
  return answered(request, says.other, tokens)
}
