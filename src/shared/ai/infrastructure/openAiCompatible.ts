import type { ModelPort, ModelReply, ModelRequest, ModelTurn, ToolCall } from '../application/modelPort'
import { ModelRequestFailed } from '../application/modelPort'
import type { AiPart } from '../domain/aiTask'
import type { StrictSchema } from '../domain/strictSchema'
import type { KeyTest, ModelChoice } from './providerPresets'

const MAX_OUTPUT_TOKENS = 16_000
/** The function a model with tools calls to hand in its final answer, since a strict answer format may not combine with tools. */
const ANSWER_FUNCTION = 'answer'

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
  readonly usage?: { readonly prompt_tokens: number; readonly completion_tokens: number }
}

/** The model behind a key for a provider that speaks OpenAI's Chat Completions, such as OpenAI itself or OpenRouter. */
export function openAiCompatible(baseUrl: string, key: string, model: ModelChoice, readsPdf: boolean, requiresParameters = false): ModelPort {
  return {
    model: { name: model.name, inputPerMillion: model.inputPerMillion, outputPerMillion: model.outputPerMillion },
    readsPdf,
    send: async (request) => {
      return replyOf(
        (await called(`${baseUrl}/chat/completions`, key, {
          method: 'POST',
          body: JSON.stringify(completionsBody(model.id, request, requiresParameters)),
          signal: request.signal ?? null,
        })) as ChatResponse,
      )
    },
  }
}

/** Lists the provider's models with the key, which sends nothing from the books. */
export async function testOpenAiCompatibleKey(url: string, key: string): Promise<KeyTest> {
  try {
    await called(url, key, { method: 'GET' })
    return { kind: 'works' }
  } catch (failure) {
    if (!(failure instanceof ModelRequestFailed)) throw failure
    return failure.status === 401 || failure.status === 403 ? { kind: 'refused' } : { kind: 'failed', reason: failure.message }
  }
}

function completionsBody(modelId: string, request: ModelRequest, requiresParameters: boolean): object {
  const system = request.system.map((part) => part.text).join('\n\n')
  return {
    model: modelId,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    messages: [...(system === '' ? [] : [{ role: 'system', content: system }]), ...request.turns.flatMap(messages)],
    ...(requiresParameters ? { provider: { require_parameters: true } } : {}),
    ...(request.tools.length === 0
      ? { response_format: { type: 'json_schema', json_schema: { name: ANSWER_FUNCTION, strict: true, schema: request.output } } }
      : {
          tools: [
            ...request.tools.map((tool) => functionTool(tool.name, tool.description, tool.input)),
            functionTool(ANSWER_FUNCTION, 'Call this once with your final answer when you have everything you need. Do not answer in plain text.', request.output),
          ],
          tool_choice: 'auto',
        }),
  }
}

function functionTool(name: string, description: string, parameters: StrictSchema): object {
  return { type: 'function', function: { name, description, parameters, strict: true } }
}

function messages(turn: ModelTurn): object[] {
  switch (turn.role) {
    case 'user': {
      return [{ role: 'user', content: turn.parts.map(contentPart) }]
    }
    case 'assistant': {
      return [turn.raw as object]
    }
    case 'tool-results': {
      return turn.results.map((result) => ({ role: 'tool', tool_call_id: result.callId, content: result.isError ? `Error: ${result.text}` : result.text }))
    }
  }
}

function contentPart(part: AiPart): object {
  switch (part.kind) {
    case 'text': {
      return { type: 'text', text: part.text }
    }
    case 'pdf': {
      return { type: 'file', file: { filename: part.name, file_data: `data:application/pdf;base64,${part.base64}` } }
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
  const tokens = { input: response.usage?.prompt_tokens ?? 0, output: response.usage?.completion_tokens ?? 0 }
  switch (choice.finish_reason) {
    case 'stop': {
      return typeof message.refusal === 'string' ? { kind: 'refused', reason: message.refusal, tokens } : { kind: 'answer', text: message.content ?? '', tokens }
    }
    case 'tool_calls': {
      const functionCalls = message.tool_calls ?? []
      const answer = functionCalls.find((call) => call.function.name === ANSWER_FUNCTION)
      if (answer !== undefined) {
        return { kind: 'answer', text: answer.function.arguments, tokens }
      }
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

async function called(address: string, key: string, init: { readonly method: 'GET' | 'POST'; readonly body?: string; readonly signal?: AbortSignal | null }): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(address, { ...init, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' } })
  } catch (failure) {
    throw new ModelRequestFailed(0, failure instanceof Error ? failure.message : String(failure))
  }
  const answer: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ModelRequestFailed(response.status, errorMessage(answer) ?? (response.statusText || `HTTP ${response.status}`))
  }
  if (answer === null) {
    throw new ModelRequestFailed(response.status, 'The provider answered with something that is not JSON.')
  }
  return answer
}

function errorMessage(answer: unknown): string | null {
  const message = (answer as { error?: { message?: unknown } } | null)?.error?.message
  return typeof message === 'string' ? message : null
}
