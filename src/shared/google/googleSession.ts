import { GOOGLE_SCOPES, scopesOf } from './googleScopes'
import type { GoogleScope } from './googleScopes'

/**
 * What this browser keeps about Google between visits: the account email for the login hint, the
 * scopes Google granted and the ones the books need, and why Google refused this device's silent
 * trip. None of it is a secret, and no token is ever kept.
 */
const ACCOUNT_EMAIL_KEY = 'ledgerboard.google-account'
const GRANTED_KEY = 'ledgerboard.google-granted'
const NEEDED_KEY = 'ledgerboard.google-needed'
const SILENT_REFUSAL_KEY = 'ledgerboard.google-silent-refused'

/** Kept only to pass as the login hint, so a new token skips Google's account chooser. */
export function saveAccountEmail(email: string): void {
  write(ACCOUNT_EMAIL_KEY, email)
}

export function loadAccountEmail(): string | null {
  const email = read(ACCOUNT_EMAIL_KEY)
  return email === null || email === '' ? null : email
}

/** The scopes Google granted, as the last token for each said, or null before any token. */
export function loadGrantedScopes(): GoogleScope[] | null {
  return scopesRead(GRANTED_KEY)
}

export function saveGrantedScopes(scopes: readonly GoogleScope[]): void {
  write(GRANTED_KEY, JSON.stringify(scopesOf(scopes)))
}

/** The scopes the books on this device and its settings need, as the app last worked them out, or null before it did. */
export function loadNeededScopes(): GoogleScope[] | null {
  return scopesRead(NEEDED_KEY)
}

export function saveNeededScopes(scopes: readonly GoogleScope[]): void {
  write(NEEDED_KEY, JSON.stringify(scopesOf(scopes)))
}

/** Google's error for this device's last silent trip, or `unanswered` while one is under way, or null when it last worked. */
export function loadSilentRefusal(): string | null {
  return read(SILENT_REFUSAL_KEY)
}

/** False when the browser keeps no site storage, so the refusal could not be noted. */
export function saveSilentRefusal(error: string): boolean {
  return write(SILENT_REFUSAL_KEY, error)
}

export function forgetSilentRefusal(): void {
  remove(SILENT_REFUSAL_KEY)
}

/** Forgets the account and everything kept about its grants, as signing out does. What the books need is no part of the account, so it stays. */
export function forgetGoogleDevice(): void {
  for (const key of [ACCOUNT_EMAIL_KEY, GRANTED_KEY, SILENT_REFUSAL_KEY]) {
    remove(key)
  }
}

function scopesRead(key: string): GoogleScope[] | null {
  let listed: unknown = null
  try {
    listed = JSON.parse(read(key) ?? 'null')
  } catch {
    return null
  }
  return Array.isArray(listed) ? GOOGLE_SCOPES.filter((scope) => listed.includes(scope)) : null
}

// Storage can be denied, as in some private windows. The app then asks Google with a tap on every visit.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, text: string): boolean {
  try {
    localStorage.setItem(key, text)
    return true
  } catch {
    return false
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing was stored, as above.
  }
}
