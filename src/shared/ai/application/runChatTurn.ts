import type { Catalogue } from './catalogue'
import { CHAT_TOOLS, runChatTool } from './chatTools'
import type { ChatChip } from './chatTools'
import type { ModelPort, ModelTurn } from './modelPort'
import { runModelLoop } from './runModelLoop'
import type { LoopEnd } from './runModelLoop'

/** The id a chat's model goes by, which the fake build answers by. */
export const CHAT_TASK_ID = 'chat.turn'

/** The most lookups one message may take. A chat has no other limit: the panel shows the cost and never stops it, as the spend limit on the key is the only ceiling. */
const MOST_ROUNDS = 8

/** Where the person is and what they tagged, in names only: an app, a screen, a declared place such as a tab, an address and a label. */
export interface ChatContext {
  readonly app: string | null
  readonly screen: string | null
  /** The tab or other declared place on the screen, or null when none matches. */
  readonly place: string | null
  /** The screen's address, or the declared place's when one matches. Never the rest of the query. */
  readonly path: string
  readonly tag: { readonly label: string; readonly screen: string | null } | null
}

/** The line that tells the model where the person is. It holds names only, and it goes at the start of a person's turn, never inside a tool loop. */
export function contextLine(context: ChatContext): string {
  const app = context.app === null ? 'Kuna' : context.app
  const screen = context.screen === null ? '' : `, on the screen ${context.screen}`
  const place = context.place === null ? '' : `, tab ${context.place}`
  const tag = context.tag === null ? '' : ` Tagged element: ${context.tag.label}${context.tag.screen === null ? '' : `, on the screen ${context.tag.screen}`}.`
  return `<context>The person is in ${app}${screen}${place} (${context.path}).${tag}</context>`
}

export interface ChatTurn {
  readonly model: ModelPort
  readonly catalogue: Catalogue
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
}

/** Sends one message of a chat. The only tools are the catalogue's, so nothing from a person's books can reach the model. */
export function runChatTurn(turn: ChatTurn): Promise<LoopEnd> {
  const parts = [...(turn.context === null ? [] : [{ kind: 'text' as const, text: turn.context }]), { kind: 'text' as const, text: turn.message }]
  return runModelLoop({
    model: turn.model,
    system: [{ kind: 'text', text: turn.catalogue.system }],
    turns: [...turn.history, { role: 'user', parts }],
    output: null,
    tools: CHAT_TOOLS,
    runTool: async (call) => {
      turn.onLookup()
      return runChatTool(turn.catalogue, call, turn.showChip)
    },
    effort: 'low',
    signal: turn.signal,
    onDelta: turn.onDelta,
    limits: { rounds: MOST_ROUNDS, requestTokens: Number.POSITIVE_INFINITY, runTokens: Number.POSITIVE_INFINITY },
  })
}
