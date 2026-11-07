import type { ModelPort, ModelReply, ModelRequest, ModelTurn, ToolCall } from '../application/modelPort'
import { ModelRequestFailed } from '../application/modelPort'
import type { AiPart } from '../domain/aiTask'
import type { ModelTokens } from '../domain/modelUsage'
import { bearerHeaders, streamedEvents, withoutKey } from './providerFetch'
import type { ModelChoice } from './providerPresets'

/** Bounds what one request can write, reasoning included. Streaming would allow more, and no task needs it. */
const MAX_OUTPUT_TOKENS = 16_000

/** An item of a response's output, with every field it came with, since it goes back unchanged on the next request. */
interface OutputItem {
  readonly type: string
  readonly phase?: string
  readonly call_id?: string
  readonly name?: string
  readonly arguments?: string
  readonly content?: readonly { readonly type: string; readonly text?: string; readonly refusal?: string }[]
}

interface Usage {
  readonly input_tokens?: number
  readonly output_tokens?: number
  readonly input_tokens_details?: { readonly cached_tokens?: number; readonly cache_write_tokens?: number }
}

interface FinishedResponse {
  readonly output?: readonly OutputItem[]
  readonly usage?: Usage | null
  readonly error?: { readonly message?: string } | null
  readonly incomplete_details?: { readonly reason?: string } | null
}

type StreamEvent =
  | { readonly type: 'response.output_item.added'; readonly item?: { readonly id?: string; readonly phase?: string } }
  | { readonly type: 'response.output_text.delta'; readonly item_id?: string; readonly delta: string }
  | { readonly type: 'response.completed' | 'response.incomplete' | 'response.failed'; readonly response?: FinishedResponse }
  | { readonly type: 'error'; readonly message?: string }

/**
 * The model behind an OpenAI key over the Responses API, always streaming. It keeps nothing at OpenAI, so each request
 * sends the whole conversation, with the reasoning items the last reply returned encrypted.
 */
export function openAiResponses(baseUrl: string, key: string, model: ModelChoice): ModelPort {
  return {
    model,
    readsPdf: true,
    send: async (request) => {
      const call = {
        address: `${baseUrl}/responses`,
        method: 'POST',
        headers: bearerHeaders(key),
        body: responsesBody(model.id, request),
        key,
        signal: request.signal,
      } as const
      // A commentary message is kept to replay and is no part of the answer, so what it says never reaches the screen.
      const commentary = new Set<string>()
      for await (const untyped of streamedEvents(call)) {
        const event = untyped as StreamEvent
        switch (event.type) {
          case 'response.output_item.added':
            if (event.item?.phase === 'commentary' && event.item.id !== undefined) commentary.add(event.item.id)
            break
          case 'response.output_text.delta':
            if (event.item_id === undefined || !commentary.has(event.item_id)) request.onDelta?.(event.delta)
            break
          case 'response.completed':
            return completedReply(event.response ?? {})
          case 'response.incomplete':
            return incompleteReply(event.response ?? {})
          case 'response.failed':
            throw new ModelRequestFailed(200, withoutKey(event.response?.error?.message ?? 'OpenAI failed without saying why.', key), tokensOf(event.response?.usage))
          case 'error':
            throw new ModelRequestFailed(200, withoutKey(event.message ?? 'OpenAI sent an error it did not explain.', key))
        }
      }
      throw new ModelRequestFailed(200, 'The stream ended before the answer did.')
    },
  }
}

function responsesBody(modelId: string, request: ModelRequest): object {
  return {
    model: modelId,
    store: false,
    stream: true,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    reasoning: { effort: request.effort },
    instructions: request.system.map((part) => part.text).join('\n\n'),
    input: request.turns.flatMap(inputItems),
    ...(request.output === null ? {} : { text: { format: { type: 'json_schema', name: 'answer', strict: true, schema: request.output } } }),
    ...(request.tools.length === 0
      ? {}
      : {
          tools: request.tools.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.input, strict: true })),
          tool_choice: 'auto',
        }),
  }
}

function inputItems(turn: ModelTurn): readonly object[] {
  switch (turn.role) {
    case 'user': {
      return [{ role: 'user', content: turn.parts.map(inputPart) }]
    }
    case 'assistant': {
      return turn.raw as readonly object[]
    }
    case 'tool-results': {
      return turn.results.map((result) => ({ type: 'function_call_output', call_id: result.callId, output: result.isError ? `Error: ${result.text}` : result.text }))
    }
  }
}

function inputPart(part: AiPart): object {
  switch (part.kind) {
    case 'text': {
      return { type: 'input_text', text: part.text }
    }
    case 'pdf': {
      return { type: 'input_file', filename: part.name, file_data: `data:application/pdf;base64,${part.base64}` }
    }
    case 'image': {
      return { type: 'input_image', image_url: `data:${part.mediaType};base64,${part.base64}` }
    }
  }
}

function completedReply(response: FinishedResponse): ModelReply {
  const { output } = response
  if (!Array.isArray(output) || typeof response.usage?.input_tokens !== 'number' || typeof response.usage.output_tokens !== 'number') {
    throw new ModelRequestFailed(200, 'OpenAI answered with a reply Kuna cannot read.')
  }
  const items: readonly OutputItem[] = output
  const tokens = tokensOf(response.usage)
  const parts = items.filter((item) => item.type === 'message' && item.phase !== 'commentary').flatMap((item) => item.content ?? [])
  const refusal = parts.find((part) => part.type === 'refusal')
  if (refusal !== undefined) {
    return { kind: 'refused', reason: refusal.refusal ?? '', tokens }
  }
  const calls: ToolCall[] = items.filter((item) => item.type === 'function_call').map((item) => ({ id: item.call_id ?? '', name: item.name ?? '', args: parsedArguments(item.arguments ?? '') }))
  if (calls.length > 0) {
    return { kind: 'tool-calls', calls, raw: items, tokens }
  }
  const text = parts
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('')
  return { kind: 'answer', text, raw: items, tokens }
}

function incompleteReply(response: FinishedResponse): ModelReply {
  const tokens = tokensOf(response.usage)
  const reason = response.incomplete_details?.reason
  switch (reason) {
    case 'max_output_tokens':
      return { kind: 'cut-off', tokens }
    case 'content_filter':
      return { kind: 'refused', reason: 'content_filter', tokens }
    default:
      throw new ModelRequestFailed(200, `OpenAI stopped for a reason Kuna does not know: ${String(reason)}`, tokens)
  }
}

/** The arguments as the model wrote them, or undefined when they are not JSON, which the schema check then reports. */
function parsedArguments(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** OpenAI counts every input token in `input_tokens`, cache reads and writes too, and bills each at one rate. */
function tokensOf(usage: Usage | null | undefined): ModelTokens {
  const cacheRead = usage?.input_tokens_details?.cached_tokens ?? 0
  const cacheWrite = usage?.input_tokens_details?.cache_write_tokens ?? 0
  return { input: Math.max(0, (usage?.input_tokens ?? 0) - cacheRead - cacheWrite), cacheRead, cacheWrite, output: usage?.output_tokens ?? 0 }
}
