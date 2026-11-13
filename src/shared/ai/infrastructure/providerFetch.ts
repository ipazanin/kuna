import { ModelRequestFailed } from '../application/modelPort'
import type { ModelFailureKind } from '../application/modelPort'
import { NO_TOKENS } from '../domain/modelUsage'
import type { KeyTest } from '../domain/providerPresets'
import { serverSentEvents } from './serverSentEvents'

export interface ProviderCall {
  readonly address: string
  readonly method: 'GET' | 'POST'
  readonly headers: Readonly<Record<string, string>>
  readonly body?: object
  /** The key the headers carry, which is cut from anything a provider says back. */
  readonly key: string
  readonly signal?: AbortSignal | undefined
}

export function bearerHeaders(key: string): Readonly<Record<string, string>> {
  return { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
}

/** The provider's words with the key cut out, since an error can quote what it was sent, and those words reach the screen. */
export function withoutKey(text: string, key: string): string {
  return key === '' ? text : text.replaceAll(key, '[key]')
}

/** The JSON answer to a call. Throws `ModelRequestFailed` on an error status, an unreachable provider or an answer that is not JSON. */
export async function jsonAnswer(call: ProviderCall): Promise<unknown> {
  const response = await okResponse(call)
  const answer: unknown = await response.json().catch(() => null)
  if (answer === null) {
    throw call.signal?.aborted === true ? new ModelRequestFailed(0, unreachableMessage(null, call)) : new ModelRequestFailed(response.status, 'The provider answered with something that is not JSON.')
  }
  return answer
}

/** The JSON events of a streamed answer. Throws `ModelRequestFailed` as `jsonAnswer` does, and on a stream that breaks or holds an event that is not JSON. */
export async function* streamedEvents(call: ProviderCall): AsyncGenerator<unknown> {
  const response = await okResponse(call)
  if (response.body === null) {
    throw new ModelRequestFailed(response.status, 'The provider answered with no stream.')
  }
  try {
    for await (const data of serverSentEvents(response.body)) {
      yield parsedEvent(data, response.status)
    }
  } catch (failure) {
    if (failure instanceof ModelRequestFailed) throw failure
    throw new ModelRequestFailed(0, unreachableMessage(failure, call))
  }
}

function parsedEvent(data: string, status: number): unknown {
  try {
    return JSON.parse(data) as unknown
  } catch {
    throw new ModelRequestFailed(status, 'The provider sent an event that is not JSON.')
  }
}

/** One cheap call with the key that sends nothing from the books, as a Test of the key. */
export async function keyTestOf(call: ProviderCall): Promise<KeyTest> {
  try {
    await jsonAnswer(call)
    return { kind: 'works' }
  } catch (failure) {
    if (!(failure instanceof ModelRequestFailed)) throw failure
    return failure.status === 401 || failure.status === 403 ? { kind: 'refused' } : { kind: 'failed', reason: failure.message }
  }
}

async function okResponse(call: ProviderCall): Promise<Response> {
  let response: Response
  try {
    response = await fetch(call.address, {
      method: call.method,
      headers: call.headers,
      ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
      signal: call.signal ?? null,
    })
  } catch (failure) {
    throw new ModelRequestFailed(0, unreachableMessage(failure, call))
  }
  if (!response.ok) {
    const answer: unknown = await response.json().catch(() => null)
    throw new ModelRequestFailed(response.status, withoutKey(errorMessage(answer) ?? (response.statusText || `HTTP ${response.status}`), call.key), NO_TOKENS, failureKindOf(response.status, answer))
  }
  return response
}

/** Why a fetch or a stream broke, and an abort's own reason first, as browsers word a read cut by an abort differently. */
function unreachableMessage(failure: unknown, call: ProviderCall): string {
  const cause: unknown = call.signal?.aborted === true ? call.signal.reason : failure
  return withoutKey(cause instanceof Error ? cause.message : String(cause), call.key)
}

function errorMessage(answer: unknown): string | null {
  const message = (answer as { error?: { message?: unknown } } | null)?.error?.message
  return typeof message === 'string' ? message : null
}

/**
 * What an error answer means. Anthropic documents a 402 billing_error, yet an empty balance has been seen as a 400 with
 * this message, so the message counts too. OpenAI sends a 429 whose code names the empty balance, and OpenRouter a 402.
 * A 401 is a key every provider refuses.
 */
function failureKindOf(status: number, answer: unknown): ModelFailureKind {
  if (status === 401) return 'key-refused'
  const error = (answer as { error?: { type?: unknown; code?: unknown } } | null)?.error
  const outOfCredit = status === 402 || error?.type === 'billing_error' || error?.code === 'credit_balance_exhausted' || errorMessage(answer)?.startsWith('Your credit balance is too low') === true
  return outOfCredit ? 'out-of-credit' : 'other'
}
