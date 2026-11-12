import { computed, markRaw, reactive, readonly, shallowReactive, shallowRef } from 'vue'

import type { AppContribution } from '../../app/appContribution'
import type { CheckedProposal, DoneWarning, UndoResult } from '../../app/assistantOperations'
import { removesFile } from '../../app/browserFileStep'
import { plainAmount } from '../../money/money'
import { catalogueOf, placeAt } from '../application/catalogue'
import type { Catalogue } from '../application/catalogue'
import type { ChatReads } from '../application/chatReads'
import type { ChatChip } from '../application/chatTools'
import type { ModelTurn } from '../application/modelPort'
import { NOTHING_TAGGED, contextLine, elementLine, runChatTurn } from '../application/runChatTurn'
import type { ChatContext, SentRead } from '../application/runChatTurn'
import type { LoopEnd } from '../application/runModelLoop'
import { chatRefs } from '../domain/chatRefs'
import { documentSizeOf, nextAttachmentId } from '../domain/chatAttachments'
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
import { anonymiseOn, assistAllowed, modelOf } from '../application/assistSettings'
import type { ProviderId, ProviderPreset } from '../domain/providerPresets'
import type { KunaChat } from './chatApps'
import { askChat, openChat, openChatAbout, removeChatElement } from './chatDock'
import type { AskedElement } from './chatDock'
import { imagePartOf } from './imagePartOf'
import { anonymisingNow, costWords, providerInUse, resultLine } from './aiProvider'
import { words } from './words'
import { plural } from '../../text/translation'

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
  /** The person stopped this answer while it was written, so it is not part of what the model said. */
  stopped: boolean
  /** Kuna sent this message for the person, from a button that names a task or as Go on, so it is not what they typed. */
  byKuna: boolean
}

/**
 * Who a message comes from: what the person typed, a task a button named such as Suggest categories, or Go on after a card accepted
 * that another card of the job follows. Only Go on counts toward the messages the chat sends in a row, and leaves the files on the prompt.
 */
export type MessageOrigin = 'person' | 'task' | 'goOn'

/** A card in the chat. `checked` is gone after a reload, and with it Accept and Undo. */
export interface ChatProposal extends SavedProposal {
  readonly checked: CheckedProposal | null
  state: ProposalState
  /** Why Kuna refused it, in a sentence that can name a record, so it stays out of what this browser keeps. */
  reason: string | null
  /** What the person should know of a write that went through, kept out of what this browser keeps as the reason is. */
  warning: DoneWarning | null
  /** Puts back what Accept wrote, while this page lives. */
  undo: (() => Promise<UndoResult>) | null
  /** The files the model read in the turn that made the card, by name, so a change a file asked for is recognisable. */
  readonly readFiles: readonly string[]
  /** The model said another card of its job follows this one, so Accept sends the chat on to the next step by itself. */
  readonly goesOn: boolean
}

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
/** How long one message may take, its rounds together, which also ends a stream that stalls. */
const MOST_RUN_MILLISECONDS = 5 * 60_000
/** The most messages the chat sends by itself, one after each card accepted that another card follows, before it waits for the person to write. */
const MOST_GOING_ON = 10

const lines = reactive<ChatLine[]>([])
const spent = reactive<Spent>({ dollars: 0, unknown: false, any: false })
const status = shallowRef<'ready' | 'streaming'>('ready')
/**
 * Whether a chat is going on: a message went in this visit. A card still open and an answer streaming come only from one,
 * as a restored chat's cards end, so a chat brought back from an earlier visit or a tag alone does not count.
 */
const goingOn = shallowRef(false)

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
/**
 * The provider and model `history` belongs to, since a provider's turns mean nothing to another and thinking blocks are
 * tied to the model. Null before the first message, when `history` holds at most a restored chat's text, which any provider reads.
 */
let chain: string | null = null
let current: AbortController | null = null
let stoppedByPerson = false
let nextId = 0
/** The provider this chat got a yes for, held in memory only. The card names the provider, so a yes does not carry to another. */
let allowedFor: ProviderId | null = null
/** What the model has not heard yet of how its cards ended, which goes at the start of the next message. */
const outcomes: string[] = []
/** How many messages the chat sent by itself since the person last wrote one. */
let wentOnBySelf = 0
/** A card was accepted while a message was still under way, so Go on waits for it to end. */
let goOnWaiting = false
/** A task a button named while a message was under way or no panel was open, which goes by itself once nothing is, as Go on does. */
let taskWaiting: string | null = null
/** Sends a message as the open panel sends one, through its yes, from where the person is then. Null while no panel is open. */
let sendFromPanel: ((message: string, origin: MessageOrigin) => void) | null = null
/** People go out as aliases in the screen's language, so the person reads the same word the model writes. */
const PERSON_WORD: PersonWord = language === 'hr' ? 'Osoba' : 'Person'

/** The aliases and tokens of this chat, kept in this browser with it, and its refs, held in memory only. All go with the chat. */
let pseudonyms = newPseudonyms(PERSON_WORD)
let refs = chatRefs()

function added(role: ChatLine['role'], text: string, note = false, at = Date.now()): ChatLine {
  nextId += 1
  lines.push({ id: `chat-${nextId}`, role, at, text, chips: [], failure: null, retry: null, note, sent: [], strayFigure: false, proposals: [], attachments: [], stopped: false, byKuna: false })
  return lines[lines.length - 1]!
}

function addSpending(end: LoopEnd): void {
  if (end.usage === null) return
  spent.any = true
  if (end.usage.dollars === null) spent.unknown = true
  else spent.dollars += end.usage.dollars
}

function startChainOn(next: string): void {
  if (chain !== null && chain !== next) {
    if (lines.length > 0) added('assistant', words.chat.chainChanged, true)
    history = []
    lastContext = null
    lastElement = null
  }
  chain = next
}

let catalogue: Promise<Catalogue> | null = null

/**
 * What a chat knows, built once when the chat's panel mounts and kept for the visit. It reads what each app declares and
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

/** Whether the chat may read the books and send to the provider without asking: the person said yes for good, or in this chat. */
export function chatAllowed(provider: ProviderId): boolean {
  return assistAllowed(provider) || allowedFor === provider
}

/** A new app's other set-up lines tell facts about its books, so they go only while the chat may read them. */
function contextAt(where: ChatWhere, known: Catalogue, provider: ProviderId): ChatContext {
  const place = placeAt(known, where.path, where.query)
  const setUp = chatAllowed(provider) ? where.setUp : where.setUp.map((app) => ({ ...app, others: [] }))
  return { app: where.app, screen: where.screen, place: place?.title ?? null, path: place?.address ?? where.path, today: where.today, setUp }
}

/** An answer as this browser keeps it: aliases stay as the model wrote them, and a figure ref is written out, as its figure goes with the page. */
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
    proposals: line.proposals.map(({ id, app, title, count, state, readFiles }) => ({ id, app, title, count, state, ...(readFiles.length === 0 ? {} : { readFiles: [...readFiles] }) })),
    ...(line.attachments.length === 0 ? {} : { attachments: [...line.attachments] }),
    ...(line.stopped ? { stopped: true as const } : {}),
    ...(line.byKuna ? { byKuna: true as const } : {}),
  }
}

/** The latest save of the chat to this browser. */
let lastKept: Promise<void> = Promise.resolve()

/** Keeps the chat in this browser: what was said, how cards ended and the alias map, with no tool result and nothing to accept. */
function keepChat(): void {
  lastKept = saveChat({ lines: lines.map(savedLine), spent: { ...spent }, aliases: pseudonyms.aliasMap(), refsHandedOut: refs.handedOut() })
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

/** What the model hears with the first message after a restore, as what it read before the reload is not sent again and new refs number on. */
const RESTORED_CONTEXT = 'The page reloaded. Its cards can no longer be accepted, and the refs handed out before it no longer reach anything, so read again what you need.'

/**
 * The messages a restored chat sends the model again: each one the model answered, with its answer, since the last change
 * of model, as the person sees it. A message that failed or that the person stopped never reached the model's turns, so it stays out.
 */
function earlierTurns(saved: readonly SavedLine[]): readonly ModelTurn[] {
  const since = saved.slice(saved.map((line) => line.note).lastIndexOf(true) + 1)
  return since.flatMap((line, at): ModelTurn[] => {
    const answer = since[at + 1]
    if (line.role !== 'user' || answer?.role !== 'assistant' || answer.text === '' || answer.failure !== null || answer.stopped === true) return []
    return [
      { role: 'user', parts: [{ kind: 'text', text: line.text }] },
      { role: 'earlier-answer', text: answer.text },
    ]
  })
}

/**
 * Shows the saved lines and takes back their alias map, so the model hears them again under the same aliases. New refs
 * number on from the old ones, and the amounts of an answer that held no stray figure count as known again.
 */
function restored(saved: SavedChat): void {
  for (const line of saved.lines) {
    const shown = added(line.role, line.text, line.note, line.at)
    shown.chips = [...line.chips]
    shown.strayFigure = line.strayFigure
    shown.failure = line.failure
    shown.proposals = line.proposals.map((proposal) => ({
      ...proposal,
      checked: null,
      state: restoredState(proposal.state),
      reason: null,
      warning: null,
      undo: null,
      readFiles: [...(proposal.readFiles ?? [])],
      goesOn: false,
    }))
    shown.attachments = [...(line.attachments ?? [])]
    shown.stopped = line.stopped === true
    shown.byKuna = line.byKuna === true
  }
  pseudonyms = newPseudonyms(PERSON_WORD, saved.aliases)
  refs = chatRefs(saved.refsHandedOut)
  for (const answer of saved.lines.filter((line) => line.role === 'assistant' && !line.strayFigure)) refs.noteFiguresIn(answer.text)
  history = earlierTurns(saved.lines)
  outcomes.push(RESTORED_CONTEXT)
  Object.assign(spent, saved.spent)
}

let restoring: Promise<void> | null = null
/** A chat started over in this visit, so the saved one, which may still be read, never comes back into it. */
let startedOver = false

/** Brings back the last chat of this browser, once a visit, unless one was begun. The model hears the messages again but not what its tools read last time. */
export function restoreChat(): Promise<void> {
  restoring ??= readSavedChat().then((saved) => {
    if (saved !== null && !startedOver && lines.length === 0) restored(saved)
  })
  return restoring
}

function heldProposal(id: string): ChatProposal | undefined {
  return lines.flatMap((line) => line.proposals).find((candidate) => candidate.id === id)
}

/** How a card ended, kept in this browser and told to the model with the next message. */
export function settleProposal(proposal: ChatProposal, state: ProposalState, reason: string | null = null, undo: ChatProposal['undo'] = null, warning: DoneWarning | null = null): void {
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
    refused: `Kuna did not write the card "${proposal.title}" when the person accepted it, as a record changed since or the save failed. The card shows the person why.`,
  }[state as 'done' | 'undone' | 'declined' | 'refused']
  if (outcome !== undefined) outcomes.push(outcome)
  keepChat()
  if (state === 'declined') goOnWaiting = false
  else if (state === 'done' && held.goesOn) goOn()
}

/** The panel's way to send a message, which Go on and a waiting task take, or null once the panel closes. */
export function sendChatFrom(send: ((message: string, origin: MessageOrigin) => void) | null): void {
  sendFromPanel = send
  sendWaitingTask()
}

/** Sends a task a button named as Kuna's message for the person, at once or, while a message is under way, once it ends. */
export function sendTask(task: string): void {
  taskWaiting = task
  sendWaitingTask()
}

function sendWaitingTask(): void {
  if (taskWaiting === null || sendFromPanel === null || status.value !== 'ready') return
  const task = taskWaiting
  taskWaiting = null
  sendFromPanel(task, 'task')
}

/** Sends Go on once nothing is under way, unless no panel is open to send it. */
function goOn(): void {
  if (sendFromPanel === null) return
  if (status.value !== 'ready') {
    goOnWaiting = true
    return
  }
  goOnWaiting = false
  sendFromPanel(words.chat.goOn, 'goOn')
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

/** The gate of a chat's reads, which holds while the person's yes does, as another tab can take it back. */
function readsOf(catalogue: Catalogue, provider: ProviderId): ChatReads {
  return {
    readers: catalogue.readers,
    pseudonyms,
    refs,
    anonymising: () => anonymiseOn(provider),
    persons: () => catalogue.persons(),
    mayRead: () => chatAllowed(provider),
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

/**
 * How the files on the prompt go and to which AI company, as the prompt and the card before the first send both say it:
 * one warning for the files of cells, with what Anonymise leaves as written, and one naming how many photos and PDFs go
 * whole. None shows while no AI company is set up, as nothing can go.
 */
export const promptFileNotes = computed<readonly string[]>(() => {
  const company = providerInUse()?.name
  if (company === undefined) return []
  const ready = chatPromptFiles.value.flatMap((file) => (file.state === 'ready' ? [file.attachment.reading.kind] : []))
  const whole = ready.filter((kind) => kind === 'whole').length
  return [
    ...(ready.includes('cells') ? [anonymisingNow() ? words.files.goesAsCells(company) : words.files.goesAsCellsPlain(company)] : []),
    ...(whole === 0 ? [] : [plural(words.files.goWhole(whole, company), whole)]),
  ]
})

/** The files that go with a message leave the prompt, with any refused, and the chat holds them for the model's reads. */
function sentFiles(): readonly ChatAttachment[] {
  const going = promptFiles.flatMap((file) => (file.state === 'ready' ? [file.attachment] : []))
  for (const file of promptFiles.filter((shown) => shown.state !== 'reading')) removePromptFile(file.key)
  attached.push(...going)
  return going
}

/** Sends one message and writes what comes back on its line. A failed message leaves the turns as they were, so the next one goes on from the last answer. */
export async function sendChatMessage(message: string, where: ChatWhere, knowledge: () => Promise<Catalogue>, origin: MessageOrigin = 'person'): Promise<void> {
  const preset = providerInUse()
  if (promptPdfsRefused.value) return
  goingOn.value = true
  if (origin === 'goOn') wentOnBySelf += 1
  else {
    wentOnBySelf = 0
    goOnWaiting = false
  }
  if (preset !== null) startChainOn(`${preset.id}/${modelOf(preset.id).id}`)
  const question = added('user', message)
  question.byKuna = origin !== 'person'
  question.attachments = origin === 'goOn' ? [] : sentFiles().map((attachment) => attachment.name)
  const line = added('assistant', '')
  // Links and cards land under the answer once the answer is whole, so text arriving above them never moves them from under a tap.
  const heldChips: ChatChip[] = []
  const heldProposals: ChatProposal[] = []
  current?.abort()
  const controller = new AbortController()
  current = controller
  stoppedByPerson = false
  status.value = 'streaming'
  const timeout = setTimeout(() => controller.abort(new Error(words.result.timedOut)), MOST_RUN_MILLISECONDS)
  try {
    const model = preset === null ? null : await modelPort(preset)
    if (model === null || preset === null) {
      line.failure = words.addKey
      return
    }
    const catalogue = await knowledge()
    const reads = readsOf(catalogue, preset.id)
    const contextNow = contextLine(contextAt(where, catalogue, preset.id))
    const elementNow = elementLine(where.element, attached, catalogue, reads)
    const heard = outcomes.splice(0).map((outcome) => `<context>${outcome}</context>`)
    const changed = [...(contextNow === lastContext ? [] : [contextNow]), ...(elementNow === lastElement ? [] : [elementNow ?? NOTHING_TAGGED]), ...heard]
    const readThisTurn = new Set<string>()
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
        if (current === controller) heldChips.push(chip)
      },
      onSent: (sent) => {
        if (current !== controller) return
        line.sent.push(sent)
        if (sent.read.kind === 'document' || sent.read.kind === 'cells') readThisTurn.add(sent.read.name)
      },
      showProposal: (app, proposal, next) => {
        if (current !== controller) return
        nextId += 1
        heldProposals.push({
          id: `card-${nextId}`,
          app,
          title: proposal.title,
          count: proposal.count,
          checked: markRaw(proposal),
          state: 'open',
          reason: null,
          warning: null,
          undo: null,
          readFiles: [...readThisTurn],
          goesOn: next && wentOnBySelf < MOST_GOING_ON && !removesFile(proposal),
        })
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
      line.chips.push(...heldChips)
      line.proposals.push(...heldProposals)
      if (stoppedByPerson && line.text === '' && line.chips.length === 0 && line.sent.length === 0 && line.proposals.length === 0) lines.splice(lines.indexOf(line), 1)
      else line.stopped = stoppedByPerson
      keepChat()
      if (goOnWaiting && !stoppedByPerson && line.failure === null) goOn()
      else {
        goOnWaiting = false
        sendWaitingTask()
      }
    }
  }
}

/** Takes the person's yes for the rest of this chat, on the provider the card named, to read every app and send. */
export function allowThisChat(provider: ProviderId): void {
  allowedFor = provider
}

/** Stops the message under way. What it spent so far is lost to the count, as the provider reports it only at the end. */
export function stopChatMessage(): void {
  stoppedByPerson = true
  goOnWaiting = false
  current?.abort()
}

/** Starts over: nothing of the chat stays in this page, and the saved chat does not come back in this visit. */
export function clearChat(): void {
  startedOver = true
  goingOn.value = false
  stoppedByPerson = true
  current?.abort()
  current = null
  status.value = 'ready'
  lines.splice(0)
  history = []
  lastContext = null
  lastElement = null
  chain = null
  allowedFor = null
  pseudonyms = newPseudonyms(PERSON_WORD)
  refs = chatRefs()
  dropPromptFiles()
  attached.splice(0)
  outcomes.splice(0)
  wentOnBySelf = 0
  goOnWaiting = false
  taskWaiting = null
  void forgetSavedChat()
  chatDraft.value = ''
  Object.assign(spent, { dollars: 0, unknown: false, any: false })
}

export const chatLines = readonly(lines)
export const chatStatus = readonly(status)
export const chatGoingOn = readonly(goingOn)

/** What a chat starts with: files to read onto the prompt, the element it is about, and a task Kuna sends for the person. */
export interface ChatStart {
  readonly files?: readonly File[]
  readonly element?: AskedElement | null
  readonly task?: string | null
}

/**
 * Opens the chat with what `start` gives. New chat always starts over. A page joins a chat going on, and otherwise starts
 * over as New chat does, which replaces the saved chat. The task goes through the same yes as a typed message once a file
 * is read, as only a ready file goes with a message, and not at all when every file was refused.
 */
export async function startChatWith({ files = [], element = null, task = null }: ChatStart, from: 'new-chat' | 'page'): Promise<void> {
  if (from === 'new-chat' || !goingOn.value) {
    clearChat()
    removeChatElement()
  }
  if (element === null) openChat()
  else openChatAbout(element)
  if (files.length > 0) await attachFiles(files)
  if (task !== null && (files.length === 0 || chatPromptFiles.value.some((file) => file.state === 'ready'))) askChat(task)
}

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
