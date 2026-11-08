import type { ModelPort, ModelReply, ModelRequest, ModelTurn, ToolCall, ToolResult } from '../application/modelPort'
import { ModelRequestFailed, resultParts } from '../application/modelPort'
import type { AiPart, AiTextPart } from '../domain/aiPart'
import { NO_TOKENS } from '../domain/modelUsage'
import type { ModelTokens } from '../domain/modelUsage'
import { keyTestOf, streamedEvents, withoutKey } from './providerFetch'
import type { ProviderCall } from './providerFetch'
import type { KeyTest, ModelChoice } from '../domain/providerPresets'

const MESSAGES_ADDRESS = 'https://api.anthropic.com/v1/messages'
const COUNT_TOKENS_ADDRESS = 'https://api.anthropic.com/v1/messages/count_tokens'
/** Bounds what one request can write, thinking included. Streaming would allow more, and a chat answer needs no more. */
const MAX_OUTPUT_TOKENS = 16_000

/** A content block as the stream built it, with every field it came with, since it goes back byte for byte on the next request. */
interface ContentBlock {
  readonly type: string
  [field: string]: unknown
}

interface Usage {
  readonly input_tokens?: number | null | undefined
  readonly output_tokens?: number | null | undefined
  readonly cache_creation_input_tokens?: number | null | undefined
  readonly cache_read_input_tokens?: number | null | undefined
}

type StreamEvent =
  | { readonly type: 'message_start'; readonly message?: { readonly usage?: Usage } }
  | { readonly type: 'content_block_start'; readonly index: number; readonly content_block?: ContentBlock }
  | { readonly type: 'content_block_delta'; readonly index: number; readonly delta?: BlockDelta }
  | { readonly type: 'content_block_stop'; readonly index: number }
  | {
      readonly type: 'message_delta'
      readonly delta?: { readonly stop_reason?: string | null; readonly stop_details?: { readonly explanation?: string | null } | null }
      readonly usage?: Usage
    }
  | { readonly type: 'message_stop' }
  | { readonly type: 'error'; readonly error?: { readonly message?: string } }

type BlockDelta =
  | { readonly type: 'text_delta'; readonly text: string }
  | { readonly type: 'thinking_delta'; readonly thinking: string }
  | { readonly type: 'signature_delta'; readonly signature: string }
  | { readonly type: 'input_json_delta'; readonly partial_json: string }

/** The message a whole stream adds up to. */
interface StreamedMessage {
  readonly stopReason: string | null
  readonly explanation: string | null
  readonly content: readonly ContentBlock[]
  readonly usage: Usage
}

/** The model behind an Anthropic key, called straight from the browser over the Messages API, always streaming. */
export function anthropicMessages(key: string, model: ModelChoice): ModelPort {
  return {
    model,
    readsPdf: true,
    send: async (request) => {
      return replyOf(await streamedMessage(key, messagesBody(model.id, request), request))
    },
  }
}

/** Asks Anthropic to count the tokens of one word, which is free and sends nothing from the books. */
export async function testAnthropicKey(key: string, modelId: string): Promise<KeyTest> {
  return keyTestOf(callOf(COUNT_TOKENS_ADDRESS, key, { model: modelId, messages: [{ role: 'user', content: 'Hi' }] }))
}

function callOf(address: string, key: string, body: object, signal?: AbortSignal): ProviderCall {
  return {
    address,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body,
    key,
    signal,
  }
}

function messagesBody(modelId: string, request: ModelRequest): object {
  return {
    model: modelId,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
    system: request.system.map((part, index) => systemBlock(part, index === request.system.length - 1)),
    messages: messagesOf(request),
    output_config: { effort: request.effort },
    ...(request.tools.length === 0
      ? {}
      : {
          tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.input, strict: true })),
          tool_choice: { type: 'auto' },
        }),
  }
}

/**
 * A chat's turns with a cache breakpoint on the last block of the last turn, so a long history and what it read are read
 * from the cache in the next request. The turn is always a person's or a tool's, whose blocks can carry it.
 */
function messagesOf(request: ModelRequest): readonly object[] {
  const messages = request.turns.map(message) as { readonly role: string; readonly content: readonly object[] }[]
  const last = messages.at(-1)
  if (last === undefined || last.role !== 'user') return messages
  const tail = { ...last, content: last.content.map((block, at) => (at === last.content.length - 1 ? { ...block, cache_control: { type: 'ephemeral' } } : block)) }
  return [...messages.slice(0, -1), tail]
}

/** The last system block carries the cache breakpoint, which caches the tools and the whole system text before it. */
function systemBlock(part: AiTextPart, last: boolean): object {
  return last ? { type: 'text', text: part.text, cache_control: { type: 'ephemeral' } } : { type: 'text', text: part.text }
}

function message(turn: ModelTurn): object {
  switch (turn.role) {
    case 'user': {
      return { role: 'user', content: turn.parts.map(contentBlock) }
    }
    case 'assistant': {
      return { role: 'assistant', content: turn.raw }
    }
    case 'tool-results': {
      return {
        role: 'user',
        content: turn.results.map((result) => ({ type: 'tool_result', tool_use_id: result.callId, content: resultContent(result), is_error: result.isError })),
      }
    }
  }
}

/** Text alone goes as a string. With photos or PDFs it is a list, the text first, then each part. */
function resultContent(result: ToolResult): string | readonly object[] {
  if (result.parts.length === 0) return result.text
  return resultParts(result.text, result.parts).map(contentBlock)
}

function contentBlock(part: AiPart): object {
  switch (part.kind) {
    case 'text': {
      return { type: 'text', text: part.text }
    }
    case 'pdf': {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: part.base64 }, title: part.name }
    }
    case 'image': {
      return { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } }
    }
  }
}

/**
 * Adds a stream up to its message. A block of a kind Kuna does not know is kept as it came, and an event of a kind it
 * does not know is skipped, as Anthropic's versioning says new ones may come. A failure carries the tokens spent so far.
 */
async function streamedMessage(key: string, body: object, request: ModelRequest): Promise<StreamedMessage> {
  const content: ContentBlock[] = []
  const toolInputs = new Map<number, string>()
  let usage: Usage = {}
  let stopReason: string | null = null
  let explanation: string | null = null
  let stopped = false

  function blockAt(index: number): ContentBlock {
    const block = content[index]
    if (block === undefined) throw new ModelRequestFailed(200, 'Anthropic streamed a part of a block it never started.', tokensOf(usage))
    return block
  }

  try {
    for await (const untyped of streamedEvents(callOf(MESSAGES_ADDRESS, key, body, request.signal))) {
      const event = untyped as StreamEvent
      switch (event.type) {
        case 'message_start':
          usage = laterUsage(usage, event.message?.usage)
          break
        case 'content_block_start':
          content[event.index] = { type: 'unreadable', ...event.content_block }
          break
        case 'content_block_delta': {
          const block = blockAt(event.index)
          const { delta } = event
          if (delta?.type === 'text_delta') {
            content[event.index] = { ...block, text: `${String(block['text'] ?? '')}${delta.text}` }
            request.onDelta?.(delta.text)
          } else if (delta?.type === 'thinking_delta') {
            content[event.index] = { ...block, thinking: `${String(block['thinking'] ?? '')}${delta.thinking}` }
          } else if (delta?.type === 'signature_delta') {
            content[event.index] = { ...block, signature: delta.signature }
          } else if (delta?.type === 'input_json_delta') {
            toolInputs.set(event.index, `${toolInputs.get(event.index) ?? ''}${delta.partial_json}`)
          }
          break
        }
        case 'content_block_stop': {
          const written = toolInputs.get(event.index)
          if (written !== undefined && written !== '') content[event.index] = { ...blockAt(event.index), input: parsedInput(written) }
          break
        }
        case 'message_delta':
          usage = laterUsage(usage, event.usage)
          stopReason = event.delta?.stop_reason ?? stopReason
          explanation = event.delta?.stop_details?.explanation ?? explanation
          break
        case 'error':
          throw new ModelRequestFailed(200, withoutKey(event.error?.message ?? 'Anthropic sent an error it did not explain.', key), tokensOf(usage))
        case 'message_stop':
          stopped = true
          break
      }
      if (stopped) break
    }
  } catch (failure) {
    if (failure instanceof ModelRequestFailed && failure.tokens === NO_TOKENS) {
      throw new ModelRequestFailed(failure.status, failure.message, tokensOf(usage))
    }
    throw failure
  }
  if (!stopped) {
    throw new ModelRequestFailed(200, 'The stream ended before the answer did.', tokensOf(usage))
  }
  return { stopReason, explanation, content, usage }
}

/** The input as written, or an unusable marker when it is not JSON. The block must still go back as an object, and the schema check reports the marker to the model. */
function parsedInput(written: string): unknown {
  try {
    return JSON.parse(written) as unknown
  } catch {
    return { not_json: written }
  }
}

function replyOf(streamed: StreamedMessage): ModelReply {
  const { content } = streamed
  if (typeof streamed.usage.input_tokens !== 'number' || typeof streamed.usage.output_tokens !== 'number') {
    throw new ModelRequestFailed(200, 'Anthropic answered with a reply Kuna cannot read.')
  }
  const tokens = tokensOf(streamed.usage)
  switch (streamed.stopReason) {
    case 'end_turn':
    case 'stop_sequence': {
      const text = content
        .filter((block) => block.type === 'text')
        .map((block) => String(block['text'] ?? ''))
        .join('')
      return { kind: 'answer', text, raw: content, tokens }
    }
    case 'tool_use': {
      const calls: ToolCall[] = content.filter((block) => block.type === 'tool_use').map((block) => ({ id: String(block['id']), name: String(block['name']), args: block['input'] }))
      return { kind: 'tool-calls', calls, raw: content, tokens }
    }
    case 'refusal': {
      return { kind: 'refused', reason: streamed.explanation ?? '', tokens }
    }
    case 'max_tokens':
    case 'model_context_window_exceeded': {
      return { kind: 'cut-off', tokens }
    }
    default: {
      throw new ModelRequestFailed(200, `Anthropic stopped for a reason Kuna does not know: ${String(streamed.stopReason)}`, tokens)
    }
  }
}

/** The counts so far, each replaced only by a later count, as Anthropic may leave a field out or null in `message_delta`. */
function laterUsage(known: Usage, later: Usage = {}): Usage {
  return {
    input_tokens: later.input_tokens ?? known.input_tokens,
    output_tokens: later.output_tokens ?? known.output_tokens,
    cache_creation_input_tokens: later.cache_creation_input_tokens ?? known.cache_creation_input_tokens,
    cache_read_input_tokens: later.cache_read_input_tokens ?? known.cache_read_input_tokens,
  }
}

function tokensOf(usage: Usage): ModelTokens {
  return {
    input: usage.input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
  }
}
