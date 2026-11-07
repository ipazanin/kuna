import { computed, reactive, readonly, shallowRef } from 'vue'

import type { AppContribution } from '../../app/appContribution'
import { catalogueOf } from '../application/catalogue'
import type { Catalogue, CatalogueScreen } from '../application/catalogue'
import type { ChatChip } from '../application/chatTools'
import type { ModelTurn } from '../application/modelPort'
import { CHAT_TASK_ID, contextLine, runChatTurn } from '../application/runChatTurn'
import type { ChatContext } from '../application/runChatTurn'
import type { LoopEnd } from '../application/runModelLoop'
import { modelPort } from '../infrastructure/modelAccess'
import { modelOf } from '../infrastructure/assistSettings'
import type { ProviderId } from '../infrastructure/providerPresets'
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
}

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
/** The provider this chat got a yes for, held in memory only. The dialog names the provider, so a yes does not carry to another. */
let allowedFor: ProviderId | null = null

function added(role: ChatLine['role'], text: string, note = false): ChatLine {
  nextId += 1
  lines.push({ id: `chat-${nextId}`, role, text, chips: [], failure: null, retry: null, note })
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

/** Sends one message and writes what comes back on its line. A failed message leaves the turns as they were, so the next one goes on from the last answer. */
export async function sendChatMessage(message: string, context: ChatContext, knowledge: () => Promise<Catalogue>): Promise<void> {
  const preset = providerInUse()
  if (preset !== null) startChainOn(`${preset.id}/${modelOf(preset.id).id}`)
  added('user', message)
  const line = added('assistant', '')
  current?.abort()
  const controller = new AbortController()
  current = controller
  stoppedByPerson = false
  status.value = 'streaming'
  const timeout = setTimeout(() => controller.abort(new Error(words.result.timedOut)), MOST_RUN_MILLISECONDS)
  try {
    const model = preset === null ? null : await modelPort(CHAT_TASK_ID, preset)
    if (model === null) {
      line.failure = words.addKey
      return
    }
    const contextNow = contextLine(context)
    const end = await runChatTurn({
      model,
      catalogue: await knowledge(),
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
    })
    if (current !== controller) return
    addSpending(end)
    if (end.kind === 'answer') {
      line.text = end.text
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
      if (stoppedByPerson && line.text === '' && line.chips.length === 0) lines.splice(lines.indexOf(line), 1)
    }
  }
}

/** Takes the person's yes for the rest of this chat, on the provider the dialog named. */
export function allowThisChat(provider: ProviderId): void {
  allowedFor = provider
}

/** Whether this chat already has a yes for the provider. */
export function allowedThisChat(provider: ProviderId): boolean {
  return allowedFor === provider
}

/** Stops the message under way. What it spent so far is lost to the count, as the provider reports it only at the end. */
export function stopChatMessage(): void {
  stoppedByPerson = true
  current?.abort()
}

/** Starts over: nothing of the chat stays in this page. */
export function clearChat(): void {
  stoppedByPerson = true
  current?.abort()
  current = null
  status.value = 'ready'
  lines.splice(0)
  history = []
  lastContext = null
  chain = null
  allowedFor = null
  chatDraft.value = ''
  Object.assign(spent, { dollars: 0, unknown: false, any: false })
}

export const chatLines = readonly(lines)
export const chatStatus = readonly(status)

/** What the chat has spent so far, as "about $0.04", or null before it spent anything. It only ever informs, and nothing stops on it. */
export const chatSpent = computed(() => (spent.any ? costWords(spent.unknown ? null : spent.dollars) : null))
