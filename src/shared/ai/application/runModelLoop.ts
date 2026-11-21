import type { AiPart, AiTextPart } from '../domain/aiPart'
import { maskIdentifiers } from '../../privacy/domain/maskIdentifiers'
import { NO_TOKENS, addedTokens, costOfRequest, spentNothing, usageOf } from '../domain/modelUsage'
import type { AiUsage, ModelTokens } from '../domain/modelUsage'
import { SecretInRequest } from './egressGuard'
import { ModelRequestFailed } from './modelPort'
import type { ModelPort, ModelTool, ModelTurn, ToolCall, ToolResult } from './modelPort'

export interface ModelLoop {
  readonly model: ModelPort
  readonly system: readonly AiTextPart[]
  /** The turns so far, which the loop only adds to while it runs, as Anthropic refuses a history edited under its thinking blocks. */
  readonly turns: readonly ModelTurn[]
  readonly tools: readonly ModelTool[]
  /** Answers one tool call. The text comes back masked before the model reads it, and its photos or PDFs go whole. */
  readonly runTool: (call: ToolCall) => Promise<ToolResult>
  readonly effort: 'low' | 'medium' | 'high'
  readonly signal?: AbortSignal | undefined
  readonly onDelta?: ((text: string) => void) | undefined
  /** The most tool rounds it may take. */
  readonly rounds: number
}

/** How a loop ended: the model's answer with every turn to keep, its photos and PDF pages left out, or a reply or a failure that gave no answer. */
export type LoopEnd =
  | { readonly kind: 'answer'; readonly text: string; readonly turns: readonly ModelTurn[]; readonly usage: AiUsage | null }
  | { readonly kind: 'refused' | 'cut-off' | 'failed' | 'holds-secret' | 'out-of-credit' | 'key-refused'; readonly reason: string; readonly usage: AiUsage | null }

/** Masks what it was given, sends it, runs the tools the model asks for and adds up what the requests spent. */
export async function runModelLoop(loop: ModelLoop): Promise<LoopEnd> {
  const { model } = loop
  const system = loop.system.map((part) => ({ ...part, text: maskIdentifiers(part.text, 'books') }))
  const turns = loop.turns.map(maskedTurn)
  let used: ModelTokens = NO_TOKENS
  let listDollars = 0
  const spend = (tokens: ModelTokens): void => {
    used = addedTokens(used, tokens)
    if (model.model.price !== null) listDollars += costOfRequest(tokens, model.model.price)
  }
  const usageSoFar = (): AiUsage | null => (spentNothing(used) ? null : usageOf(model.model, used, listDollars))

  for (let round = 0; round <= loop.rounds; round += 1) {
    // A person may stop a run while a tool waits for their answer, and then nothing more may go.
    if (loop.signal?.aborted === true) {
      return { kind: 'failed', reason: loop.signal.reason instanceof Error ? loop.signal.reason.message : '', usage: usageSoFar() }
    }
    let reply
    try {
      reply = await model.send({ system, turns, tools: loop.tools, effort: loop.effort, signal: loop.signal, onDelta: loop.onDelta })
    } catch (failure) {
      if (failure instanceof SecretInRequest) {
        return { kind: 'holds-secret', reason: '', usage: usageSoFar() }
      }
      if (failure instanceof ModelRequestFailed) {
        spend(failure.tokens)
        return { kind: failure.kind === 'other' ? 'failed' : failure.kind, reason: failure.message, usage: usageSoFar() }
      }
      throw failure
    }
    spend(reply.tokens)
    const usage = usageSoFar()
    switch (reply.kind) {
      case 'refused':
        return { kind: 'refused', reason: reply.reason, usage }
      case 'cut-off':
        return { kind: 'cut-off', reason: '', usage }
      case 'answer':
        return { kind: 'answer', text: reply.text, turns: [...turns.map(withoutWholeParts), { role: 'assistant', calls: [], raw: reply.raw }], usage }
      case 'tool-calls': {
        if (round === loop.rounds) break
        const results = await Promise.all(
          reply.calls.map(async (call) => {
            const answer = await loop.runTool(call)
            return { callId: call.id, text: maskIdentifiers(answer.text, 'books'), parts: answer.parts, isError: answer.isError }
          }),
        )
        turns.push({ role: 'assistant', calls: reply.calls, raw: reply.raw }, { role: 'tool-results', results })
      }
    }
  }
  return { kind: 'failed', reason: `more than ${loop.rounds} rounds of lookups`, usage: usageSoFar() }
}

/** What a tool result says in place of a photo or PDF pages the model has read and answered on, which the history no longer carries. */
export const WHOLE_PART_SENT = 'The photo or pages of this result went once and are not sent again. Read the file again if you need to look at it.'

/**
 * A turn without the photos and PDF pages its tool results carried, each result saying so, for the turns a chat keeps once the
 * model has answered on them. A later request then sends the model's reading of a photo rather than the photo again.
 */
function withoutWholeParts(turn: ModelTurn): ModelTurn {
  if (turn.role !== 'tool-results' || turn.results.every((result) => result.parts.length === 0)) return turn
  return {
    role: 'tool-results',
    results: turn.results.map((result) => (result.parts.length === 0 ? result : { ...result, text: `${result.text}\n${WHOLE_PART_SENT}`, parts: [] })),
  }
}

function maskedTurn(turn: ModelTurn): ModelTurn {
  return turn.role === 'user' ? { role: 'user', parts: turn.parts.map(maskedPart) } : turn
}

function maskedPart(part: AiPart): AiPart {
  return part.kind === 'text' ? { kind: 'text', text: maskIdentifiers(part.text, 'written') } : part
}
