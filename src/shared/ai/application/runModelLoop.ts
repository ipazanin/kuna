import type { AiPart, AiTextPart } from '../domain/aiTask'
import { maskIdentifiers } from '../domain/maskIdentifiers'
import { NO_TOKENS, addedTokens, costOfRequest, fullRateTokens, promptTokens, spentNothing, usageOf } from '../domain/modelUsage'
import type { AiUsage, ModelTokens } from '../domain/modelUsage'
import type { StrictSchema } from '../domain/strictSchema'
import { SecretInRequest } from './egressGuard'
import { ModelRequestFailed } from './modelPort'
import type { ModelPort, ModelTool, ModelTurn, ToolCall } from './modelPort'

export interface ModelLoop {
  readonly model: ModelPort
  readonly system: readonly AiTextPart[]
  /** The turns so far, which the loop only ever adds to, as Anthropic refuses a history edited under its thinking blocks. */
  readonly turns: readonly ModelTurn[]
  readonly output: StrictSchema | null
  readonly tools: readonly ModelTool[]
  /** Answers one tool call. The text comes back masked before the model reads it. */
  readonly runTool: (call: ToolCall) => Promise<{ readonly text: string; readonly isError: boolean }>
  readonly effort: 'low' | 'medium' | 'high'
  readonly signal?: AbortSignal | undefined
  readonly onDelta?: ((text: string) => void) | undefined
  /** The most tool rounds it may take, the largest prompt one request may send, and what the whole run may weigh in full-rate tokens before it stops. */
  readonly limits: { readonly rounds: number; readonly requestTokens: number; readonly runTokens: number }
}

/** How a loop ended: the model's answer with every turn to keep, or a reply or a limit that gave no answer. */
export type LoopEnd =
  | { readonly kind: 'answer'; readonly text: string; readonly turns: readonly ModelTurn[]; readonly usage: AiUsage | null }
  | { readonly kind: 'refused' | 'cut-off' | 'too-long' | 'over-budget' | 'failed' | 'holds-secret'; readonly reason: string; readonly usage: AiUsage | null }

/** Masks what it was given, sends it, runs the tools the model asks for and adds up what the requests spent. */
export async function runModelLoop(loop: ModelLoop): Promise<LoopEnd> {
  const { model, limits } = loop
  const system = loop.system.map((part) => ({ ...part, text: maskIdentifiers(part.text) }))
  const turns = loop.turns.map(maskedTurn)
  let used: ModelTokens = NO_TOKENS
  let lastPrompt = 0
  let listDollars = 0
  const spend = (tokens: ModelTokens): void => {
    used = addedTokens(used, tokens)
    if (model.model.price !== null) listDollars += costOfRequest(tokens, model.model.price)
  }
  const usageSoFar = (): AiUsage | null => (spentNothing(used) ? null : usageOf(model.model, used, listDollars))

  for (let round = 0; round <= limits.rounds; round += 1) {
    // A person may stop a run while a tool waits for their answer, and then nothing more may go.
    if (loop.signal?.aborted === true) {
      return { kind: 'failed', reason: loop.signal.reason instanceof Error ? loop.signal.reason.message : '', usage: usageSoFar() }
    }
    if (fullRateTokens(used) >= limits.runTokens) {
      return { kind: 'over-budget', reason: '', usage: usageSoFar() }
    }
    // A conversation only grows, so the next request sends at least what the last one did.
    if (Math.max(estimatedTokens(system, turns), lastPrompt) > limits.requestTokens) {
      return { kind: 'too-long', reason: String(limits.requestTokens), usage: usageSoFar() }
    }
    let reply
    try {
      reply = await model.send({ system, turns, output: loop.output, tools: loop.tools, effort: loop.effort, signal: loop.signal, onDelta: loop.onDelta })
    } catch (failure) {
      if (failure instanceof SecretInRequest) {
        return { kind: 'holds-secret', reason: '', usage: usageSoFar() }
      }
      if (failure instanceof ModelRequestFailed) {
        spend(failure.tokens)
        return { kind: 'failed', reason: failure.message, usage: usageSoFar() }
      }
      throw failure
    }
    spend(reply.tokens)
    lastPrompt = promptTokens(reply.tokens)
    const usage = usageSoFar()
    switch (reply.kind) {
      case 'refused':
        return { kind: 'refused', reason: reply.reason, usage }
      case 'cut-off':
        return { kind: 'cut-off', reason: '', usage }
      case 'answer':
        return { kind: 'answer', text: reply.text, turns: [...turns, { role: 'assistant', calls: [], raw: reply.raw }], usage }
      case 'tool-calls': {
        if (round === limits.rounds) break
        const results = await Promise.all(
          reply.calls.map(async (call) => {
            const answer = await loop.runTool(call)
            return { callId: call.id, text: maskIdentifiers(answer.text), isError: answer.isError }
          }),
        )
        turns.push({ role: 'assistant', calls: reply.calls, raw: reply.raw }, { role: 'tool-results', results })
      }
    }
  }
  return { kind: 'failed', reason: `more than ${limits.rounds} rounds of lookups`, usage: usageSoFar() }
}

function maskedTurn(turn: ModelTurn): ModelTurn {
  return turn.role === 'user' ? { role: 'user', parts: turn.parts.map(maskedPart) } : turn
}

function maskedPart(part: AiPart): AiPart {
  return part.kind === 'text' ? { kind: 'text', text: maskIdentifiers(part.text) } : part
}

/** A cautious count of the tokens a request sends: three characters a token of text, and a PDF or photo by its size. */
function estimatedTokens(system: readonly { readonly text: string }[], turns: readonly ModelTurn[]): number {
  const characters =
    system.reduce((sum, part) => sum + part.text.length, 0) +
    turns.reduce((sum, turn) => {
      if (turn.role === 'user') return sum + turn.parts.reduce((partSum, part) => partSum + (part.kind === 'text' ? part.text.length : part.base64.length / 4), 0)
      if (turn.role === 'tool-results') return sum + turn.results.reduce((resultSum, result) => resultSum + result.text.length, 0)
      return sum + JSON.stringify(turn.calls).length
    }, 0)
  return Math.ceil(characters / 3)
}
