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
