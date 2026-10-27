import { startsAtBooksFolder } from '../text/folderPath'

/** A Google permission the app asks for, by the short name the sync and the settings use. */
export type GoogleScope = 'drive.file' | 'drive.readonly' | 'gmail.readonly' | 'gmail.compose'

const SCOPE_NAMES: Readonly<Record<GoogleScope, string>> = {
  'drive.file': 'https://www.googleapis.com/auth/drive.file',
  'drive.readonly': 'https://www.googleapis.com/auth/drive.readonly',
  'gmail.readonly': 'https://www.googleapis.com/auth/gmail.readonly',
  'gmail.compose': 'https://www.googleapis.com/auth/gmail.compose',
}

/** Every scope the app knows, in the order a request lists them. */
export const GOOGLE_SCOPES: readonly GoogleScope[] = ['drive.file', 'drive.readonly', 'gmail.readonly', 'gmail.compose']

/** Asked for with every request, so the app can read which account signed in, for the login hint. */
const SIGN_IN_SCOPES = 'openid email'

/** The `scope` of a request to Google: the sign-in scopes and these, each once. */
export function scopeRequest(scopes: readonly GoogleScope[]): string {
  return [SIGN_IN_SCOPES, ...GOOGLE_SCOPES.filter((scope) => scopes.includes(scope)).map((scope) => SCOPE_NAMES[scope])].join(' ')
}

/** The app's scopes a token's `scope` field names. The person can untick any of them on Google's consent screen. */
export function scopesIn(granted: string): GoogleScope[] {
  const names = granted.split(' ')
  return GOOGLE_SCOPES.filter((scope) => names.includes(SCOPE_NAMES[scope]))
}

/** Each scope once, in request order. */
export function scopesOf(scopes: Iterable<GoogleScope>): GoogleScope[] {
  const wanted = new Set(scopes)
  return GOOGLE_SCOPES.filter((scope) => wanted.has(scope))
}

/**
 * The scope that reads a folder at this path: the books file's scope for a path from the folder the
 * books file is in, whose folders and files the app made, and Drive read for a path from My Drive.
 */
export function folderReadScope(path: readonly string[]): GoogleScope {
  return startsAtBooksFolder(path) ? 'drive.file' : 'drive.readonly'
}

/** What an action says when the token Google gave lacks the scope it needs. */
export const NOT_GRANTED: Readonly<Record<GoogleScope, string>> = {
  'drive.file': 'Google Drive access was not allowed, so the app cannot read or save the books.',
  'drive.readonly': 'Drive read access was not allowed, so the app cannot read your Drive folders.',
  'gmail.readonly': 'Gmail read access was not allowed, so the app cannot look for the mail it would file.',
  'gmail.compose': 'Gmail access was not allowed, so no draft can be saved. Leave "Create the mail draft" off to write the mail yourself.',
}
