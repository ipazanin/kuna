import { computed, reactive, readonly, shallowRef } from 'vue'

import type { AppContribution } from '../../app/appContribution'
import { catalogueOf, placeAt } from '../application/catalogue'
import type { Catalogue, CatalogueScreen } from '../application/catalogue'
import type { ChatReads } from '../application/chatReads'
import type { ChatChip } from '../application/chatTools'
import type { ModelTurn } from '../application/modelPort'
import { CHAT_TASK_ID, contextLine, runChatTurn } from '../application/runChatTurn'
import type { ChatContext, SentRead } from '../application/runChatTurn'
import type { LoopEnd } from '../application/runModelLoop'
import { chatRefs } from '../domain/chatRefs'
import type { ChatFigure } from '../domain/chatRefs'
import { chatAliases } from '../domain/sensitiveText'
import { modelPort } from '../application/modelAccess'
import { anonymiseOn, assistOn, modelOf, switchAssist } from '../application/assistSettings'
import type { ProviderId } from '../domain/providerPresets'
import { MOST_RUN_MILLISECONDS, costWords, providerInUse, resultLine } from './useAiTask'
import { words } from './words'

export interface ChatLine {
  readonly id: string
  readonly role: 'user' | 'assistant'
  text: string
  chips: ChatChip[]
  /** Why a message got no answer, in a sentence. */
  failure: string | null
  /** The message Try again sends, on a line that failed. */
  retry: string | null
  /** A line from Kuna about the chat itself, such as a change of model. */
  note: boolean
  /** What this message read from a person's books, each with the exact text that left. */
  sent: SentRead[]
  /** The answer writes an amount no tool returned, or a figure ref no tool gave. */
  strayFigure: boolean
}

/** The chat wants to read an app and waits for the person. */
export interface ReadAsk {
  readonly app: string
  readonly name: string
}

/** How a person answered: yes for this chat, yes on this device, or no. */
export type ReadAnswer = 'chat' | 'always' | 'no'

interface Spent {
  dollars: number
  /** Some request ran on a model whose price Kuna does not know. */
  unknown: boolean
  any: boolean
}

/** The chat kept in memory for this visit: it follows the person across apps and goes with a reload. */
const lines = reactive<ChatLine[]>([])
const spent = reactive<Spent>({ dollars: 0, unknown: false, any: false })
const status = shallowRef<'ready' | 'streaming'>('ready')

/** A question not sent yet, which stays while the panel is closed and goes with a new chat. */
export const chatDraft = shallowRef('')

let history: readonly ModelTurn[] = []
let lastContext: string | null = null
/** The provider and model `history` belongs to, since a provider's turns mean nothing to another and thinking blocks are tied to the model. */
let chain: string | null = null
let current: AbortController | null = null
let stoppedByPerson = false
let nextId = 0
/** The provider this chat got a yes for, and the apps it may read, held in memory only. The card names the provider, so a yes does not carry to another. */
let allowedFor: ProviderId | null = null
const appsAllowed = new Set<string>()
/** What a yes or a no on the card waits to hear, oldest first, as a model may ask for two apps at once. */
const asks: { readonly ask: ReadAsk; readonly answer: (answer: ReadAnswer) => void }[] = []
const asking = shallowRef<ReadAsk | null>(null)
/** The apps a person said no to on this message, so a model cannot ask again and again within it. */
const refusedThisMessage = new Set<string>()
/** The aliases and refs of this chat, held in memory only, and gone with it. */
let aliases = chatAliases()
let refs = chatRefs()

function added(role: ChatLine['role'], text: string, note = false): ChatLine {
  nextId += 1
  lines.push({ id: `chat-${nextId}`, role, text, chips: [], failure: null, retry: null, note, sent: [], strayFigure: false })
  return lines[lines.length - 1]!
}

function addSpending(end: LoopEnd): void {
  if (end.usage === null) return
  spent.any = true
  if (end.usage.dollars === null) spent.unknown = true
  else spent.dollars += end.usage.dollars
}

function startChainOn(next: string): void {
  if (chain !== null && chain !== next && lines.length > 0) added('assistant', words.chat.chainChanged, true)
  if (chain !== next) {
    history = []
    lastContext = null
  }
  chain = next
}

let catalogue: Promise<Catalogue> | null = null

/**
 * What a chat knows, built once as the first message goes and kept for the visit. It reads what each app declares and
 * none of what a person's books decide, so it takes every screen but a first run and those that open one record.
 */
export function loadCatalogue(apps: readonly AppContribution[], kunaScreens: readonly CatalogueScreen[]): Promise<Catalogue> {
  catalogue ??= Promise.all(
    apps.map(async (app) => ({
      id: app.id,
      name: app.name,
      purpose: app.homeCard.purpose,
      screens: app.screens.filter((screen) => screen.bare !== true && screen.needsRecord !== true).map(({ path, title }) => ({ path, title })),
      assistant: await app.assistant(),
    })),
  ).then((catalogueApps) => catalogueOf(catalogueApps, kunaScreens))
  return catalogue
}

/** Where the person is, as the screen knows it. The query is read only for a place the catalogue declares. */
export interface ChatWhere extends Omit<ChatContext, 'place'> {
  readonly query: Readonly<Record<string, unknown>>
}

function contextAt(where: ChatWhere, known: Catalogue): ChatContext {
  const place = placeAt(known, where.path, where.query)
  return { app: where.app, screen: where.screen, place: place?.title ?? null, path: place?.address ?? where.path, tag: where.tag, today: where.today }
}

/** Puts the question on the card and waits. The clock of the run stops meanwhile, as a person may take their time. */
function askToRead(ask: ReadAsk, pauseClock: () => () => void): Promise<ReadAnswer> {
  const resume = pauseClock()
  return new Promise((resolve) => {
    asks.push({
      ask,
      answer: (answer) => {
        resume()
        resolve(answer)
      },
    })
    asking.value = asks[0]!.ask
  })
}

/** Answers the question on the card. Always stays on this device and shows only where a switch can take it back, and any yes lasts this chat. */
export function answerReadAsk(answer: ReadAnswer): void {
  const waiting = asks.shift()
  asking.value = asks[0]?.ask ?? null
  waiting?.answer(answer)
}

/** The gate of a chat's reads: the app's switch, this chat's yes, or else the person. */
function readsOf(catalogue: Catalogue, provider: ProviderId, pauseClock: () => () => void): ChatReads {
  return {
    readers: catalogue.readers,
    aliases,
    refs,
    anonymising: anonymiseOn,
    mayRead: async (app) => {
      if (assistOn(app) || (allowedFor === provider && appsAllowed.has(app))) return true
      const name = catalogue.readers.get(app)?.name
      if (refusedThisMessage.has(app) || name === undefined) return false
      const answer = await askToRead({ app, name }, pauseClock)
      if (answer === 'no') {
        refusedThisMessage.add(app)
        return false
      }
      if (answer === 'always') switchAssist(app, true)
      allowThisChat(provider, app)
      return true
    },
  }
}

/** Sends one message and writes what comes back on its line. A failed message leaves the turns as they were, so the next one goes on from the last answer. */
export async function sendChatMessage(message: string, where: ChatWhere, knowledge: () => Promise<Catalogue>): Promise<void> {
  const preset = providerInUse()
  if (preset !== null) startChainOn(`${preset.id}/${modelOf(preset.id).id}`)
  added('user', message)
  const line = added('assistant', '')
  current?.abort()
  const controller = new AbortController()
  current = controller
  stoppedByPerson = false
  refusedThisMessage.clear()
  status.value = 'streaming'
  const timedOut = (): void => controller.abort(new Error(words.result.timedOut))
  let timeout = setTimeout(timedOut, MOST_RUN_MILLISECONDS)
  const pauseClock = (): (() => void) => {
    clearTimeout(timeout)
    return () => {
      timeout = setTimeout(timedOut, MOST_RUN_MILLISECONDS)
    }
  }
  try {
    const model = preset === null ? null : await modelPort(CHAT_TASK_ID, preset)
    if (model === null || preset === null) {
      line.failure = words.addKey
      return
    }
    const catalogue = await knowledge()
    const contextNow = contextLine(contextAt(where, catalogue))
    const end = await runChatTurn({
      model,
      catalogue,
      reads: readsOf(catalogue, preset.id, pauseClock),
      history,
      context: contextNow === lastContext ? null : contextNow,
      message,
      signal: controller.signal,
      onDelta: (delta) => {
        if (current === controller) line.text += delta
      },
      onLookup: () => {
        if (current === controller) line.text = ''
      },
      showChip: (chip) => {
        if (current === controller) line.chips.push(chip)
      },
      onSent: (sent) => {
        if (current === controller) line.sent.push(sent)
      },
    })
    if (current !== controller) return
    addSpending(end)
    if (end.kind === 'answer') {
      line.text = end.text
      line.strayFigure = refs.holdsStrayFigure(end.text)
      history = end.turns
      lastContext = contextNow
    } else if (!stoppedByPerson) {
      line.failure = resultLine(end)
      line.retry = message
    }
  } catch (failure) {
    if (current === controller && !stoppedByPerson) {
      line.failure = words.result.failed(failure instanceof Error ? failure.message : String(failure))
      line.retry = message
    }
  } finally {
    clearTimeout(timeout)
    if (current === controller) {
      current = null
      status.value = 'ready'
      if (stoppedByPerson && line.text === '' && line.chips.length === 0 && line.sent.length === 0) lines.splice(lines.indexOf(line), 1)
    }
  }
}

/** Takes the person's yes for the rest of this chat, on the provider the card named, with the app it may read if the card named one. */
export function allowThisChat(provider: ProviderId, app: string | null = null): void {
  if (allowedFor !== provider) appsAllowed.clear()
  allowedFor = provider
  if (app !== null) appsAllowed.add(app)
}

/** Whether this chat already has a yes for the provider. */
export function allowedThisChat(provider: ProviderId): boolean {
  return allowedFor === provider
}

/** Stops the message under way. What it spent so far is lost to the count, as the provider reports it only at the end. */
export function stopChatMessage(): void {
  stoppedByPerson = true
  current?.abort()
  while (asks.length > 0) answerReadAsk('no')
}

/** Starts over: nothing of the chat stays in this page. */
export function clearChat(): void {
  stoppedByPerson = true
  current?.abort()
  current = null
  while (asks.length > 0) answerReadAsk('no')
  status.value = 'ready'
  lines.splice(0)
  history = []
  lastContext = null
  chain = null
  allowedFor = null
  appsAllowed.clear()
  aliases = chatAliases()
  refs = chatRefs()
  chatDraft.value = ''
  Object.assign(spent, { dollars: 0, unknown: false, any: false })
}

export const chatLines = readonly(lines)
export const chatStatus = readonly(status)
/** What the chat is waiting to be allowed to read, or null. */
export const chatAsking = readonly(asking)

/** An answer as the person sees it, with this chat's aliases back as what they stand for. Neither leaves the page. */
export function shownOnScreen(text: string): string {
  return aliases.restored(text)
}

/** Kuna's own figure behind a ref in an answer, or null for one no tool gave. */
export function chatFigure(ref: string): ChatFigure | null {
  return refs.figureOf(ref)
}

/** What the chat has spent so far, as "about $0.04", or null before it spent anything. It only ever informs, and nothing stops on it. */
export const chatSpent = computed(() => (spent.any ? costWords(spent.unknown ? null : spent.dollars) : null))
