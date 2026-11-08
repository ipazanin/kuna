import { computed, markRaw, reactive, readonly, shallowReactive, shallowRef } from 'vue'

import type { AppContribution } from '../../app/appContribution'
import type { CheckedProposal, UndoResult } from '../../app/assistantOperations'
import { plainAmount } from '../../money/money'
import { catalogueOf, placeAt } from '../application/catalogue'
import type { Catalogue } from '../application/catalogue'
import type { ChatReads } from '../application/chatReads'
import type { ChatChip } from '../application/chatTools'
import type { ModelTurn } from '../application/modelPort'
import { CHAT_TASK_ID, NOTHING_TAGGED, contextLine, elementLine, runChatTurn } from '../application/runChatTurn'
import type { ChatContext, SentRead } from '../application/runChatTurn'
import type { LoopEnd } from '../application/runModelLoop'
import { chatRefs } from '../domain/chatRefs'
import { documentSizeOf, nextAttachmentId, sendsToModel } from '../domain/chatAttachments'
import type { AttachmentRefusal, ChatAttachment } from '../domain/chatAttachments'
import { costOfDocument } from '../domain/modelUsage'
import { attachedFile } from '../application/chatFiles'
import { newPseudonyms } from '../../privacy/domain/pseudonyms'
import type { PersonWord } from '../../privacy/domain/pseudonyms'
import { language } from '../../text/language'
import type { ChatFigure } from '../domain/chatRefs'
import type { ChatElementAbout } from '../domain/chatElement'
import { forgetSavedChat, readSavedChat, saveChat } from '../application/savedChat'
import type { ProposalState, SavedChat, SavedLine, SavedProposal } from '../application/savedChat'
import { modelPort } from '../application/modelAccess'
import { anonymiseOn, assistOn, modelOf, switchAssist } from '../application/assistSettings'
import type { ProviderId, ProviderPreset } from '../domain/providerPresets'
import type { KunaChat } from './chatApps'
import { imagePartOf } from './imagePartOf'
import { MOST_RUN_MILLISECONDS, costWords, providerInUse, resultLine } from './useAiTask'
import { words } from './words'

export interface ChatLine {
  readonly id: string
  readonly role: 'user' | 'assistant'
  /** When the line was written, in milliseconds, which tells this browser when to let it go. */
  readonly at: number
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
  /** The cards this message showed. */
  proposals: ChatProposal[]
  /** The names of the files a message went with. */
  attachments: string[]
}

/** A card in the chat. `checked` is gone after a reload, and with it Accept and Undo. */
export interface ChatProposal extends SavedProposal {
  readonly checked: CheckedProposal | null
  state: ProposalState
  /** Why Kuna refused it, in a sentence that can name a record, so it stays out of what this browser keeps. */
  reason: string | null
  /** What the person should know of a write that went through, kept out of what this browser keeps as the reason is. */
  warning: string | null
  /** Puts back what Accept wrote, while this page lives. */
  undo: (() => Promise<UndoResult>) | null
}

/** The chat wants to read an app and waits for the person. */
export interface ReadAsk {
  readonly app: string
  readonly name: string
}

/** How a person answered: yes for this chat, yes on this device, or no. */
export type ReadAnswer = 'chat' | 'always' | 'no'

/** Why a file on the prompt cannot go: Kuna's own check, or a provider that reads no PDFs. */
export type FileRefusal = AttachmentRefusal | { readonly reason: 'no-pdf'; readonly provider: string }

/** A file on the prompt: being read on this device, waiting to go with the next message, or refused, with why. */
export type PromptFile =
  | { readonly key: string; readonly name: string; readonly state: 'reading' }
  | { readonly key: string; readonly name: string; readonly state: 'ready'; readonly attachment: ChatAttachment }
  | { readonly key: string; readonly name: string; readonly state: 'refused'; readonly refusal: FileRefusal }

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

/** The files on the prompt as Kuna read them, in the order they were attached. */
const promptFiles = shallowReactive<PromptFile[]>([])
/** Every file sent in this chat, held in memory only, which the model reads by its id and which goes with the chat. */
const attached: ChatAttachment[] = []
/** How many attachment ids this page handed out. A new chat goes on counting, so a read still under way from the last one cannot take a new file's place. */
let idsHandedOut = 0

let history: readonly ModelTurn[] = []
let lastContext: string | null = null
/** The line naming the tag and the files that the model last read, or null when it read none. */
let lastElement: string | null = null
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
/** What the model has not heard yet of how its cards ended, which goes at the start of the next message. */
const outcomes: string[] = []
/** People go out as aliases in the screen's language, so the person reads the same word the model writes. */
const PERSON_WORD: PersonWord = language === 'hr' ? 'Osoba' : 'Person'

/** The aliases, tokens and refs of this chat, held in memory only, and gone with it. */
let pseudonyms = newPseudonyms(PERSON_WORD)
let refs = chatRefs()

function added(role: ChatLine['role'], text: string, note = false, at = Date.now()): ChatLine {
  nextId += 1
  lines.push({ id: `chat-${nextId}`, role, at, text, chips: [], failure: null, retry: null, note, sent: [], strayFigure: false, proposals: [], attachments: [] })
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
    lastElement = null
  }
  chain = next
}

let catalogue: Promise<Catalogue> | null = null

/**
 * What a chat knows, built once as the first message goes and kept for the visit. It reads what each app declares and
 * none of what a person's books decide, so it takes every screen but a first run. A screen that opens one record is
 * taken only when the app declares it as a place, whose parameters a link fills from a record's ref.
 */
export function loadCatalogue(apps: readonly AppContribution[], kuna: KunaChat): Promise<Catalogue> {
  catalogue ??= Promise.all([
    kuna.assistant(),
    Promise.all(
      apps.map(async (app) => {
        const assistant = await app.assistant()
        const linkable = new Set(assistant.places.map((place) => place.route.split('?')[0]))
        return {
          id: app.id,
          name: app.name,
          purpose: app.homeCard.purpose,
          screens: app.screens.filter((screen) => screen.bare !== true && (screen.needsRecord !== true || linkable.has(screen.path))).map(({ path, title }) => ({ path, title })),
          assistant,
        }
      }),
    ),
  ]).then(([kunaAssistant, catalogueApps]) => catalogueOf(catalogueApps, { id: kuna.id, name: kuna.name, purpose: kuna.purpose, screens: kuna.screens, assistant: kunaAssistant }))
  return catalogue
}

/** Where the person is, as the screen knows it, and what they tagged there. The query is read only for a place the catalogue declares. */
export interface ChatWhere extends Omit<ChatContext, 'place'> {
  readonly query: Readonly<Record<string, unknown>>
  /** The element the chat is about, the same object for as long as it stays tagged, or null. */
  readonly element: ChatElementAbout | null
}

function contextAt(where: ChatWhere, known: Catalogue): ChatContext {
  const place = placeAt(known, where.path, where.query)
  return { app: where.app, screen: where.screen, place: place?.title ?? null, path: place?.address ?? where.path, today: where.today }
}

/** An answer as this browser keeps it: no alias is turned back, as the map is never stored, and a figure ref is written out, as its figure goes with the page. */
function storedText(text: string): string {
  return text.replace(/\[(f\d+)\]/g, (written, ref: string) => {
    const figure = refs.figureOf(ref)
    return figure === null ? written : `${plainAmount(figure.cents)} ${figure.currency}`
  })
}

function savedLine(line: ChatLine): SavedLine {
  return {
    role: line.role,
    at: line.at,
    text: line.role === 'assistant' ? storedText(line.text) : line.text,
    note: line.note,
    chips: [...line.chips],
    strayFigure: line.strayFigure,
    failure: line.failure,
    proposals: line.proposals.map(({ id, app, title, count, state }) => ({ id, app, title, count, state })),
    ...(line.attachments.length === 0 ? {} : { attachments: [...line.attachments] }),
  }
}

/** The line that says a chat came back, which shows once per restore and is never kept. */
let restoredNote: string | null = null

/** The latest save of the chat to this browser. */
let lastKept: Promise<void> = Promise.resolve()

/** Keeps the chat in this browser: what was said and how cards ended, with no tool result, no alias map and nothing to accept. */
function keepChat(): void {
  lastKept = saveChat({ lines: lines.filter((line) => line.id !== restoredNote).map(savedLine), spent: { ...spent } })
}

/** Resolves once the chat as it stands is written to this browser, so a reload keeps how each card ended. */
export function chatKept(): Promise<void> {
  return lastKept
}

/** What a card shows after a reload: its outcome, as nothing is left to accept or undo. */
function restoredState(state: ProposalState): ProposalState {
  if (state === 'open') return 'ended'
  return state === 'done' ? 'undo-ended' : state
}

function restored(saved: SavedChat): void {
  restoredNote = added('assistant', words.history.restored, true).id
  for (const line of saved.lines) {
    const shown = added(line.role, line.text, line.note, line.at)
    shown.chips = [...line.chips]
    shown.strayFigure = line.strayFigure
    shown.failure = line.failure
    shown.proposals = line.proposals.map((proposal) => ({ ...proposal, checked: null, state: restoredState(proposal.state), reason: null, warning: null, undo: null }))
    shown.attachments = [...(line.attachments ?? [])]
  }
  Object.assign(spent, saved.spent)
}

let restoring: Promise<void> | null = null

/** Brings back the last chat of this browser, once a visit, unless one was begun. The model starts fresh from here, so what it read last time does not come back. */
export function restoreChat(): Promise<void> {
  restoring ??= readSavedChat().then((saved) => {
    if (saved !== null && lines.length === 0) restored(saved)
  })
  return restoring
}

function heldProposal(id: string): ChatProposal | undefined {
  return lines.flatMap((line) => line.proposals).find((candidate) => candidate.id === id)
}

/** How a card ended, kept in this browser and told to the model with the next message. */
export function settleProposal(proposal: ChatProposal, state: ProposalState, reason: string | null = null, undo: ChatProposal['undo'] = null, warning: string | null = null): void {
  const held = heldProposal(proposal.id)
  if (held === undefined) return
  held.state = state
  held.reason = reason
  held.warning = warning
  held.undo = undo
  const outcome = {
    done: `The person accepted the card "${proposal.title}", and it is written.`,
    undone: `The person undid the card "${proposal.title}".`,
    declined: `The person did not accept the card "${proposal.title}".`,
    refused: `Kuna refused the card "${proposal.title}" when the person answered it, as a record changed since.`,
  }[state as 'done' | 'undone' | 'declined' | 'refused']
  if (outcome !== undefined) outcomes.push(outcome)
  keepChat()
}

/**
 * Puts back what the card wrote. When Kuna refuses, the card stays done with no Undo and says why, and the model hears
 * with the next message that the person tried and the write stands.
 */
export async function undoProposal(proposal: Pick<ChatProposal, 'id'>): Promise<void> {
  const held = heldProposal(proposal.id)
  if (held === undefined || held.undo === null) return
  let result: UndoResult
  try {
    result = await held.undo()
  } catch {
    result = { kind: 'refused', reason: words.proposal.undoFailed }
  }
  if (result.kind === 'undone') {
    settleProposal(held, 'undone')
    return
  }
  held.undo = null
  held.reason = result.reason
  outcomes.push(`The person tried to undo the card "${held.title}", but Kuna refused, so what it wrote stands.`)
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

/** The question open for each app, so a second read of it in the same round waits for that answer instead of asking again. */
const openReadAsks = new Map<string, Promise<boolean>>()

/** Whether the person lets the chat read the app, asked once however many reads wait on it. */
function readAnswered(ask: ReadAsk, provider: ProviderId, pauseClock: () => () => void): Promise<boolean> {
  const open = openReadAsks.get(ask.app)
  if (open !== undefined) return open
  const answered = askToRead(ask, pauseClock).then((answer) => {
    openReadAsks.delete(ask.app)
    if (answer === 'no') {
      refusedThisMessage.add(ask.app)
      return false
    }
    if (answer === 'always') switchAssist(ask.app, true)
    allowThisChat(provider, ask.app)
    return true
  })
  openReadAsks.set(ask.app, answered)
  return answered
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
    pseudonyms,
    refs,
    anonymising: () => anonymiseOn(provider),
    persons: () => catalogue.persons(),
    mayRead: async (app) => {
      if (assistOn(app) || (allowedFor === provider && appsAllowed.has(app))) return true
      const name = catalogue.readers.get(app)?.name
      if (refusedThisMessage.has(app) || name === undefined) return false
      return readAnswered({ app, name }, provider, pauseClock)
    },
  }
}

/** Reads each file on this device and puts it on the prompt, or puts it there refused with why, so a person sees what did not take. */
export async function attachFiles(files: readonly File[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      const waiting = promptFiles.filter((shown) => shown.state !== 'refused').length
      const id = nextAttachmentId(idsHandedOut)
      idsHandedOut += 1
      const key = `file-${id}`
      promptFiles.push({ key, name: file.name, state: 'reading' })
      const read = await attachedFile(file, id, waiting, imagePartOf)
      const at = promptFiles.findIndex((shown) => shown.key === key)
      if (at === -1) return
      promptFiles[at] = 'reason' in read ? { key, name: file.name, state: 'refused', refusal: read } : { key, name: file.name, state: 'ready', attachment: markRaw(read) }
    }),
  )
}

export function removePromptFile(key: string): void {
  const at = promptFiles.findIndex((shown) => shown.key === key)
  if (at === -1) return
  promptFiles.splice(at, 1)
}

function dropPromptFiles(): void {
  promptFiles.splice(0)
}

function noPdfBy(preset: ProviderPreset | null): FileRefusal | null {
  return preset === null || preset.readsPdf ? null : { reason: 'no-pdf', provider: preset.name }
}

/** The files on the prompt as their chips show them. A PDF waits refused while the provider in use reads none, and is ready again once it does. */
export const chatPromptFiles = computed<readonly PromptFile[]>(() => {
  const noPdf = noPdfBy(providerInUse())
  return promptFiles.map((file) => (noPdf !== null && file.state === 'ready' && file.attachment.kind === 'pdf' ? { key: file.key, name: file.name, state: 'refused', refusal: noPdf } : file))
})

/** Whether a PDF on the prompt waits for a provider that reads it, which holds the message back. */
export const promptPdfsRefused = computed(() => chatPromptFiles.value.some((file) => file.state === 'refused' && file.refusal.reason === 'no-pdf'))

/** Whether a photo or a PDF on the prompt goes to the model whole. */
export const promptSendsDocument = computed(() => chatPromptFiles.value.some((file) => file.state === 'ready' && sendsToModel(file.attachment.kind)))

/** The files that go with a message leave the prompt, with any refused, and the chat holds them for the model's reads. */
function sentFiles(): readonly ChatAttachment[] {
  const going = promptFiles.flatMap((file) => (file.state === 'ready' ? [file.attachment] : []))
  for (const file of promptFiles.filter((shown) => shown.state !== 'reading')) removePromptFile(file.key)
  attached.push(...going)
  return going
}

/** Sends one message and writes what comes back on its line. A failed message leaves the turns as they were, so the next one goes on from the last answer. */
export async function sendChatMessage(message: string, where: ChatWhere, knowledge: () => Promise<Catalogue>): Promise<void> {
  const preset = providerInUse()
  if (promptPdfsRefused.value) return
  if (preset !== null) startChainOn(`${preset.id}/${modelOf(preset.id).id}`)
  added('user', message).attachments = sentFiles().map((attachment) => attachment.name)
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
    const reads = readsOf(catalogue, preset.id, pauseClock)
    const contextNow = contextLine(contextAt(where, catalogue))
    const elementNow = elementLine(where.element, attached, catalogue, reads)
    const heard = outcomes.splice(0).map((outcome) => `<context>${outcome}</context>`)
    const changed = [...(contextNow === lastContext ? [] : [contextNow]), ...(elementNow === lastElement ? [] : [elementNow ?? NOTHING_TAGGED]), ...heard]
    const end = await runChatTurn({
      model,
      catalogue,
      reads,
      history,
      context: changed.length === 0 ? null : changed.join('\n'),
      attachments: [...attached],
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
      showProposal: (app, proposal) => {
        if (current !== controller) return
        nextId += 1
        line.proposals.push({ id: `card-${nextId}`, app, title: proposal.title, count: proposal.count, checked: markRaw(proposal), state: 'open', reason: null, warning: null, undo: null })
      },
    })
    if (current !== controller) return
    addSpending(end)
    if (end.kind === 'answer') {
      line.text = end.text
      line.strayFigure = refs.holdsStrayFigure(end.text)
      history = end.turns
      lastContext = contextNow
      lastElement = elementNow
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
      if (stoppedByPerson && line.text === '' && line.chips.length === 0 && line.sent.length === 0 && line.proposals.length === 0) lines.splice(lines.indexOf(line), 1)
      keepChat()
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
  lastElement = null
  chain = null
  allowedFor = null
  appsAllowed.clear()
  pseudonyms = newPseudonyms(PERSON_WORD)
  refs = chatRefs()
  dropPromptFiles()
  attached.splice(0)
  outcomes.splice(0)
  void forgetSavedChat()
  chatDraft.value = ''
  Object.assign(spent, { dollars: 0, unknown: false, any: false })
}

export const chatLines = readonly(lines)
export const chatStatus = readonly(status)
/** What the chat is waiting to be allowed to read, or null. */
export const chatAsking = readonly(asking)

/** An answer as the person sees it, with this chat's aliases back as what they stand for. Neither leaves the page. */
export function shownOnScreen(text: string): string {
  return pseudonyms.restored(text)
}

/** Kuna's own figure behind a ref in an answer, or null for one no tool gave. */
export function chatFigure(ref: string): ChatFigure | null {
  return refs.figureOf(ref)
}

/** What the chat has spent so far, as "about $0.04", or null before it spent anything. It only ever informs, and nothing stops on it. */
export const chatSpent = computed(() => (spent.any ? costWords(spent.unknown ? null : spent.dollars) : null))

/**
 * What the files waiting on the prompt add, to read and to each later message while they stay in the chat, or null when
 * none goes to the model. It informs only. Each file is counted alone, as the chat's own prompt is not known before it goes.
 */
export const promptFilesCost = computed(() => {
  const sizes = chatPromptFiles.value.flatMap((file) => {
    const size = file.state === 'ready' ? documentSizeOf(file.attachment) : null
    return size === null ? [] : [size]
  })
  const preset = providerInUse()
  if (sizes.length === 0 || preset === null) return null
  const price = modelOf(preset.id).price
  if (price === null) return words.files.costUnknown
  const costs = sizes.map((size) => costOfDocument(size, price, 0))
  return words.files.cost(costWords(costs.reduce((sum, cost) => sum + cost.toRead, 0)), costWords(costs.reduce((sum, cost) => sum + cost.eachLaterRequest, 0)))
})
