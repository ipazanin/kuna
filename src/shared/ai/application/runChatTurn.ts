import type { CheckedProposal } from '../../app/assistantOperations'
import { sendsToModel } from '../domain/chatAttachments'
import type { ChatAttachment } from '../domain/chatAttachments'
import type { ChatElementAbout } from '../domain/chatElement'
import { placeAt } from './catalogue'
import type { Catalogue } from './catalogue'
import { labelLeaving, recordKeptHome } from './chatReads'
import type { ChatReads, ReadSent } from './chatReads'
import { CHAT_TOOLS, runChatTool } from './chatTools'
import type { ChatChip } from './chatTools'
import { SecretInRequest } from './egressGuard'
import type { ModelPort, ModelRequest, ModelTurn } from './modelPort'
import { runModelLoop } from './runModelLoop'
import type { LoopEnd } from './runModelLoop'

/** The most lookups one message may take. */
const MOST_ROUNDS = 8

/** Where the person is, in names only: an app, a screen, a declared place such as a tab and an address, with today's date. */
export interface ChatContext {
  readonly app: string | null
  readonly screen: string | null
  /** The tab or other declared place on the screen, or null when none matches. */
  readonly place: string | null
  /** The screen's address, or the declared place's when one matches. Never the rest of the query. */
  readonly path: string
  readonly today: string
}

/** The line that tells the model where the person is. It holds names and the date, and it goes at the start of a person's turn, never inside a tool loop. */
export function contextLine(context: ChatContext): string {
  const app = context.app === null ? 'Kuna' : context.app
  const screen = context.screen === null ? '' : `, on the screen ${context.screen}`
  const place = context.place === null ? '' : `, tab ${context.place}`
  return `<context>The person is in ${app}${screen}${place} (${context.path}). Today is ${context.today}.</context>`
}

/**
 * What the person tagged, in Kuna's words: a record or a build-up by a ref, a figure by its report and label, a place by
 * the address the catalogue declares. A record's label and a build-up's content stay out, so they reach the model only
 * through a read past the gate. While Anonymise is on, a record or a figure about an employee gets no ref and no label.
 */
function elementText(element: ChatElementAbout, catalogue: Catalogue, reads: ChatReads): string | null {
  switch (element.kind) {
    case 'record':
      return recordKeptHome(element.app, element.recordKind, element.id, reads)
        ? `a record of ${element.app} that stays on this device`
        : `the ${element.recordKind} ${reads.refs.recordRef({ app: element.app, kind: element.recordKind, id: element.id })} of ${element.app}, which get_record reads`
    case 'figure': {
      const label = labelLeaving(element.label, reads)
      const named = label === null ? 'a figure' : `the figure "${label}"`
      return `${named} of the report ${element.app}/report/${element.report}${element.period === null ? '' : ` for ${element.period}`}`
    }
    case 'place': {
      const [path = '', query = ''] = element.route.split('?')
      const place = placeAt(catalogue, path, Object.fromEntries(new URLSearchParams(query)))
      return place === null ? null : `the place ${place.title} (${place.address}) of ${element.app}`
    }
    default:
      return `the build-up ${reads.refs.buildUpRef(element)} of a figure of ${element.app}, which read_build_up reads`
  }
}

/** A file by its id and kind, with a PDF's pages, and whether only Kuna reads it. */
function fileText(file: ChatAttachment): string {
  if (file.kind === 'pdf') return `${file.id} (pdf, ${file.pages} pages)`
  return sendsToModel(file.kind) ? `${file.id} (${file.kind})` : `${file.id} (${file.kind}, read by Kuna, never sent)`
}

/** What a chat says once a tag it named is removed and no file is attached. */
export const NOTHING_TAGGED = '<context>Nothing is tagged now.</context>'

/**
 * The line that names the tagged element and the files attached to this chat, by id and kind, never by a file's name.
 * Null when there are neither. The chat sends it only when it changed, so a ref it mints must stay the same for the same element.
 */
export function elementLine(element: ChatElementAbout | null, attachments: readonly ChatAttachment[], catalogue: Catalogue, reads: ChatReads): string | null {
  const text = element === null ? null : elementText(element, catalogue, reads)
  const tagged = text === null ? [] : [`Tagged element: ${text}.`]
  const files = attachments.length === 0 ? [] : [`Files attached to this chat: ${attachments.map(fileText).join(', ')}.`]
  const said = [...tagged, ...files]
  return said.length === 0 ? null : `<context>${said.join(' ')}</context>`
}

/** What a read really sent: the exact text of its tool result as it left in a request. */
export interface SentRead {
  readonly read: ReadSent
  readonly text: string
}

export interface ChatTurn {
  readonly model: ModelPort
  readonly catalogue: Catalogue
  readonly reads: ChatReads
  /** The turns so far in this chain of requests, which only ever grows. */
  readonly history: readonly ModelTurn[]
  /** The context lines, each only when it differs from the one the model last read. */
  readonly context: string | null
  /** Every file attached to this chat, held in memory with it. Only `read_attachment` sends a photo or a PDF, and nothing sends another kind. */
  readonly attachments: readonly ChatAttachment[]
  readonly message: string
  readonly signal: AbortSignal
  readonly onDelta: (text: string) => void
  /** A lookup started, so what the model wrote before it is not part of the answer. */
  readonly onLookup: () => void
  readonly showChip: (chip: ChatChip) => void
  readonly showProposal: (app: string, proposal: CheckedProposal) => void
  /** A read's result went out in a request. */
  readonly onSent: (sent: SentRead) => void
}

/** Sends one message of a chat. Reading goes through the tools, whose gate asks the person, and each read that really left is reported with its exact text. */
export function runChatTurn(turn: ChatTurn): Promise<LoopEnd> {
  const parts = [...(turn.context === null ? [] : [{ kind: 'text' as const, text: turn.context }]), { kind: 'text' as const, text: turn.message }]
  const awaiting = new Map<string, ReadSent>()

  /** Takes the text from the request itself, after the loop masked it, so what the row shows is what the provider got. */
  const reportSent = (request: ModelRequest): void => {
    const last = request.turns.at(-1)
    if (last?.role !== 'tool-results') return
    for (const result of last.results) {
      const read = awaiting.get(result.callId)
      if (read === undefined) continue
      awaiting.delete(result.callId)
      turn.onSent({ read, text: result.text })
    }
  }

  const watched: ModelPort = {
    ...turn.model,
    send: async (request) => {
      try {
        return await turn.model.send(request)
      } catch (failure) {
        // The egress guard stopped this request before it left, so it sent nothing. Any other failure may have reached the provider.
        if (failure instanceof SecretInRequest) awaiting.clear()
        throw failure
      } finally {
        reportSent(request)
      }
    },
  }

  return runModelLoop({
    model: watched,
    system: [{ kind: 'text', text: turn.catalogue.system }],
    turns: [...turn.history, { role: 'user', parts }],
    tools: CHAT_TOOLS,
    runTool: async (call) => {
      turn.onLookup()
      const answer = await runChatTool(
        { catalogue: turn.catalogue, reads: turn.reads, attachments: turn.attachments, readsPdf: turn.model.readsPdf, showChip: turn.showChip, showProposal: turn.showProposal },
        call,
      )
      if (answer.read !== undefined) awaiting.set(call.id, answer.read)
      return { text: answer.text, parts: answer.parts ?? [], isError: answer.isError }
    },
    effort: 'low',
    signal: turn.signal,
    onDelta: turn.onDelta,
    rounds: MOST_ROUNDS,
  })
}
