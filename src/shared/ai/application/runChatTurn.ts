import type { CheckedProposal } from '../../app/assistantOperations'
import type { Catalogue } from './catalogue'
import type { ChatReads, ReadSent } from './chatReads'
import { CHAT_TOOLS, runChatTool } from './chatTools'
import type { ChatChip } from './chatTools'
import { SecretInRequest } from './egressGuard'
import type { ModelPort, ModelRequest, ModelTurn } from './modelPort'
import { runModelLoop } from './runModelLoop'
import type { LoopEnd } from './runModelLoop'

/** The id a chat's model goes by, which the fake build answers by. */
export const CHAT_TASK_ID = 'chat.turn'

/** The most lookups one message may take. A chat has no other limit: the panel shows the cost and never stops it, as the spend limit on the key is the only ceiling. */
const MOST_ROUNDS = 8

/** Where the person is and what they tagged, in names only: an app, a screen, a declared place such as a tab, an address and a label, with today's date. */
export interface ChatContext {
  readonly app: string | null
  readonly screen: string | null
  /** The tab or other declared place on the screen, or null when none matches. */
  readonly place: string | null
  /** The screen's address, or the declared place's when one matches. Never the rest of the query. */
  readonly path: string
  readonly tag: { readonly label: string; readonly screen: string | null } | null
  readonly today: string
}

/** The line that tells the model where the person is. It holds names and the date, and it goes at the start of a person's turn, never inside a tool loop. */
export function contextLine(context: ChatContext): string {
  const app = context.app === null ? 'Kuna' : context.app
  const screen = context.screen === null ? '' : `, on the screen ${context.screen}`
  const place = context.place === null ? '' : `, tab ${context.place}`
  const tag = context.tag === null ? '' : ` Tagged element: ${context.tag.label}${context.tag.screen === null ? '' : `, on the screen ${context.tag.screen}`}.`
  return `<context>The person is in ${app}${screen}${place} (${context.path}). Today is ${context.today}.${tag}</context>`
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
  /** The context line, only when it differs from the one the model last read. */
  readonly context: string | null
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
    output: null,
    tools: CHAT_TOOLS,
    runTool: async (call) => {
      turn.onLookup()
      const answer = await runChatTool({ catalogue: turn.catalogue, reads: turn.reads, showChip: turn.showChip, showProposal: turn.showProposal }, call)
      if (answer.read !== undefined) awaiting.set(call.id, answer.read)
      return { text: answer.text, isError: answer.isError }
    },
    effort: 'low',
    signal: turn.signal,
    onDelta: turn.onDelta,
    limits: { rounds: MOST_ROUNDS, requestTokens: Number.POSITIVE_INFINITY, runTokens: Number.POSITIVE_INFINITY },
  })
}
