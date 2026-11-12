import { GOOGLE_SCOPES, scopesOf } from './googleScopes'
import type { GoogleScope } from './googleScopes'
import { deviceText, jsonChoice } from '../device/deviceChoice'

/**
 * What this browser keeps about Google between visits: the account email for the login hint, the
 * scopes Google granted and the ones the books need, and why Google refused this device's silent
 * trip. None of it is a secret, and no token is ever kept. Storage can be denied, as in some private windows, and the
 * app then asks Google with a tap on every visit.
 */
const ACCOUNT_EMAIL = deviceText('kuna.google-account')
const GRANTED = scopesKept('kuna.google-granted')
const NEEDED = scopesKept('kuna.google-needed')
const SILENT_REFUSAL = deviceText('kuna.google-silent-refused')

function scopesKept(key: string) {
  return jsonChoice(key, (listed) => (Array.isArray(listed) ? GOOGLE_SCOPES.filter((scope) => listed.includes(scope)) : null))
}

/** Kept only to pass as the login hint, so a new token skips Google's account chooser. */
export function saveAccountEmail(email: string): void {
  ACCOUNT_EMAIL.remember(email)
}

export function loadAccountEmail(): string | null {
  const email = ACCOUNT_EMAIL.read()
  return email === null || email === '' ? null : email
}

/** The scopes Google granted, as the last token for each said, or null before any token. */
export function loadGrantedScopes(): GoogleScope[] | null {
  return GRANTED.read()
}

export function saveGrantedScopes(scopes: readonly GoogleScope[]): void {
  GRANTED.remember(scopesOf(scopes))
}

/** The scopes the books on this device and its settings need, as the app last worked them out, or null before it did. */
export function loadNeededScopes(): GoogleScope[] | null {
  return NEEDED.read()
}

export function saveNeededScopes(scopes: readonly GoogleScope[]): void {
  NEEDED.remember(scopesOf(scopes))
}

/** Google's error for this device's last silent trip, or `unanswered` while one is under way, or null when it last worked. */
export function loadSilentRefusal(): string | null {
  return SILENT_REFUSAL.read()
}

/** False when the browser keeps no site storage, so the refusal could not be noted. */
export function saveSilentRefusal(error: string): boolean {
  return SILENT_REFUSAL.remember(error)
}

export function forgetSilentRefusal(): void {
  SILENT_REFUSAL.remember(null)
}

/** Forgets the account and everything kept about its grants, as signing out does. What the books need is no part of the account, so it stays. */
export function forgetGoogleDevice(): void {
  ACCOUNT_EMAIL.remember(null)
  GRANTED.remember(null)
  SILENT_REFUSAL.remember(null)
}
