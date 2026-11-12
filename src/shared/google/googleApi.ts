import { words } from './words'

/** How long a Google request that carries no file waits for its answer. A healthy Google API answers in a second or two. */
export const ANSWER_WAIT_MS = 30_000

/** A Google request that gave no full answer within its wait. One that sent something may still have reached Google. */
export class GoogleTimedOut extends Error {
  constructor() {
    super(words.googleTimedOut)
    this.name = 'GoogleTimedOut'
  }
}

/** A failed Google REST call, with the status and the raw body Google sent back. */
export class GoogleApiError extends Error {
  readonly status: number
  readonly body: string
  /** Google's reason code from the body, such as `keptRevisionsLimitExceeded`, or null when the body names none. */
  readonly reason: string | null

  constructor(url: string, status: number, body: string) {
    super(`${status} from ${new URL(url).pathname}: ${body}`)
    this.name = 'GoogleApiError'
    this.status = status
    this.body = body
    this.reason = reasonOf(body)
  }
}

function reasonOf(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { errors?: { reason?: unknown }[] } }
    const reason = parsed.error?.errors?.[0]?.reason
    return typeof reason === 'string' ? reason : null
  } catch {
    return null
  }
}

/**
 * Google's answer as `read` takes it from the response, within the wait, its body included, or `GoogleApiError` for a refusal.
 * Firefox fails a body read cut short with an `AbortError` and Chrome with a `TimeoutError`, so the wait running out is told
 * by the signal and not by the error.
 */
export async function googleRequest<Answer>(url: string, accessToken: string, init: RequestInit, read: (response: Response) => Promise<Answer>, waitMs: number): Promise<Answer> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  const signal = AbortSignal.timeout(waitMs)
  try {
    const response = await fetch(url, { ...init, headers, signal })
    if (!response.ok) {
      throw new GoogleApiError(url, response.status, await response.text())
    }
    return await read(response)
  } catch (failure) {
    if (signal.aborted) throw new GoogleTimedOut()
    throw failure
  }
}

/** For a request whose answer says nothing the caller needs. */
export async function noAnswer(): Promise<void> {}

/** Whether Google turned the call's token away, as it does once the token runs out or loses its grant. */
export function isUnauthorized(failure: unknown): boolean {
  return failure instanceof GoogleApiError && failure.status === 401
}

const RATE_LIMIT_REASONS: readonly string[] = ['rateLimitExceeded', 'userRateLimitExceeded']

/** Whether Google asked the app to slow down: a 429, or a 403 whose reason is a rate limit. */
export function isRateLimited(failure: unknown): boolean {
  return failure instanceof GoogleApiError && (failure.status === 429 || (failure.status === 403 && RATE_LIMIT_REASONS.includes(failure.reason ?? '')))
}

/** Google's backoff before the retry with this index, from 0: 1, 2, 4 seconds and on, each with up to a second more at random. */
export function backoff(retry: number): number {
  return 2 ** retry * 1000 + Math.floor(Math.random() * 1000)
}
