import type { AiPart, AiTextPart } from '../domain/aiTask'
import { NO_TOKENS } from '../domain/modelUsage'
import type { ModelPrice, ModelTokens } from '../domain/modelUsage'
import type { StrictSchema } from '../domain/strictSchema'

/** A tool the model asked to run, with its arguments as it wrote them. */
export interface ToolCall {
  readonly id: string
  readonly name: string
  readonly args: unknown
}

/**
 * One turn of a run as the loop keeps it. An assistant turn keeps the provider's own message in `raw`, which only the
 * adapter that made it reads, so it goes back unchanged on the next request, whatever kinds of block it holds.
 */
export type ModelTurn =
  | { readonly role: 'user'; readonly parts: readonly AiPart[] }
  | { readonly role: 'assistant'; readonly calls: readonly ToolCall[]; readonly raw: unknown }
  | { readonly role: 'tool-results'; readonly results: readonly { readonly callId: string; readonly text: string; readonly isError: boolean }[] }

export interface ModelTool {
  readonly name: string
  readonly description: string
  readonly input: StrictSchema
}

export interface ModelRequest {
  readonly system: readonly AiTextPart[]
  readonly turns: readonly ModelTurn[]
  /** The schema of the answer, or null for an answer in plain text. */
  readonly output: StrictSchema | null
  readonly tools: readonly ModelTool[]
  readonly effort: 'low' | 'medium' | 'high'
  /** Aborts the request once its result no longer matters or it took too long. */
  readonly signal?: AbortSignal | undefined
  /** Hears each piece of the answer's text as it arrives. An adapter that does not stream never calls it. */
  readonly onDelta?: ((text: string) => void) | undefined
}

/**
 * What one request came back with, after the adapter read its stop reason: the final answer as the text the model
 * wrote, tools to run, a refusal with the provider's explanation, or an answer cut off at the length limit.
 */
export type ModelReply =
  | { readonly kind: 'answer'; readonly text: string; readonly raw: unknown; readonly tokens: ModelTokens }
  | { readonly kind: 'tool-calls'; readonly calls: readonly ToolCall[]; readonly raw: unknown; readonly tokens: ModelTokens }
  | { readonly kind: 'refused'; readonly reason: string; readonly tokens: ModelTokens }
  | { readonly kind: 'cut-off'; readonly tokens: ModelTokens }

/** The model a run talks to, with its list price if Kuna knows it, through one provider's adapter or the fake build's. */
export interface ModelPort {
  readonly model: { readonly name: string; readonly price: ModelPrice | null }
  /** Whether the provider reads a PDF part. */
  readonly readsPdf: boolean
  /** Sends one request. Throws `ModelRequestFailed` when the provider answers with an error or an unreadable reply, or cannot be reached. */
  send(request: ModelRequest): Promise<ModelReply>
}

/** The provider answered with an error status, could not be reached, which `status` 0 marks, or spent `tokens` on a reply Kuna cannot use. */
export class ModelRequestFailed extends Error {
  readonly status: number
  readonly tokens: ModelTokens

  constructor(status: number, message: string, tokens: ModelTokens = NO_TOKENS) {
    super(message)
    this.name = 'ModelRequestFailed'
    this.status = status
    this.tokens = tokens
  }
}
