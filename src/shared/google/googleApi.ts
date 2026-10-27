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

export async function googleFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    throw new GoogleApiError(url, response.status, await response.text())
  }
  return response
}

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
