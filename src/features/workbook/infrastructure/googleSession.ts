/** The Google access token and account email this browser keeps between visits. Never a refresh token. */
export interface StoredAccessToken {
  readonly value: string
  readonly grantedScope: string
  /** Epoch milliseconds. */
  readonly expiresAt: number
}

const ACCESS_TOKEN_KEY = 'ledgerboard.google-token'
const ACCOUNT_EMAIL_KEY = 'ledgerboard.google-account'

/** A token this close to its expiry counts as expired, so a sync never starts on one that lapses midway. */
export const EXPIRY_MARGIN_MS = 60_000

export function saveAccessToken(token: StoredAccessToken): void {
  write(ACCESS_TOKEN_KEY, JSON.stringify(token))
}

/** The stored token while it is still good at `now`. An expired or unreadable one is removed. */
export function loadAccessToken(now: number): StoredAccessToken | null {
  const stored = tokenOf(parse(read(ACCESS_TOKEN_KEY)))
  if (stored !== null && stored.expiresAt - EXPIRY_MARGIN_MS > now) {
    return stored
  }
  forgetAccessToken()
  return null
}

export function forgetAccessToken(): void {
  remove(ACCESS_TOKEN_KEY)
}

/** Kept only to pass as the login hint, so renewing the token skips Google's account chooser. */
export function saveAccountEmail(email: string): void {
  write(ACCOUNT_EMAIL_KEY, email)
}

export function loadAccountEmail(): string | null {
  const email = read(ACCOUNT_EMAIL_KEY)
  return email === null || email === '' ? null : email
}

export function forgetAccountEmail(): void {
  remove(ACCOUNT_EMAIL_KEY)
}

function tokenOf(candidate: unknown): StoredAccessToken | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const { value, grantedScope, expiresAt } = candidate as Record<string, unknown>
  if (typeof value !== 'string' || value === '' || typeof grantedScope !== 'string' || typeof expiresAt !== 'number') {
    return null
  }
  return { value, grantedScope, expiresAt }
}

function parse(text: string | null): unknown {
  try {
    return JSON.parse(text ?? 'null')
  } catch {
    return null
  }
}

// Storage can be denied, as in some private windows. The app then signs in on every visit.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, text: string): void {
  try {
    localStorage.setItem(key, text)
  } catch {
    // Not remembered, as above.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing was stored, as above.
  }
}
