import type { ModelPort, ModelReply, ModelRequest, ModelTokens, ModelTurn, ToolCall } from '../application/modelPort'
import { ModelRequestFailed } from '../application/modelPort'
import type { AiPart, AiTextPart } from '../domain/aiTask'
import type { KeyTest, ModelChoice } from './providerPresets'

const MESSAGES_ADDRESS = 'https://api.anthropic.com/v1/messages'
const COUNT_TOKENS_ADDRESS = 'https://api.anthropic.com/v1/messages/count_tokens'
const MAX_OUTPUT_TOKENS = 16_000

interface TextBlock {
  readonly type: 'text'
  readonly text: string
}

interface ToolUseBlock {
  readonly type: 'tool_use'
  readonly id: string
  readonly name: string
  readonly input: unknown
}

type ResponseBlock = TextBlock | ToolUseBlock | { readonly type: 'thinking' | 'redacted_thinking' }

interface MessagesResponse {
  readonly stop_reason: string | null
  readonly stop_details?: { readonly explanation?: string | null } | null
  readonly content?: readonly ResponseBlock[]
  readonly usage?: Usage
}

interface Usage {
  readonly input_tokens: number
  readonly output_tokens: number
  readonly cache_creation_input_tokens?: number | null
  readonly cache_read_input_tokens?: number | null
}

/** The model behind an Anthropic key, called straight from the browser over the Messages API. */
export function anthropicMessages(key: string, model: ModelChoice): ModelPort {
  return {
    model: { name: model.name, inputPerMillion: model.inputPerMillion, outputPerMillion: model.outputPerMillion },
    readsPdf: true,
    send: async (request) => {
      return replyOf((await posted(MESSAGES_ADDRESS, key, messagesBody(model.id, request), request.signal)) as MessagesResponse)
    },
  }
}

/** Asks Anthropic to count the tokens of one word, which is free and sends nothing from the books. */
export async function testAnthropicKey(key: string, modelId: string): Promise<KeyTest> {
  try {
    await posted(COUNT_TOKENS_ADDRESS, key, { model: modelId, messages: [{ role: 'user', content: 'Hi' }] })
    return { kind: 'works' }
  } catch (failure) {
    if (!(failure instanceof ModelRequestFailed)) throw failure
    return failure.status === 401 || failure.status === 403 ? { kind: 'refused' } : { kind: 'failed', reason: failure.message }
  }
}

function messagesBody(modelId: string, request: ModelRequest): object {
  return {
    model: modelId,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: request.system.map((part, index) => systemBlock(part, index === request.system.length - 1)),
    messages: request.turns.map(message),
    output_config: { effort: request.effort, format: { type: 'json_schema', schema: request.output } },
    ...(request.tools.length === 0
      ? {}
      : {
          tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.input, strict: true })),
          tool_choice: { type: 'auto' },
        }),
  }
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
        content: turn.results.map((result) => ({ type: 'tool_result', tool_use_id: result.callId, content: result.text, is_error: result.isError })),
      }
    }
  }
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

function replyOf(response: MessagesResponse): ModelReply {
  if (!Array.isArray(response.content) || typeof response.usage?.input_tokens !== 'number' || typeof response.usage.output_tokens !== 'number') {
    throw new ModelRequestFailed(200, 'Anthropic answered with a reply Kuna cannot read.')
  }
  const content: readonly ResponseBlock[] = response.content
  const tokens = tokensOf(response.usage)
  switch (response.stop_reason) {
    case 'end_turn':
    case 'stop_sequence': {
      const text = content
        .filter((block): block is TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
      return { kind: 'answer', text, tokens }
    }
    case 'tool_use': {
      const calls: ToolCall[] = content.filter((block): block is ToolUseBlock => block.type === 'tool_use').map((block) => ({ id: block.id, name: block.name, args: block.input }))
      return { kind: 'tool-calls', calls, raw: content, tokens }
    }
    case 'refusal': {
      return { kind: 'refused', reason: response.stop_details?.explanation ?? '', tokens }
    }
    case 'max_tokens':
    case 'model_context_window_exceeded': {
      return { kind: 'cut-off', tokens }
    }
    default: {
      throw new ModelRequestFailed(200, `Anthropic stopped for a reason Kuna does not know: ${String(response.stop_reason)}`, tokens)
    }
  }
}

function tokensOf(usage: Usage): ModelTokens {
  return {
    input: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    output: usage.output_tokens,
  }
}

async function posted(address: string, key: string, body: object, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(address, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2026-10-21',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: signal ?? null,
    })
  } catch (failure) {
    throw new ModelRequestFailed(0, failure instanceof Error ? failure.message : String(failure))
  }
  const answer: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ModelRequestFailed(response.status, errorMessage(answer) ?? (response.statusText || `HTTP ${response.status}`))
  }
  if (answer === null) {
    throw new ModelRequestFailed(response.status, 'Anthropic answered with something that is not JSON.')
  }
  return answer
}

function errorMessage(answer: unknown): string | null {
  const message = (answer as { error?: { message?: unknown } } | null)?.error?.message
  return typeof message === 'string' ? message : null
}
