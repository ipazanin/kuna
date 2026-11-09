import type { ModelPort, ModelReply, ModelRequest, ModelTurn, ToolCall, ToolResult } from '../application/modelPort'
import { ModelRequestFailed, resultParts } from '../application/modelPort'
import type { AiPart } from '../domain/aiPart'
import type { ModelTokens } from '../domain/modelUsage'
import { bearerHeaders, jsonAnswer } from './providerFetch'
import type { ModelChoice } from '../domain/providerPresets'

const MAX_OUTPUT_TOKENS = 16_000

interface FunctionCall {
  readonly id: string
  readonly type: 'function'
  readonly function: { readonly name: string; readonly arguments: string }
}

interface AssistantMessage {
  readonly role: 'assistant'
  readonly content: string | null
  readonly refusal?: string | null
  readonly tool_calls?: readonly FunctionCall[]
}

interface ChatResponse {
  readonly choices?: readonly { readonly finish_reason: string; readonly message?: AssistantMessage | null }[]
  readonly usage?: Usage
}

interface Usage {
  readonly prompt_tokens: number
  readonly completion_tokens: number
  readonly prompt_tokens_details?: { readonly cached_tokens?: number; readonly cache_write_tokens?: number }
  readonly cost?: number
}

/** The model behind an OpenRouter key over Chat Completions. It does not stream, and it reads no PDF in Kuna. */
export function openRouterChat(baseUrl: string, key: string, model: ModelChoice): ModelPort {
  return {
    model,
    readsPdf: false,
    send: async (request) => {
      return replyOf(
        (await jsonAnswer({
          address: `${baseUrl}/chat/completions`,
          method: 'POST',
          headers: bearerHeaders(key),
          body: completionsBody(model.id, request),
          key,
          signal: request.signal,
        })) as ChatResponse,
      )
    },
  }
}

function completionsBody(modelId: string, request: ModelRequest): object {
  const system = request.system.map((part) => part.text).join('\n\n')
  return {
    model: modelId,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    messages: [...(system === '' ? [] : [{ role: 'system', content: system }]), ...request.turns.flatMap(messages)],
    // Strict tool schemas need every endpoint OpenRouter routes to to honour every parameter. Endpoints that keep or train on prompts are never chosen.
    provider: { require_parameters: true, data_collection: 'deny' },
    ...(request.tools.length === 0
      ? {}
      : {
          tools: request.tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input, strict: true } })),
          tool_choice: 'auto',
        }),
  }
}

function messages(turn: ModelTurn): object[] {
  switch (turn.role) {
    case 'user': {
      return [{ role: 'user', content: turn.parts.map(contentPart) }]
    }
    case 'assistant': {
      return [turn.raw as object]
    }
    case 'earlier-answer': {
      return [{ role: 'assistant', content: turn.text }]
    }
    case 'tool-results': {
      return turn.results.map((result) => ({ role: 'tool', tool_call_id: result.callId, content: resultContent(result) }))
    }
  }
}

/**
 * Text alone goes as a string. With a photo it is a list, the text first, then the photo, as OpenRouter's schema for a
 * tool message allows. A PDF is refused before anything is sent, as in a person's turn.
 */
function resultContent(result: ToolResult): string | readonly object[] {
  const text = result.isError ? `Error: ${result.text}` : result.text
  if (result.parts.length === 0) return text
  return resultParts(text, result.parts).map(contentPart)
}

function contentPart(part: AiPart): object {
  switch (part.kind) {
    case 'text': {
      return { type: 'text', text: part.text }
    }
    case 'pdf': {
      throw new ModelRequestFailed(0, 'OpenRouter reads no PDF in Kuna.')
    }
    case 'image': {
      return { type: 'image_url', image_url: { url: `data:${part.mediaType};base64,${part.base64}` } }
    }
  }
}

function replyOf(response: ChatResponse): ModelReply {
  const choice = response.choices?.[0]
  if (typeof choice?.message !== 'object' || choice.message === null) {
    throw new ModelRequestFailed(200, 'The provider answered with no choice.')
  }
  const message = choice.message
  const tokens = tokensOf(response.usage)
  switch (choice.finish_reason) {
    case 'stop': {
      return typeof message.refusal === 'string' ? { kind: 'refused', reason: message.refusal, tokens } : { kind: 'answer', text: message.content ?? '', raw: message, tokens }
    }
    case 'tool_calls': {
      const functionCalls = message.tool_calls ?? []
      if (functionCalls.length === 0) {
        throw new ModelRequestFailed(200, 'The provider stopped for tool calls but sent none.', tokens)
      }
      const calls: ToolCall[] = functionCalls.map((call) => ({ id: call.id, name: call.function.name, args: parsedArguments(call.function.arguments) }))
      return { kind: 'tool-calls', calls, raw: message, tokens }
    }
    case 'length': {
      return { kind: 'cut-off', tokens }
    }
    case 'content_filter': {
      return { kind: 'refused', reason: 'content_filter', tokens }
    }
    default: {
      throw new ModelRequestFailed(200, `The provider stopped for a reason Kuna does not know: ${choice.finish_reason}`, tokens)
    }
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

/** `prompt_tokens` counts the cached tokens too, so the fresh input is what remains. */
function tokensOf(usage: Usage | undefined): ModelTokens {
  const cacheRead = usage?.prompt_tokens_details?.cached_tokens ?? 0
  const cacheWrite = usage?.prompt_tokens_details?.cache_write_tokens ?? 0
  return {
    input: Math.max(0, (usage?.prompt_tokens ?? 0) - cacheRead - cacheWrite),
    cacheRead,
    cacheWrite,
    output: usage?.completion_tokens ?? 0,
    ...(typeof usage?.cost === 'number' ? { chargedDollars: usage.cost } : {}),
  }
}
